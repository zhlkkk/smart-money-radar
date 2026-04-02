import { withTimeout } from '../enrichment/enrich.js';

export interface AttributionInput {
  tokenSymbol?: string;
  tokenMint: string;
  liquidity: number | null;
  fdv: number | null;
  volume24h: number | null;
  txns24h: { buys: number; sells: number } | null;
  pairCreatedAt: number | null;
  walletLabel: string;
  walletCategory: string;
  dexSource: string;
  mintAuthority: string | null | 'unchecked';
  freezeAuthority: string | null | 'unchecked';
  riskLabel: string;
  riskFactors: string[];
}

export interface LLMConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

function formatValue(val: number | null): string {
  if (val === null) return 'N/A';
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

function formatAge(pairCreatedAt: number | null): string {
  if (pairCreatedAt === null) return 'N/A';
  const ageMs = Date.now() - pairCreatedAt;
  const hours = Math.floor(ageMs / 3_600_000);
  if (hours < 1) return `${Math.floor(ageMs / 60_000)}分钟`;
  if (hours < 24) return `${hours}小时`;
  return `${Math.floor(hours / 24)}天`;
}

function formatAuthStatus(value: string | null | 'unchecked'): string {
  if (value === null) return 'Revoked';
  if (value === 'unchecked') return 'Unchecked';
  return 'Active';
}

function buildPrompt(input: AttributionInput): string {
  const txnsStr = input.txns24h
    ? `${input.txns24h.buys} buys / ${input.txns24h.sells} sells`
    : 'N/A';

  return `用 <50 字中文总结这个 Solana 代币的买入理由和风险提示。
要求：先说为什么被买入，再说主要风险点。禁止废话。

代币: ${input.tokenSymbol ?? 'Unknown'} (${input.tokenMint})
流动性: ${formatValue(input.liquidity)}
FDV: ${formatValue(input.fdv)}
24h交易量: ${formatValue(input.volume24h)}
24h交易笔数: ${txnsStr}
池子年龄: ${formatAge(input.pairCreatedAt)}
买家: ${input.walletLabel} (${input.walletCategory})
DEX来源: ${input.dexSource}
Mint Authority: ${formatAuthStatus(input.mintAuthority)}
Freeze Authority: ${formatAuthStatus(input.freezeAuthority)}
风险等级: ${input.riskLabel}
风险因子: ${input.riskFactors.length > 0 ? input.riskFactors.join('、') : '无'}`;
}

async function callLLM(
  prompt: string,
  llmConfig: LLMConfig,
  timeoutMs: number,
): Promise<string> {
  const url = `${llmConfig.baseURL.replace(/\/$/, '')}/chat/completions`;

  const res = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: llmConfig.model,
        max_tokens: 100,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      }),
    }),
    timeoutMs,
  );

  if (res.status === 429) {
    throw new RetryableError('rate limited');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM API ${res.status}: ${text}`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

class RetryableError extends Error {
  constructor(message: string) { super(message); }
}

// ─── AI 归因缓存 ───
// 同一代币 10 分钟内返回缓存，LRU 驱逐最多 500 条

interface CacheEntry {
  summary: string;
  cachedAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 分钟
const CACHE_MAX_SIZE = 500;

const attributionCache = new Map<string, CacheEntry>();

export function clearAttributionCache(): void {
  attributionCache.clear();
}

export async function generateAttribution(
  input: AttributionInput,
  llmConfig: LLMConfig,
  timeoutMs = 3000,
): Promise<string> {
  const cacheKey = input.tokenMint;

  // 检查缓存
  const cached = attributionCache.get(cacheKey);
  if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
    console.log('[attribution] cache hit', { tokenMint: cacheKey });
    return cached.summary;
  }

  const prompt = buildPrompt(input);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const summary = await callLLM(prompt, llmConfig, timeoutMs);

      // 只缓存非空结果
      if (summary) {
        // LRU 驱逐：超过上限时删除最早的条目
        if (attributionCache.size >= CACHE_MAX_SIZE) {
          const oldestKey = attributionCache.keys().next().value;
          if (oldestKey !== undefined) attributionCache.delete(oldestKey);
        }
        attributionCache.set(cacheKey, { summary, cachedAt: Date.now() });
        console.log('[attribution] cache miss — stored', { tokenMint: cacheKey });
      }

      return summary;
    } catch (err) {
      if (err instanceof RetryableError && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      console.error('[attribution] AI summary failed', {
        error: err instanceof Error ? err.message : String(err),
        tokenMint: input.tokenMint,
        attempt,
      });
      return '';
    }
  }
  return '';
}

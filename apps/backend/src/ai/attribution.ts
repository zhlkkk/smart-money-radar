import type Anthropic from '@anthropic-ai/sdk';
import { withTimeout } from '../enrichment/enrich.js';

export interface AttributionInput {
  tokenSymbol?: string;
  tokenMint: string;
  liquidity: number | null;
  fdv: number | null;
  walletLabel: string;
  walletCategory: string;
  dexSource: string;
}

function formatValue(val: number | null): string {
  if (val === null) return 'N/A';
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

function buildPrompt(input: AttributionInput): string {
  return `用 <50 字中文总结这个 Solana 代币为什么被聪明钱买入，只说基本面和叙事，禁止废话。

代币: ${input.tokenSymbol ?? 'Unknown'} (${input.tokenMint})
流动性: ${formatValue(input.liquidity)}
FDV: ${formatValue(input.fdv)}
买家: ${input.walletLabel} (${input.walletCategory})
DEX来源: ${input.dexSource}`;
}

export async function generateAttribution(
  input: AttributionInput,
  client: Anthropic,
  timeoutMs = 1000,
): Promise<string> {
  try {
    const responsePromise = client.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 100,
      temperature: 0.3,
      messages: [{ role: 'user', content: buildPrompt(input) }],
    });

    const response = await withTimeout(responsePromise, timeoutMs);

    const textBlock = response.content.find((c) => c.type === 'text');
    return textBlock?.text ?? '';
  } catch {
    return '';
  }
}

import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { RateLimiter } from '../../discovery/rate-limiter.js';
import type {
  BacktestTrade,
  WalletTradeData,
  CollectionProgress,
} from './types.js';

const BIRDEYE_BASE = 'https://public-api.birdeye.so';
const TIMEOUT_MS = 10_000;

function makeHeaders(apiKey: string): Record<string, string> {
  return {
    'X-API-KEY': apiKey,
    'x-chain': 'solana',
    Accept: 'application/json',
  };
}

function checkAuthError(status: number): void {
  if (status === 401 || status === 403) {
    throw new Error(
      `Birdeye API authentication failed (HTTP ${status}). Check your BIRDEYE_API_KEY.`,
    );
  }
}

function checkRateLimit(status: number): void {
  if (status === 429) {
    throw new Error('Birdeye API rate limit exceeded (HTTP 429). Try again later.');
  }
}

/** Birdeye tx_list 单条交易的 API 响应结构 */
interface BirdeyeTxItem {
  txHash?: string;
  blockTime?: number;
  from?: { address?: string; amount?: number };
  to?: { address?: string; amount?: number };
  side?: string;
  tokenAddress?: string;
}

interface BirdeyeTxListResponse {
  success: boolean;
  data?: {
    items?: BirdeyeTxItem[];
  };
}

function normalizeTrade(address: string, item: BirdeyeTxItem): BacktestTrade {
  const type = item.side === 'sell' ? 'sell' : 'buy';
  return {
    address,
    signature: item.txHash ?? '',
    tokenMint: item.tokenAddress ?? '',
    type,
    timestamp: item.blockTime ?? 0,
    amount: (type === 'buy' ? item.from?.amount : item.to?.amount) ?? 0,
  };
}

/**
 * 采集单个钱包的交易历史。
 * 认证错误(401/403)和限流(429)会抛出终止级错误。
 * 网络超时等非致命错误返回 null。
 */
export async function collectWalletTrades(
  apiKey: string,
  address: string,
  rateLimiter: RateLimiter,
): Promise<WalletTradeData | null> {
  await rateLimiter.acquire();

  try {
    const url = `${BIRDEYE_BASE}/wallet/tx_list?wallet=${encodeURIComponent(address)}`;
    const response = await fetch(url, {
      headers: makeHeaders(apiKey),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    checkAuthError(response.status);
    checkRateLimit(response.status);

    if (!response.ok) return null;

    const body = (await response.json()) as BirdeyeTxListResponse;

    if (!body.success) return null;

    const items = body.data?.items ?? [];
    const trades: BacktestTrade[] = items.map((item) => normalizeTrade(address, item));

    return {
      address,
      trades,
      collectedAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    // 认证和限流错误向上抛出，终止整体采集
    if (
      error instanceof Error &&
      (error.message.includes('authentication failed') ||
        error.message.includes('rate limit'))
    ) {
      throw error;
    }
    // 网络超时等非致命错误返回 null
    return null;
  }
}

/** collectAllWallets 的选项 */
export interface CollectAllOptions {
  /** 输出目录，每个钱包一个 JSON 文件 */
  outputDir: string;
  /** 请求频率限制器 */
  rateLimiter: RateLimiter;
  /** 进度回调 */
  onProgress?: (progress: CollectionProgress) => void;
}

/**
 * 批量采集多个钱包的交易历史。
 * 支持断点续跑：已有输出文件的钱包会被跳过。
 * 认证/限流错误会终止整体流程。
 */
export async function collectAllWallets(
  apiKey: string,
  addresses: string[],
  options: CollectAllOptions,
): Promise<CollectionProgress> {
  const { outputDir, rateLimiter, onProgress } = options;

  await mkdir(outputDir, { recursive: true });

  // 检查已有文件，支持断点续跑
  let existingFiles: string[];
  try {
    existingFiles = await readdir(outputDir);
  } catch {
    existingFiles = [];
  }
  const completedSet = new Set(
    existingFiles
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, '')),
  );

  const progress: CollectionProgress = {
    totalWallets: addresses.length,
    completed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const address of addresses) {
    if (completedSet.has(address)) {
      progress.skipped++;
      onProgress?.(progress);
      continue;
    }

    // collectWalletTrades 内部已处理非致命错误（返回 null）
    // 认证/限流错误会直接抛出，终止整体流程
    const result = await collectWalletTrades(apiKey, address, rateLimiter);

    if (result) {
      const filePath = join(outputDir, `${address}.json`);
      await writeFile(filePath, JSON.stringify(result, null, 2));
      progress.completed++;
    } else {
      progress.failed++;
    }

    onProgress?.(progress);
  }

  return progress;
}

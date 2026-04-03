import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { RateLimiter } from '../../discovery/rate-limiter.js';
import type {
  BacktestTrade,
  WalletTradeData,
  CollectionProgress,
} from './types.js';

const HELIUS_BASE = 'https://api-mainnet.helius-rpc.com';
const BIRDEYE_BASE = 'https://public-api.birdeye.so';
const TIMEOUT_MS = 15_000;

/** Helius Enhanced Transaction 响应结构（简化） */
interface HeliusTransaction {
  signature?: string;
  timestamp?: number;
  type?: string;
  /** Token transfers within the transaction */
  tokenTransfers?: Array<{
    mint?: string;
    tokenAmount?: number;
    fromUserAccount?: string;
    toUserAccount?: string;
  }>;
  /** Native SOL transfers */
  nativeTransfers?: Array<{
    amount?: number;
    fromUserAccount?: string;
    toUserAccount?: string;
  }>;
}

function normalizeHeliusTrade(address: string, tx: HeliusTransaction): BacktestTrade | null {
  if (!tx.signature) return null;

  // Look for SWAP type transactions (most relevant for backtest)
  const isSwap = tx.type === 'SWAP';
  const isTransfer = tx.type === 'TRANSFER';

  if (!isSwap && !isTransfer) return null;

  // Determine buy/sell from token transfers
  const tokenTransfer = tx.tokenTransfers?.[0];
  if (!tokenTransfer?.mint) return null;

  const isBuy = tokenTransfer.toUserAccount === address;
  const isSell = tokenTransfer.fromUserAccount === address;

  if (!isBuy && !isSell) return null;

  return {
    address,
    signature: tx.signature,
    tokenMint: tokenTransfer.mint,
    type: isBuy ? 'buy' : 'sell',
    timestamp: tx.timestamp ?? 0,
    amount: tokenTransfer.tokenAmount ?? 0,
  };
}

/** Birdeye tx_list 响应结构 */
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
  data?: { items?: BirdeyeTxItem[] };
}

function normalizeBirdeyeTrade(address: string, item: BirdeyeTxItem): BacktestTrade {
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

/** Birdeye wallet/tx_list fallback（Starter 层级以上可用） */
async function collectViaBirdeye(
  apiKey: string,
  address: string,
): Promise<BacktestTrade[]> {
  try {
    const url = `${BIRDEYE_BASE}/v1/wallet/tx_list?wallet=${encodeURIComponent(address)}`;
    const response = await fetch(url, {
      headers: { 'X-API-KEY': apiKey, 'x-chain': 'solana', Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[collect-birdeye] ${address}: HTTP ${response.status} ${response.statusText}`);
      return [];
    }

    const body = (await response.json()) as BirdeyeTxListResponse;
    if (!body.success) return [];

    return (body.data?.items ?? []).map((item) => normalizeBirdeyeTrade(address, item));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[collect-birdeye] ${address}: ${msg}`);
    return [];
  }
}

/**
 * 采集单个钱包的交易历史。
 * 优先使用 Helius Enhanced Transactions API，无 SWAP 数据时 fallback 到 Birdeye。
 * 认证错误(401/403)和限流(429)会抛出终止级错误。
 * 网络超时等非致命错误返回 null。
 */
export async function collectWalletTrades(
  apiKey: string,
  address: string,
  rateLimiter: RateLimiter,
  fallbackApiKey?: string,
): Promise<WalletTradeData | null> {
  await rateLimiter.acquire();

  try {
    const url = `${HELIUS_BASE}/v0/addresses/${encodeURIComponent(address)}/transactions?api-key=${encodeURIComponent(apiKey)}&type=SWAP`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Helius API authentication failed (HTTP ${response.status}). Check your HELIUS_API_KEY.`,
      );
    }

    if (response.status === 429) {
      throw new Error('Helius API rate limit exceeded (HTTP 429). Try again later.');
    }

    if (!response.ok) {
      console.error(`[collect] ${address}: HTTP ${response.status} ${response.statusText}`);
      return null;
    }

    const txns = (await response.json()) as HeliusTransaction[];

    let trades: BacktestTrade[] = [];
    for (const tx of txns) {
      const trade = normalizeHeliusTrade(address, tx);
      if (trade) trades.push(trade);
    }

    // Fallback to Birdeye if Helius returned no trades
    if (trades.length === 0 && fallbackApiKey) {
      console.error(`[collect] ${address}: Helius returned 0 trades, trying Birdeye fallback`);
      trades = await collectViaBirdeye(fallbackApiKey, address);
    }

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
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[collect] ${address}: ${msg}`);
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
  /** Birdeye API key for fallback when Helius returns no data */
  fallbackApiKey?: string;
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
  const { outputDir, rateLimiter, onProgress, fallbackApiKey } = options;

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

    const result = await collectWalletTrades(apiKey, address, rateLimiter, fallbackApiKey);

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

import type { WalletCandidate } from '../types.js';

const BIRDEYE_BASE = 'https://public-api.birdeye.so';
const TIMEOUT_MS = 10_000;

// TODO: Verify actual Birdeye response shapes against API docs at implementation time.
// The interfaces below are best-guess mappings based on known API behavior.

interface BirdeyeTraderItem {
  address?: string;
  wallet?: string;
  pnl?: number;
  realized_pnl?: number;
  win_rate?: number;
  wins?: number;
  losses?: number;
  trade_count?: number;
  total_trades?: number;
  last_active_timestamp?: number;
  last_trade_time?: number;
}

interface BirdeyeTraderResponse {
  success: boolean;
  data?: {
    items?: BirdeyeTraderItem[];
  };
}

interface BirdeyeWalletPnLData {
  wallet?: string;
  pnl?: number;
  realized_pnl?: number;
  win_rate?: number;
  wins?: number;
  losses?: number;
  trade_count?: number;
  total_trades?: number;
  last_active_timestamp?: number;
  last_trade_time?: number;
}

interface BirdeyeWalletPnLResponse {
  success: boolean;
  data?: BirdeyeWalletPnLData;
}

function makeHeaders(apiKey: string): Record<string, string> {
  return {
    'X-API-KEY': apiKey,
    'x-chain': 'solana',
    Accept: 'application/json',
  };
}

function checkAuthError(status: number): void {
  if (status === 401 || status === 403) {
    throw new Error(`Birdeye API authentication failed (HTTP ${status}). Check your BIRDEYE_API_KEY.`);
  }
}

function checkRateLimit(status: number): void {
  if (status === 429) {
    throw new Error('Birdeye API rate limit exceeded (HTTP 429). Try again later.');
  }
}

function normalizeTraderItem(item: BirdeyeTraderItem): WalletCandidate | null {
  const address = item.address ?? item.wallet;
  if (!address) return null;

  const pnl = item.pnl ?? item.realized_pnl ?? 0;

  // Compute winRate: prefer direct win_rate, else derive from wins/losses
  let winRate = item.win_rate ?? 0;
  if (!item.win_rate && (item.wins != null || item.losses != null)) {
    const wins = item.wins ?? 0;
    const losses = item.losses ?? 0;
    const total = wins + losses;
    winRate = total > 0 ? wins / total : 0;
  }

  const tradeCount = item.trade_count ?? item.total_trades ?? 0;
  const lastActiveTimestamp = item.last_active_timestamp ?? item.last_trade_time ?? 0;

  return { address, pnl, winRate, tradeCount, lastActiveTimestamp };
}

/**
 * Fetch top-performing wallets from Birdeye's trader/gainers-losers endpoint.
 * Explicitly requests limit=50 (Starter plan max) to maximise candidate pool.
 * Returns normalized WalletCandidate array, or empty array on non-auth errors.
 */
export async function fetchTopWallets(apiKey: string): Promise<WalletCandidate[]> {
  try {
    const response = await fetch(`${BIRDEYE_BASE}/trader/gainers-losers?limit=10`, {
      headers: makeHeaders(apiKey),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    checkAuthError(response.status);
    checkRateLimit(response.status);

    if (!response.ok) return [];

    const body = (await response.json()) as BirdeyeTraderResponse;

    if (!body.success || !body.data?.items) return [];

    const candidates: WalletCandidate[] = [];
    for (const item of body.data.items) {
      const candidate = normalizeTraderItem(item);
      if (candidate) candidates.push(candidate);
    }

    // Diagnostic: log actual count to help identify plan vs API-default differences
    console.error(`[birdeye] fetchTopWallets: received ${candidates.length} candidates`);

    return candidates;
  } catch (error: unknown) {
    // Re-throw auth and rate limit errors
    if (error instanceof Error && (error.message.includes('authentication failed') || error.message.includes('rate limit'))) {
      throw error;
    }
    return [];
  }
}

/**
 * Fetch PnL data for a single wallet.
 * Returns normalized WalletCandidate or null on non-auth errors.
 */
export async function fetchWalletPnL(apiKey: string, address: string): Promise<WalletCandidate | null> {
  try {
    const url = `${BIRDEYE_BASE}/wallet/v2/pnl?wallet=${encodeURIComponent(address)}`;
    const response = await fetch(url, {
      headers: makeHeaders(apiKey),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    checkAuthError(response.status);
    checkRateLimit(response.status);

    if (!response.ok) return null;

    const body = (await response.json()) as BirdeyeWalletPnLResponse;

    if (!body.success || !body.data) return null;

    const data = body.data;
    const pnl = data.pnl ?? data.realized_pnl ?? 0;

    let winRate = data.win_rate ?? 0;
    if (!data.win_rate && (data.wins != null || data.losses != null)) {
      const wins = data.wins ?? 0;
      const losses = data.losses ?? 0;
      const total = wins + losses;
      winRate = total > 0 ? wins / total : 0;
    }

    const tradeCount = data.trade_count ?? data.total_trades ?? 0;
    const lastActiveTimestamp = data.last_active_timestamp ?? data.last_trade_time ?? 0;

    return { address, pnl, winRate, tradeCount, lastActiveTimestamp };
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes('authentication failed') || error.message.includes('rate limit'))) {
      throw error;
    }
    return null;
  }
}

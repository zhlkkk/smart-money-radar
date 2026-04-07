import type { WalletCandidate } from '../types.js';
import type { RateLimiter } from './rate-limiter.js';

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

interface BirdeyeTokenTrendingResponse {
  success: boolean;
  data?: { tokens?: Array<{ address?: string }> };
}

/**
 * Well-known Solana token mints used as fallback when the trending endpoint
 * is unavailable (non-auth/rate-limit errors).
 */
const FALLBACK_TOKENS: string[] = [
  'So11111111111111111111111111111111111111112',  // Wrapped SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  // mSOL
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // PYTH
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',  // JTO
  'RLBxxFkseAZ4RgJH3Sqn8jXxhmGoz9jWxDNJMh8pL7a',  // RLBB
  'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',  // HNT
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // RAY
];

/**
 * Fetch trending tokens by 24h volume from Birdeye.
 * Makes two requests (offset 0 and 20) to collect up to 40 token mints.
 * On auth/rate-limit errors: re-throw.
 * On other errors: return FALLBACK_TOKENS.
 */
export async function fetchHotTokensByVolume(apiKey: string): Promise<string[]> {
  try {
    const offsets = [0];
    const results = await Promise.allSettled(
      offsets.map(async (offset) => {
        const url = `${BIRDEYE_BASE}/defi/token_trending?sort_by=volume24hUSD&sort_type=desc&offset=${offset}&limit=20`;
        const response = await fetch(url, {
          headers: makeHeaders(apiKey),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        checkAuthError(response.status);
        checkRateLimit(response.status);

        if (!response.ok) return [];

        const body = (await response.json()) as BirdeyeTokenTrendingResponse;

        if (!body.success || !body.data?.tokens) return [];

        return body.data.tokens
          .map((t) => t.address)
          .filter((addr): addr is string => typeof addr === 'string' && addr.length > 0);
      }),
    );

    // Collect fulfilled results; re-throw auth/rate-limit from rejected
    const mints: string[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        mints.push(...result.value);
      } else {
        const err = result.reason;
        if (
          err instanceof Error &&
          (err.message.includes('authentication failed') || err.message.includes('rate limit'))
        ) {
          throw err;
        }
      }
    }

    // Deduplicate
    const unique = [...new Set(mints)];
    console.info(`[birdeye] fetchHotTokensByVolume: received ${unique.length} token mints`);
    return unique.length > 0 ? unique : [...FALLBACK_TOKENS];
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.message.includes('authentication failed') || error.message.includes('rate limit'))
    ) {
      throw error;
    }
    console.error(
      `[birdeye] fetchHotTokensByVolume failed, using fallback tokens:`,
      error instanceof Error ? error.message : String(error),
    );
    return [...FALLBACK_TOKENS];
  }
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
    console.info(`[birdeye] fetchTopWallets: received ${candidates.length} candidates`);

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

/**
 * Response shape for the Birdeye `/defi/v2/tokens/top_traders` endpoint.
 * Fields are camelCase (not snake_case) in the actual API response.
 */
interface BirdeyeTopTraderItem {
  address?: string;
  pnl?: string; // Note: string in this endpoint, needs parseFloat
  winRate?: number;
  tradeCount?: number;
}

interface BirdeyeTopTraderResponse {
  success: boolean;
  data?: {
    traders?: BirdeyeTopTraderItem[];
  };
}

/**
 * Normalize a top_traders item to WalletCandidate.
 * pnl is a string in this endpoint and must be parsed.
 */
export function normalizeTopTraderItem(item: BirdeyeTopTraderItem): WalletCandidate | null {
  const address = item.address;
  if (!address) return null;

  const rawPnl = typeof item.pnl === 'string' ? parseFloat(item.pnl)
    : typeof item.pnl === 'number' ? item.pnl : 0;
  if (!isFinite(rawPnl)) return null;
  const pnl = rawPnl;

  const winRate = item.winRate ?? 0;
  const tradeCount = item.tradeCount ?? 0;
  const lastActiveTimestamp = 0; // Not available in this endpoint

  return { address, pnl, winRate, tradeCount, lastActiveTimestamp };
}

/**
 * Fetch top traders for a specific token from Birdeye.
 * Respects rate limiting via the provided rateLimiter.
 * Auth/rate-limit errors re-throw; other errors return [].
 */
export async function fetchTokenTopTraders(
  apiKey: string,
  mint: string,
  rateLimiter: RateLimiter,
): Promise<WalletCandidate[]> {
  try {
    await rateLimiter.acquire();

    const url = `${BIRDEYE_BASE}/defi/v2/tokens/top_traders?address=${encodeURIComponent(mint)}&time_frame=24h&sort_by=volume&sort_type=desc&limit=10`;
    const response = await fetch(url, {
      headers: makeHeaders(apiKey),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    checkAuthError(response.status);
    checkRateLimit(response.status);

    if (!response.ok) {
      console.warn(`[birdeye] top_traders HTTP ${response.status} for ${mint}`);
      return [];
    }

    const body = (await response.json()) as BirdeyeTopTraderResponse;

    if (!body.success || !body.data?.traders) {
      console.warn(`[birdeye] top_traders empty response for ${mint}`, JSON.stringify(body).slice(0, 300));
      return [];
    }

    const candidates: WalletCandidate[] = [];
    for (const item of body.data.traders) {
      const candidate = normalizeTopTraderItem(item);
      if (candidate) candidates.push(candidate);
    }

    return candidates;
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes('authentication failed') || error.message.includes('rate limit'))) {
      throw error;
    }
    console.warn(`[birdeye] top_traders failed for ${mint}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

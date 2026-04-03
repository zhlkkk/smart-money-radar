// Birdeye token metadata fetcher
// Fallback data source for tokenSymbol when DexScreener has no pair data

const BIRDEYE_BASE = 'https://public-api.birdeye.so';
const TIMEOUT_MS = 2000;

export interface BirdeyeTokenMeta {
  symbol: string | null;
  name: string | null;
}

const NULL_META: BirdeyeTokenMeta = { symbol: null, name: null };

// Simple LRU cache (TTL 5 min, max 2000 entries)
interface CacheEntry {
  data: BirdeyeTokenMeta;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_SIZE = 2000;

function getCached(mint: string): BirdeyeTokenMeta | null {
  const entry = cache.get(mint);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
  return entry.data;
}

function setCache(mint: string, data: BirdeyeTokenMeta): void {
  cache.delete(mint);
  cache.set(mint, { data, timestamp: Date.now() });
  while (cache.size > CACHE_MAX_SIZE) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
}

/** Reset cache — used in tests */
export function resetBirdeyeMetaCache(): void {
  cache.clear();
}

interface BirdeyeMetaResponse {
  success: boolean;
  data?: {
    symbol?: string;
    name?: string;
  };
}

/**
 * Fetch token metadata from Birdeye.
 * Returns null on any failure (never throws).
 */
export async function fetchBirdeyeMetadata(
  tokenMint: string,
  apiKey: string | undefined,
): Promise<BirdeyeTokenMeta | null> {
  if (!apiKey) return null;

  const cached = getCached(tokenMint);
  if (cached) return cached;

  try {
    const url = `${BIRDEYE_BASE}/defi/v3/token/meta-data/single?address=${encodeURIComponent(tokenMint)}`;
    const response = await fetch(url, {
      headers: {
        'X-API-KEY': apiKey,
        'x-chain': 'solana',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as BirdeyeMetaResponse;

    if (!body.success || !body.data) return null;

    const meta: BirdeyeTokenMeta = {
      symbol: body.data.symbol ?? null,
      name: body.data.name ?? null,
    };

    setCache(tokenMint, meta);
    return meta;
  } catch {
    return null;
  }
}

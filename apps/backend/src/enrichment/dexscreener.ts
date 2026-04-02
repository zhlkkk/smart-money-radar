import type { DexScreenerData } from '../types.js';
import { DexCache } from './dex-cache.js';

const DEXSCREENER_BASE = 'https://api.dexscreener.com/tokens/v1/solana';

interface DexScreenerPair {
  baseToken?: { symbol?: string };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  volume?: { h24?: number };
  txns?: { h24?: { buys?: number; sells?: number } };
  pairCreatedAt?: number;
  priceUsd?: string;
}

export const NULL_RESULT: DexScreenerData = {
  tokenSymbol: null, liquidity: null, fdv: null, marketCap: null,
  volume24h: null, txns24h: null, pairCreatedAt: null, priceUsd: null,
};

let dexCache = new DexCache();

/** Reset cache — used in tests to isolate state between test cases. */
export function resetDexCache(): void {
  dexCache = new DexCache();
}

export async function fetchDexScreenerData(mintAddress: string): Promise<DexScreenerData> {
  // 1. Check fresh cache
  const cached = dexCache.get(mintAddress);
  if (cached) return cached;

  // 2. Call API
  try {
    const response = await fetch(`${DEXSCREENER_BASE}/${mintAddress}`, {
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) {
      // API error — try stale cache fallback
      const stale = dexCache.getStale(mintAddress);
      return stale ? { ...stale, stale: true } : NULL_RESULT;
    }

    const pairs: DexScreenerPair[] = await response.json();

    const bestPair = pairs
      .filter((p) => p.liquidity?.usd != null)
      .sort((a, b) => (b.liquidity!.usd! - a.liquidity!.usd!))
      [0];

    if (!bestPair) return NULL_RESULT;

    const data: DexScreenerData = {
      tokenSymbol: bestPair.baseToken?.symbol ?? null,
      liquidity: bestPair.liquidity?.usd ?? null,
      fdv: bestPair.fdv ?? null,
      marketCap: bestPair.marketCap ?? null,
      volume24h: bestPair.volume?.h24 ?? null,
      txns24h: bestPair.txns?.h24?.buys != null && bestPair.txns?.h24?.sells != null
        ? { buys: bestPair.txns.h24.buys, sells: bestPair.txns.h24.sells }
        : null,
      pairCreatedAt: bestPair.pairCreatedAt ?? null,
      priceUsd: bestPair.priceUsd ? Number(bestPair.priceUsd) || null : null,
    };

    // 3. Store in cache
    dexCache.set(mintAddress, data);
    return data;
  } catch {
    // Network/timeout error — try stale cache fallback
    const stale = dexCache.getStale(mintAddress);
    return stale ? { ...stale, stale: true } : NULL_RESULT;
  }
}

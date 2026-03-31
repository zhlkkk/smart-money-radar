import type { DexScreenerData } from '../types.js';

const DEXSCREENER_BASE = 'https://api.dexscreener.com/tokens/v1/solana';

interface DexScreenerPair {
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
}

const NULL_RESULT: DexScreenerData = { liquidity: null, fdv: null, marketCap: null };

export async function fetchDexScreenerData(mintAddress: string): Promise<DexScreenerData> {
  try {
    const response = await fetch(`${DEXSCREENER_BASE}/${mintAddress}`, {
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) return NULL_RESULT;

    const pairs: DexScreenerPair[] = await response.json();

    const bestPair = pairs
      .filter((p) => p.liquidity?.usd != null)
      .sort((a, b) => (b.liquidity!.usd! - a.liquidity!.usd!))
      [0];

    if (!bestPair) return NULL_RESULT;

    return {
      liquidity: bestPair.liquidity?.usd ?? null,
      fdv: bestPair.fdv ?? null,
      marketCap: bestPair.marketCap ?? null,
    };
  } catch {
    return NULL_RESULT;
  }
}

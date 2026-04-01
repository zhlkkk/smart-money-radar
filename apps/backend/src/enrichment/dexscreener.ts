import type { DexScreenerData } from '../types.js';

const DEXSCREENER_BASE = 'https://api.dexscreener.com/tokens/v1/solana';

interface DexScreenerPair {
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  volume?: { h24?: number };
  txns?: { h24?: { buys?: number; sells?: number } };
  pairCreatedAt?: number;
}

const NULL_RESULT: DexScreenerData = {
  liquidity: null, fdv: null, marketCap: null,
  volume24h: null, txns24h: null, pairCreatedAt: null,
};

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
      volume24h: bestPair.volume?.h24 ?? null,
      txns24h: bestPair.txns?.h24?.buys != null && bestPair.txns?.h24?.sells != null
        ? { buys: bestPair.txns.h24.buys, sells: bestPair.txns.h24.sells }
        : null,
      pairCreatedAt: bestPair.pairCreatedAt ?? null,
    };
  } catch {
    return NULL_RESULT;
  }
}

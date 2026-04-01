import { fetchDexScreenerData } from './dexscreener.js';
import { checkAuthorities } from './authority-check.js';
import type { EnrichmentResult } from '../types.js';

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
    ),
  ]);
}

export async function enrichToken(
  tokenMint: string,
  rpc: unknown,
  timeoutMs = 2000,
): Promise<EnrichmentResult> {
  const [dexResult, authResult] = await Promise.allSettled([
    withTimeout(fetchDexScreenerData(tokenMint), timeoutMs),
    withTimeout(checkAuthorities(rpc, tokenMint), timeoutMs),
  ]);

  return {
    liquidity: dexResult.status === 'fulfilled' ? dexResult.value.liquidity : null,
    fdv: dexResult.status === 'fulfilled' ? dexResult.value.fdv : null,
    marketCap: dexResult.status === 'fulfilled' ? dexResult.value.marketCap : null,
    volume24h: dexResult.status === 'fulfilled' ? dexResult.value.volume24h : null,
    txns24h: dexResult.status === 'fulfilled' ? dexResult.value.txns24h : null,
    pairCreatedAt: dexResult.status === 'fulfilled' ? dexResult.value.pairCreatedAt : null,
    mintAuthority: authResult.status === 'fulfilled' ? authResult.value.mintAuthority : 'unchecked',
    freezeAuthority: authResult.status === 'fulfilled' ? authResult.value.freezeAuthority : 'unchecked',
  };
}

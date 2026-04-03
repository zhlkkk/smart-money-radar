import { fetchDexScreenerData } from './dexscreener.js';
import { checkAuthorities } from './authority-check.js';
import { crossValidatePrice } from './cross-validate.js';
import { fetchBirdeyeMetadata } from './birdeye-metadata.js';
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
  birdeyeApiKey?: string,
): Promise<EnrichmentResult> {
  const [dexResult, authResult, crossResult, birdeyeResult] = await Promise.allSettled([
    withTimeout(fetchDexScreenerData(tokenMint), timeoutMs),
    withTimeout(checkAuthorities(rpc, tokenMint), timeoutMs),
    withTimeout(crossValidatePrice(tokenMint), timeoutMs),
    birdeyeApiKey
      ? withTimeout(fetchBirdeyeMetadata(tokenMint, birdeyeApiKey), timeoutMs)
      : Promise.resolve(null),
  ]);

  // 如果 DexScreener 和 Raydium 都返回了价格，计算偏差
  let priceDeviation: number | undefined;
  if (
    dexResult.status === 'fulfilled' &&
    crossResult.status === 'fulfilled' &&
    crossResult.value.onChainPrice != null &&
    crossResult.value.onChainPrice > 0
  ) {
    const dexPrice = dexResult.value.priceUsd;
    if (dexPrice != null && dexPrice > 0) {
      const onChainPrice = crossResult.value.onChainPrice;
      priceDeviation = (Math.abs(dexPrice - onChainPrice) / onChainPrice) * 100;
    }
  }

  // tokenSymbol priority: DexScreener > Birdeye > null
  const dexSymbol = dexResult.status === 'fulfilled' ? dexResult.value.tokenSymbol : null;
  const birdeyeSymbol = birdeyeResult.status === 'fulfilled' && birdeyeResult.value
    ? birdeyeResult.value.symbol
    : null;

  return {
    tokenSymbol: dexSymbol ?? birdeyeSymbol ?? null,
    liquidity: dexResult.status === 'fulfilled' ? dexResult.value.liquidity : null,
    fdv: dexResult.status === 'fulfilled' ? dexResult.value.fdv : null,
    marketCap: dexResult.status === 'fulfilled' ? dexResult.value.marketCap : null,
    volume24h: dexResult.status === 'fulfilled' ? dexResult.value.volume24h : null,
    txns24h: dexResult.status === 'fulfilled' ? dexResult.value.txns24h : null,
    pairCreatedAt: dexResult.status === 'fulfilled' ? dexResult.value.pairCreatedAt : null,
    mintAuthority: authResult.status === 'fulfilled' ? authResult.value.mintAuthority : 'unchecked',
    freezeAuthority: authResult.status === 'fulfilled' ? authResult.value.freezeAuthority : 'unchecked',
    priceDeviation,
    stale: dexResult.status === 'fulfilled' ? dexResult.value.stale : undefined,
  };
}

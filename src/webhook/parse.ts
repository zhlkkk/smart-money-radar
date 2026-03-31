import type { HeliusEnhancedTransaction, ParsedSwap } from '../types.js';

const BASE_TOKEN_MINTS = new Set([
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
]);

// src/webhook/parse.ts
export function parseSwap(tx: any): ParsedSwap | null {
  if (tx?.type !== 'SWAP') return null;
  
  // 防御性检查
  const swapEvent = tx.events?.swap;
  if (!swapEvent) {
    console.warn('⚠️ [parseSwap] No swap event found, skipping');
    return null;
  }

  const tokenOutput = swapEvent.tokenOutputs?.[0];
  if (!tokenOutput?.mint) {
    console.warn('⚠️ [parseSwap] No tokenOutput mint found, skipping');
    return null;
  }

  return {
    signature: tx.signature,
    buyerAddress: tx.feePayer,
    tokenMint: tokenOutput.mint,
    tokenSymbol: tokenOutput.symbol || 'UNKNOWN',
    amountRaw: tokenOutput.amount,
    dexSource: tx.source || 'UNKNOWN',
    timestamp: Date.now(),
  };
}

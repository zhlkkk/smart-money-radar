import type { HeliusEnhancedTransaction, ParsedSwap } from '../types.js';

const BASE_TOKEN_MINTS = new Set([
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
]);

export function parseSwap(
  tx: HeliusEnhancedTransaction,
  watchedAddresses: Set<string>,
): ParsedSwap | null {
  if (tx.type !== 'SWAP') return null;

  const swapEvent = tx.events.swap;
  if (!swapEvent) return null;

  let buyerAddress: string | null = null;

  if (watchedAddresses.has(tx.feePayer)) {
    buyerAddress = tx.feePayer;
  } else {
    for (const output of swapEvent.tokenOutputs) {
      if (watchedAddresses.has(output.userAccount)) {
        buyerAddress = output.userAccount;
        break;
      }
    }
  }

  if (!buyerAddress) return null;

  const interestingOutput = swapEvent.tokenOutputs.find(
    (o) => !BASE_TOKEN_MINTS.has(o.mint),
  );

  if (!interestingOutput) return null;

  return {
    signature: tx.signature,
    buyerAddress,
    tokenMint: interestingOutput.mint,
    amountRaw: interestingOutput.rawTokenAmount.tokenAmount,
    dexSource: tx.source,
    timestamp: tx.timestamp,
  };
}

import type { HeliusEnhancedTransaction, ParsedSwap } from '../types.js';

const BASE_TOKEN_MINTS = new Set([
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
]);

/**
 * Parse a Helius Enhanced Transaction into a ParsedSwap.
 *
 * Strategy:
 *  1. Try events.swap (populated for Jupiter, Raydium, Orca, etc.)
 *  2. Fall back to tokenTransfers (always populated, even for unsupported DEXes)
 *
 * In both paths, find the watched wallet and the "interesting" (non-base) token.
 */
export function parseSwap(
  tx: HeliusEnhancedTransaction,
  watchedAddresses: Set<string>,
): ParsedSwap | null {
  if (tx?.type !== 'SWAP') return null;

  // --- Path 1: events.swap ---
  const swapEvent = tx.events?.swap;
  if (swapEvent?.tokenOutputs?.length) {
    const result = parseFromSwapEvent(tx, swapEvent, watchedAddresses);
    if (result) return result;
    console.debug('[parseSwap] events.swap present but no matching output for watched wallet', {
      signature: tx.signature,
      outputCount: swapEvent.tokenOutputs.length,
    });
  }

  // --- Path 2: tokenTransfers fallback ---
  if (tx.tokenTransfers?.length) {
    const result = parseFromTokenTransfers(tx, watchedAddresses);
    if (result) return result;
    console.debug('[parseSwap] tokenTransfers present but no matching transfer for watched wallet', {
      signature: tx.signature,
      transferCount: tx.tokenTransfers.length,
    });
  }

  console.debug('[parseSwap] No swap data found in events.swap or tokenTransfers', {
    signature: tx.signature,
    source: tx.source,
    hasSwapEvent: !!swapEvent,
    tokenTransferCount: tx.tokenTransfers?.length ?? 0,
  });
  return null;
}

function parseFromSwapEvent(
  tx: HeliusEnhancedTransaction,
  swapEvent: NonNullable<HeliusEnhancedTransaction['events']['swap']>,
  watchedAddresses: Set<string>,
): ParsedSwap | null {
  // Identify buyer: feePayer or any output recipient that's in the watchlist
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

  // Find the non-base-token output (the "interesting" token they bought)
  const interestingOutput = swapEvent.tokenOutputs.find(
    (o) => !BASE_TOKEN_MINTS.has(o.mint),
  );

  if (!interestingOutput?.mint) return null;

  return {
    signature: tx.signature,
    buyerAddress,
    tokenMint: interestingOutput.mint,
    amountRaw: interestingOutput.rawTokenAmount?.tokenAmount,
    dexSource: tx.source ?? 'UNKNOWN',
    timestamp: tx.timestamp ?? Math.floor(Date.now() / 1000),
  };
}

function parseFromTokenTransfers(
  tx: HeliusEnhancedTransaction,
  watchedAddresses: Set<string>,
): ParsedSwap | null {
  // Pass 1: non-base token received BY a watched wallet (toUserAccount)
  for (const transfer of tx.tokenTransfers) {
    if (
      watchedAddresses.has(transfer.toUserAccount) &&
      !BASE_TOKEN_MINTS.has(transfer.mint)
    ) {
      return {
        signature: tx.signature,
        buyerAddress: transfer.toUserAccount,
        tokenMint: transfer.mint,
        amountRaw: transfer.tokenAmount != null ? String(transfer.tokenAmount) : undefined,
        dexSource: tx.source ?? 'UNKNOWN',
        timestamp: tx.timestamp ?? Math.floor(Date.now() / 1000),
      };
    }
  }

  // Pass 2: watched wallet sent base token (fromUserAccount) — find what they received
  // Aggregators like OKX_DEX_ROUTER and TITAN route through intermediate accounts,
  // so the watched wallet appears as sender of SOL/USDC, not direct receiver of the token.
  for (const transfer of tx.tokenTransfers) {
    if (
      watchedAddresses.has(transfer.fromUserAccount) &&
      BASE_TOKEN_MINTS.has(transfer.mint)
    ) {
      // Found the watched wallet paying base token — now find the non-base token in the same tx
      const received = tx.tokenTransfers.find(
        (t) => !BASE_TOKEN_MINTS.has(t.mint),
      );
      if (received) {
        return {
          signature: tx.signature,
          buyerAddress: transfer.fromUserAccount,
          tokenMint: received.mint,
          amountRaw: received.tokenAmount != null ? String(received.tokenAmount) : undefined,
          dexSource: tx.source ?? 'UNKNOWN',
          timestamp: tx.timestamp ?? Math.floor(Date.now() / 1000),
        };
      }
    }
  }

  // Pass 3: feePayer fallback
  if (watchedAddresses.has(tx.feePayer)) {
    const interestingTransfer = tx.tokenTransfers.find(
      (t) => !BASE_TOKEN_MINTS.has(t.mint),
    );
    if (interestingTransfer) {
      return {
        signature: tx.signature,
        buyerAddress: tx.feePayer,
        tokenMint: interestingTransfer.mint,
        amountRaw: interestingTransfer.tokenAmount != null
          ? String(interestingTransfer.tokenAmount)
          : undefined,
        dexSource: tx.source ?? 'UNKNOWN',
        timestamp: tx.timestamp ?? Math.floor(Date.now() / 1000),
      };
    }
  }

  return null;
}

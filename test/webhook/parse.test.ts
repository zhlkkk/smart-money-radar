import { describe, it, expect } from 'vitest';
import { parseSwap } from '../../src/webhook/parse.js';
import type { HeliusEnhancedTransaction } from '../../src/types.js';
import swapFixture from '../fixtures/swap-event.json' with { type: 'json' };

const WATCHED = new Set(['7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB']);
const SOL_MINT = 'So11111111111111111111111111111111111111112';

describe('parseSwap', () => {
  it('parses a valid SWAP from a watched wallet', () => {
    const result = parseSwap(swapFixture as HeliusEnhancedTransaction, WATCHED);
    expect(result).not.toBeNull();
    expect(result!.signature).toBe(swapFixture.signature);
    expect(result!.buyerAddress).toBe('7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB');
    expect(result!.tokenMint).toBe('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
    expect(result!.dexSource).toBe('JUPITER');
  });

  it('returns null for non-SWAP transactions', () => {
    const transfer = { ...swapFixture, type: 'TRANSFER' } as HeliusEnhancedTransaction;
    expect(parseSwap(transfer, WATCHED)).toBeNull();
  });

  it('returns null when feePayer is not in watchlist and no outputs match', () => {
    const tx = {
      ...swapFixture,
      feePayer: 'SomeRandom111111111111111111111111111111111',
      events: {
        swap: {
          ...swapFixture.events.swap,
          tokenOutputs: swapFixture.events.swap.tokenOutputs.map((o) => ({
            ...o,
            userAccount: 'SomeRandom111111111111111111111111111111111',
          })),
        },
      },
    } as HeliusEnhancedTransaction;
    expect(parseSwap(tx, WATCHED)).toBeNull();
  });

  it('returns null when swap events are missing', () => {
    const noEvents = { ...swapFixture, events: {} } as HeliusEnhancedTransaction;
    expect(parseSwap(noEvents, WATCHED)).toBeNull();
  });

  it('skips SOL outputs and finds the interesting token', () => {
    const tx = {
      ...swapFixture,
      events: {
        swap: {
          ...swapFixture.events.swap,
          tokenOutputs: [
            {
              mint: SOL_MINT,
              rawTokenAmount: { decimals: 9, tokenAmount: '1000000000' },
              tokenAccount: 'acc1',
              userAccount: '7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB',
            },
            {
              mint: 'InterestingToken1111111111111111111111111',
              rawTokenAmount: { decimals: 6, tokenAmount: '500000' },
              tokenAccount: 'acc2',
              userAccount: '7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB',
            },
          ],
        },
      },
    } as HeliusEnhancedTransaction;
    const result = parseSwap(tx, WATCHED);
    expect(result).not.toBeNull();
    expect(result!.tokenMint).toBe('InterestingToken1111111111111111111111111');
  });
});

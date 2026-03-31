import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseSwap } from '../../src/webhook/parse.js';
import type { HeliusEnhancedTransaction } from '../../src/types.js';
import swapFixture from '../fixtures/swap-event.json' with { type: 'json' };
import noEventsFixture from '../fixtures/swap-no-events.json' with { type: 'json' };

const WATCHED = new Set([
  '7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB',
  '5JJLDJ9d7WeP4sz6KGNRF3ueEF33dtbsihGVC5eyQu9D',
]);
const SOL_MINT = 'So11111111111111111111111111111111111111112';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseSwap', () => {
  it('parses a valid SWAP from a watched wallet via events.swap', () => {
    const result = parseSwap(swapFixture as HeliusEnhancedTransaction, WATCHED);
    expect(result).not.toBeNull();
    expect(result!.signature).toBe(swapFixture.signature);
    expect(result!.buyerAddress).toBe('7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB');
    expect(result!.tokenMint).toBe('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
    expect(result!.amountRaw).toBe('100000000');
    expect(result!.dexSource).toBe('JUPITER');
    expect(result!.timestamp).toBe(swapFixture.timestamp);
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
      tokenTransfers: swapFixture.tokenTransfers.map((t) => ({
        ...t,
        toUserAccount: 'SomeRandom111111111111111111111111111111111',
      })),
    } as HeliusEnhancedTransaction;
    expect(parseSwap(tx, WATCHED)).toBeNull();
  });

  it('returns null when swap events are missing and no tokenTransfers match', () => {
    const noEvents = {
      ...swapFixture,
      events: {},
      tokenTransfers: [],
    } as unknown as HeliusEnhancedTransaction;
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
    expect(result!.amountRaw).toBe('500000');
  });

  // --- tokenTransfers fallback ---

  it('falls back to tokenTransfers when events.swap is missing', () => {
    const tx = {
      ...swapFixture,
      events: {},
      tokenTransfers: [
        {
          fromUserAccount: 'DEXPool111111111111111111111111111111111111',
          toUserAccount: '7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB',
          fromTokenAccount: 'PoolTokenAcc',
          toTokenAccount: 'UserTokenAcc',
          tokenAmount: 1000.5,
          mint: 'PumpFunToken111111111111111111111111111111',
          tokenStandard: 'Fungible',
        },
      ],
    } as unknown as HeliusEnhancedTransaction;
    const result = parseSwap(tx, WATCHED);
    expect(result).not.toBeNull();
    expect(result!.tokenMint).toBe('PumpFunToken111111111111111111111111111111');
    expect(result!.buyerAddress).toBe('7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB');
    expect(result!.amountRaw).toBe('1000.5');
    expect(result!.dexSource).toBe('JUPITER');
  });

  it('tokenTransfers fallback skips base tokens', () => {
    const tx = {
      ...swapFixture,
      events: {},
      tokenTransfers: [
        {
          fromUserAccount: '7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB',
          toUserAccount: 'DEXPool111111111111111111111111111111111111',
          fromTokenAccount: 'a',
          toTokenAccount: 'b',
          tokenAmount: 1,
          mint: SOL_MINT,
          tokenStandard: 'Fungible',
        },
        {
          fromUserAccount: 'DEXPool111111111111111111111111111111111111',
          toUserAccount: '7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB',
          fromTokenAccount: 'c',
          toTokenAccount: 'd',
          tokenAmount: 42,
          mint: 'NewMemecoin1111111111111111111111111111111',
          tokenStandard: 'Fungible',
        },
      ],
    } as unknown as HeliusEnhancedTransaction;
    const result = parseSwap(tx, WATCHED);
    expect(result).not.toBeNull();
    expect(result!.tokenMint).toBe('NewMemecoin1111111111111111111111111111111');
    expect(result!.amountRaw).toBe('42');
  });

  it('tokenTransfers fallback uses feePayer when toUserAccount is not watched', () => {
    const tx = {
      ...swapFixture,
      feePayer: '7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB',
      events: {},
      tokenTransfers: [
        {
          fromUserAccount: 'DEXPool111111111111111111111111111111111111',
          toUserAccount: 'IntermediaryAcc1111111111111111111111111111',
          fromTokenAccount: 'a',
          toTokenAccount: 'b',
          tokenAmount: 500,
          mint: 'SomeToken111111111111111111111111111111111',
          tokenStandard: 'Fungible',
        },
      ],
    } as unknown as HeliusEnhancedTransaction;
    const result = parseSwap(tx, WATCHED);
    expect(result).not.toBeNull();
    expect(result!.buyerAddress).toBe('7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB');
    expect(result!.tokenMint).toBe('SomeToken111111111111111111111111111111111');
  });

  // --- Defensive edge cases ---

  it('handles empty tokenOutputs in events.swap gracefully', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tx = {
      ...swapFixture,
      events: { swap: { tokenInputs: [], tokenOutputs: [] } },
      tokenTransfers: [],
    } as unknown as HeliusEnhancedTransaction;
    expect(parseSwap(tx, WATCHED)).toBeNull();
    expect(spy).toHaveBeenCalled();
  });

  // --- Fixture-based: Pump.fun swap (no events.swap) ---

  it('parses Pump.fun swap via tokenTransfers fixture', () => {
    const result = parseSwap(noEventsFixture as unknown as HeliusEnhancedTransaction, WATCHED);
    expect(result).not.toBeNull();
    expect(result!.signature).toBe(noEventsFixture.signature);
    expect(result!.buyerAddress).toBe('5JJLDJ9d7WeP4sz6KGNRF3ueEF33dtbsihGVC5eyQu9D');
    expect(result!.tokenMint).toBe('PumpFunToken111111111111111111111111111111');
    expect(result!.amountRaw).toBe('12345.678');
    expect(result!.dexSource).toBe('PUMP_FUN');
    expect(result!.timestamp).toBe(noEventsFixture.timestamp);
  });

  it('identifies buyer from tokenOutput userAccount when feePayer is not watched', () => {
    const tx = {
      ...swapFixture,
      feePayer: 'UnwatchedRelayer11111111111111111111111111',
      events: {
        swap: {
          ...swapFixture.events.swap,
          tokenOutputs: swapFixture.events.swap.tokenOutputs.map((o) => ({
            ...o,
            userAccount: '7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB',
          })),
        },
      },
    } as HeliusEnhancedTransaction;
    const result = parseSwap(tx, WATCHED);
    expect(result).not.toBeNull();
    expect(result!.buyerAddress).toBe('7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB');
  });
});

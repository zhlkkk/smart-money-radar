import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCounterpartyTracker } from '../../src/discovery/counterparty-tracker.js';
import type { HeliusEnhancedTransaction } from '../../src/types.js';

// Silence console output
vi.spyOn(console, 'info').mockImplementation(() => {});

// --- Test helpers ---

interface SwapTxOpts {
  signature?: string;
  feePayer?: string;
  source?: string;
  inputUserAccounts?: string[];
  outputUserAccounts?: string[];
}

function makeSwapTx(opts: SwapTxOpts): HeliusEnhancedTransaction {
  return {
    signature: opts.signature ?? 'sig-swap-' + Math.random().toString(36).slice(2, 8),
    type: 'SWAP',
    source: opts.source ?? 'JUPITER',
    description: '',
    fee: 5000,
    feePayer: opts.feePayer ?? 'monitored-wallet-1',
    slot: 100,
    timestamp: Date.now() / 1000,
    nativeTransfers: [],
    tokenTransfers: [],
    events: {
      swap: {
        tokenInputs: (opts.inputUserAccounts ?? []).map((ua) => ({
          mint: 'mint-A',
          rawTokenAmount: { decimals: 6, tokenAmount: '1000000' },
          tokenAccount: 'ta-' + ua,
          userAccount: ua,
        })),
        tokenOutputs: (opts.outputUserAccounts ?? []).map((ua) => ({
          mint: 'mint-B',
          rawTokenAmount: { decimals: 6, tokenAmount: '2000000' },
          tokenAccount: 'ta-' + ua,
          userAccount: ua,
        })),
      },
    },
    transactionError: null,
  };
}

interface TransferTxOpts {
  signature?: string;
  feePayer?: string;
  source?: string;
  transfers?: { from: string; to: string }[];
}

function makeTransferTx(opts: TransferTxOpts): HeliusEnhancedTransaction {
  return {
    signature: opts.signature ?? 'sig-transfer-' + Math.random().toString(36).slice(2, 8),
    type: 'TRANSFER',
    source: opts.source ?? 'PUMP_FUN',
    description: '',
    fee: 5000,
    feePayer: opts.feePayer ?? 'monitored-wallet-1',
    slot: 100,
    timestamp: Date.now() / 1000,
    nativeTransfers: [],
    tokenTransfers: (opts.transfers ?? []).map((t) => ({
      fromUserAccount: t.from,
      toUserAccount: t.to,
      fromTokenAccount: 'fta-' + t.from,
      toTokenAccount: 'tta-' + t.to,
      tokenAmount: 100,
      mint: 'mint-X',
      tokenStandard: 'Fungible',
    })),
    events: {},
    transactionError: null,
  };
}

// --- Tests ---

describe('CounterpartyTracker', () => {
  const monitoredAddresses = new Set(['wallet-A', 'wallet-B', 'wallet-C', 'wallet-D']);

  describe('happy paths', () => {
    it('returns counterparty seen with >= 3 different monitored wallets', () => {
      const tracker = createCounterpartyTracker();

      // counterparty-X appears in txs from 3 different monitored wallets
      tracker.recordSwap(
        makeSwapTx({
          feePayer: 'wallet-A',
          inputUserAccounts: ['wallet-A'],
          outputUserAccounts: ['counterparty-X'],
        }),
        monitoredAddresses,
      );
      tracker.recordSwap(
        makeSwapTx({
          feePayer: 'wallet-B',
          inputUserAccounts: ['wallet-B'],
          outputUserAccounts: ['counterparty-X'],
        }),
        monitoredAddresses,
      );
      tracker.recordSwap(
        makeSwapTx({
          feePayer: 'wallet-C',
          inputUserAccounts: ['wallet-C'],
          outputUserAccounts: ['counterparty-X'],
        }),
        monitoredAddresses,
      );

      const candidates = tracker.getCandidates();
      expect(candidates).toHaveLength(1);
      expect(candidates[0].address).toBe('counterparty-X');
      expect(candidates[0].sources).toBeDefined();
      expect(candidates[0].sources![0].source).toBe('helius-reverse');
      expect(candidates[0].sources![0].weight).toBe(0.5);
      expect(Number.isNaN(candidates[0].pnl)).toBe(true);
      expect(Number.isNaN(candidates[0].winRate)).toBe(true);
      expect(Number.isNaN(candidates[0].tradeCount)).toBe(true);
    });

    it('extracts counterparties from events.swap path', () => {
      const tracker = createCounterpartyTracker({ minOverlap: 1 });

      tracker.recordSwap(
        makeSwapTx({
          feePayer: 'wallet-A',
          inputUserAccounts: ['wallet-A', 'swap-partner'],
          outputUserAccounts: ['swap-partner'],
        }),
        monitoredAddresses,
      );

      const candidates = tracker.getCandidates();
      expect(candidates).toHaveLength(1);
      expect(candidates[0].address).toBe('swap-partner');
    });

    it('extracts counterparties from tokenTransfers fallback when no events.swap', () => {
      const tracker = createCounterpartyTracker({ minOverlap: 1 });

      tracker.recordSwap(
        makeTransferTx({
          feePayer: 'wallet-A',
          transfers: [{ from: 'wallet-A', to: 'transfer-partner' }],
        }),
        monitoredAddresses,
      );

      const candidates = tracker.getCandidates();
      expect(candidates).toHaveLength(1);
      expect(candidates[0].address).toBe('transfer-partner');
    });
  });

  describe('edge cases', () => {
    it('does not return counterparty with only 2 monitored wallets (< threshold)', () => {
      const tracker = createCounterpartyTracker();

      tracker.recordSwap(
        makeSwapTx({
          feePayer: 'wallet-A',
          inputUserAccounts: ['wallet-A'],
          outputUserAccounts: ['counterparty-Y'],
        }),
        monitoredAddresses,
      );
      tracker.recordSwap(
        makeSwapTx({
          feePayer: 'wallet-B',
          inputUserAccounts: ['wallet-B'],
          outputUserAccounts: ['counterparty-Y'],
        }),
        monitoredAddresses,
      );

      const candidates = tracker.getCandidates();
      expect(candidates).toHaveLength(0);
    });

    it('does not return counterparty seen from same monitored wallet 3 times', () => {
      const tracker = createCounterpartyTracker();

      for (let i = 0; i < 3; i++) {
        tracker.recordSwap(
          makeSwapTx({
            feePayer: 'wallet-A',
            inputUserAccounts: ['wallet-A'],
            outputUserAccounts: ['counterparty-Z'],
          }),
          monitoredAddresses,
        );
      }

      const candidates = tracker.getCandidates();
      expect(candidates).toHaveLength(0);
    });

    it('does not record monitored address as counterparty', () => {
      const tracker = createCounterpartyTracker({ minOverlap: 1 });

      tracker.recordSwap(
        makeSwapTx({
          feePayer: 'wallet-A',
          inputUserAccounts: ['wallet-A'],
          outputUserAccounts: ['wallet-B'], // wallet-B is monitored
        }),
        monitoredAddresses,
      );

      const candidates = tracker.getCandidates();
      expect(candidates).toHaveLength(0);
    });

    it('filters known DEX program addresses', () => {
      const tracker = createCounterpartyTracker({ minOverlap: 1 });

      // Jupiter V6 program should be filtered when source is JUPITER
      tracker.recordSwap(
        makeSwapTx({
          feePayer: 'wallet-A',
          source: 'JUPITER',
          inputUserAccounts: ['wallet-A'],
          outputUserAccounts: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'],
        }),
        monitoredAddresses,
      );

      const candidates = tracker.getCandidates();
      expect(candidates).toHaveLength(0);
    });

    it('auto-excludes high-frequency addresses (> threshold)', () => {
      const tracker = createCounterpartyTracker({
        minOverlap: 1,
        highFrequencyThreshold: 5,
      });

      // Record the same counterparty 6 times (exceeds threshold of 5)
      for (let i = 0; i < 6; i++) {
        const walletKey = `wallet-${String.fromCharCode(65 + (i % 4))}` as string;
        tracker.recordSwap(
          makeSwapTx({
            feePayer: walletKey,
            inputUserAccounts: [walletKey],
            outputUserAccounts: ['hot-address'],
          }),
          monitoredAddresses,
        );
      }

      const candidates = tracker.getCandidates();
      // hot-address should be excluded because globalCounts > 5
      expect(candidates.every((c) => c.address !== 'hot-address')).toBe(true);
    });

    it('cleans expired entries on getCandidates', () => {
      const tracker = createCounterpartyTracker({ minOverlap: 1, windowMs: 1000 });

      tracker.recordSwap(
        makeSwapTx({
          feePayer: 'wallet-A',
          inputUserAccounts: ['wallet-A'],
          outputUserAccounts: ['old-counterparty'],
        }),
        monitoredAddresses,
      );

      // Verify it's tracked
      expect(tracker.getStats().totalTracked).toBe(1);

      // Simulate time passing by manipulating Date.now
      const realNow = Date.now;
      vi.spyOn(Date, 'now').mockReturnValue(realNow() + 2000); // 2s later, past 1s window

      const candidates = tracker.getCandidates();
      expect(candidates).toHaveLength(0);
      expect(tracker.getStats().totalTracked).toBe(0);

      vi.restoreAllMocks();
      // Re-silence console after restoreAllMocks
      vi.spyOn(console, 'info').mockImplementation(() => {});
    });
  });

  describe('error paths', () => {
    it('handles tx with no events.swap and no tokenTransfers gracefully', () => {
      const tracker = createCounterpartyTracker({ minOverlap: 1 });

      const emptyTx: HeliusEnhancedTransaction = {
        signature: 'sig-empty',
        type: 'UNKNOWN',
        source: 'SYSTEM',
        description: '',
        fee: 5000,
        feePayer: 'wallet-A',
        slot: 100,
        timestamp: Date.now() / 1000,
        nativeTransfers: [],
        tokenTransfers: [],
        events: {},
        transactionError: null,
      };

      // Should not throw
      expect(() => tracker.recordSwap(emptyTx, monitoredAddresses)).not.toThrow();
      expect(tracker.getStats().totalTracked).toBe(0);
    });
  });

  describe('integration', () => {
    it('aggregates across multiple recordSwap calls correctly', () => {
      const tracker = createCounterpartyTracker({ minOverlap: 2 });

      // counterparty-1 seen with wallet-A and wallet-B (meets threshold=2)
      tracker.recordSwap(
        makeSwapTx({
          feePayer: 'wallet-A',
          inputUserAccounts: ['wallet-A'],
          outputUserAccounts: ['counterparty-1', 'counterparty-2'],
        }),
        monitoredAddresses,
      );

      tracker.recordSwap(
        makeSwapTx({
          feePayer: 'wallet-B',
          inputUserAccounts: ['wallet-B'],
          outputUserAccounts: ['counterparty-1'],
        }),
        monitoredAddresses,
      );

      // counterparty-2 only seen with wallet-A (below threshold=2)
      const candidates = tracker.getCandidates();
      expect(candidates).toHaveLength(1);
      expect(candidates[0].address).toBe('counterparty-1');

      // Stats should reflect both counterparties tracked
      const stats = tracker.getStats();
      expect(stats.totalTracked).toBe(2); // counterparty-1 and counterparty-2
      expect(stats.totalGlobalCounts).toBe(2);
    });
  });
});

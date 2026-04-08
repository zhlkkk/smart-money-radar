import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCounterpartyTracker } from '../../src/discovery/counterparty-tracker.js';
import { scoreWallets, SOURCE_WEIGHTS, SOURCE_BONUS_WEIGHT } from '../../src/discovery/scoring.js';
import type { HeliusEnhancedTransaction, WalletCandidate, SourceTag } from '../../src/types.js';

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// --- Fixtures ---

const MONITORED = new Set(['smart-1', 'smart-2', 'smart-3', 'smart-4']);
const PINNED = new Set(['pinned-1']);

function makeJupiterSwapTx(
  feePayer: string,
  counterparty: string,
): HeliusEnhancedTransaction {
  return {
    signature: `sig-${Math.random().toString(36).slice(2, 8)}`,
    type: 'SWAP',
    source: 'JUPITER',
    description: '',
    fee: 5000,
    feePayer,
    slot: 100,
    timestamp: Date.now() / 1000,
    nativeTransfers: [],
    tokenTransfers: [],
    events: {
      swap: {
        tokenInputs: [
          {
            mint: 'So11111111111111111111111111111111111111112',
            rawTokenAmount: { decimals: 9, tokenAmount: '1000000000' },
            tokenAccount: `ta-${feePayer}`,
            userAccount: feePayer,
          },
        ],
        tokenOutputs: [
          {
            mint: 'TokenXYZ',
            rawTokenAmount: { decimals: 6, tokenAmount: '5000000' },
            tokenAccount: `ta-${counterparty}`,
            userAccount: counterparty,
          },
        ],
      },
    },
    transactionError: null,
  };
}

function makePumpFunSwapTx(
  feePayer: string,
  counterparty: string,
): HeliusEnhancedTransaction {
  return {
    signature: `sig-${Math.random().toString(36).slice(2, 8)}`,
    type: 'SWAP',
    source: 'PUMP_FUN',
    description: '',
    fee: 5000,
    feePayer,
    slot: 100,
    timestamp: Date.now() / 1000,
    nativeTransfers: [],
    tokenTransfers: [
      {
        fromUserAccount: feePayer,
        toUserAccount: counterparty,
        fromTokenAccount: `fta-${feePayer}`,
        toTokenAccount: `tta-${counterparty}`,
        tokenAmount: 100,
        mint: 'PumpToken123',
        tokenStandard: 'Fungible',
      },
    ],
    events: {},
    transactionError: null,
  };
}

function makeBirdeyeCandidate(
  address: string,
  pnl: number,
  overrides?: Partial<WalletCandidate>,
): WalletCandidate {
  return {
    address,
    pnl,
    winRate: 0.6,
    tradeCount: 50,
    lastActiveTimestamp: Date.now(),
    sources: [{ source: 'birdeye', weight: SOURCE_WEIGHTS['birdeye']!, discoveredAt: Date.now() }],
    ...overrides,
  };
}

// --- Tests ---

describe('multi-source discovery integration', () => {
  it('full flow: counterparty tracking → candidates → scoring with source bonus', () => {
    const tracker = createCounterpartyTracker({ minOverlap: 3 });

    // Simulate 3 different monitored wallets swapping with 'target-whale'
    tracker.recordSwap(makeJupiterSwapTx('smart-1', 'target-whale'), MONITORED);
    tracker.recordSwap(makeJupiterSwapTx('smart-2', 'target-whale'), MONITORED);
    tracker.recordSwap(makePumpFunSwapTx('smart-3', 'target-whale'), MONITORED);

    // Get reverse-discovery candidates
    const reverseCandidates = tracker.getCandidates();
    expect(reverseCandidates).toHaveLength(1);
    expect(reverseCandidates[0]!.address).toBe('target-whale');
    expect(reverseCandidates[0]!.sources![0]!.source).toBe('helius-reverse');
    expect(Number.isNaN(reverseCandidates[0]!.pnl)).toBe(true);

    // Simulate Birdeye also discovering 'target-whale' + other wallets
    const birdeyeCandidates: WalletCandidate[] = [
      makeBirdeyeCandidate('target-whale', 5000),
      makeBirdeyeCandidate('birdeye-only-1', 8000),
      makeBirdeyeCandidate('birdeye-only-2', 3000),
    ];

    // Merge candidates (simulating orchestrator's mergeCandidates)
    const candidateMap = new Map<string, WalletCandidate>();
    for (const c of [...birdeyeCandidates, ...reverseCandidates]) {
      const existing = candidateMap.get(c.address);
      if (!existing) {
        candidateMap.set(c.address, { ...c, sources: [...(c.sources ?? [])] });
      } else {
        // Aggregate sources, keep record with real metrics
        const mergedSources = [...(existing.sources ?? []), ...(c.sources ?? [])];
        if (Number.isNaN(existing.pnl) && !Number.isNaN(c.pnl)) {
          candidateMap.set(c.address, { ...c, sources: mergedSources });
        } else {
          existing.sources = mergedSources;
        }
      }
    }
    const merged = [...candidateMap.values()];

    // Verify merge: target-whale should have 2 sources
    const targetWhaleMerged = merged.find((c) => c.address === 'target-whale')!;
    expect(targetWhaleMerged.sources).toHaveLength(2);
    expect(targetWhaleMerged.pnl).toBe(5000); // Birdeye's real data preserved
    const sourceNames = targetWhaleMerged.sources!.map((s) => s.source).sort();
    expect(sourceNames).toEqual(['birdeye', 'helius-reverse']);

    // Score all candidates
    const scored = scoreWallets(merged, PINNED, [], 30);

    // target-whale (dual source) should score higher than birdeye-only with same pnl
    const targetWhaleScored = scored.find((w) => w.address === 'target-whale')!;
    expect(targetWhaleScored).toBeDefined();
    expect(targetWhaleScored.sources).toHaveLength(2);

    // Find a single-source candidate with lower pnl for comparison
    const birdeyeOnly2 = scored.find((w) => w.address === 'birdeye-only-2')!;
    expect(birdeyeOnly2).toBeDefined();
    expect(targetWhaleScored.compositeScore).toBeGreaterThan(birdeyeOnly2.compositeScore);
  });

  it('reverse-only candidate gets mid-range score (0.5 baseline)', () => {
    const tracker = createCounterpartyTracker({ minOverlap: 2 });

    // 2 monitored wallets interact with the counterparty
    tracker.recordSwap(makeJupiterSwapTx('smart-1', 'reverse-only'), MONITORED);
    tracker.recordSwap(makeJupiterSwapTx('smart-2', 'reverse-only'), MONITORED);

    const candidates = tracker.getCandidates(2);
    expect(candidates).toHaveLength(1);

    // Score as standalone reverse-only candidate
    const scored = scoreWallets(candidates, PINNED, [], 30);
    expect(scored).toHaveLength(1);

    // With all dims at 0.5, baseScore = 0.5, single source → no bonus
    expect(scored[0]!.compositeScore).toBeCloseTo(0.5, 5);
    expect(scored[0]!.label).toBe('Helius-Reverse #1');
  });

  it('pinned wallets remain unaffected by multi-source scoring', () => {
    const birdeyeCandidates = [
      makeBirdeyeCandidate('pinned-1', 99999), // pinned address in candidates
      makeBirdeyeCandidate('regular-1', 5000),
    ];

    const scored = scoreWallets(birdeyeCandidates, PINNED, [], 30);

    // pinned-1 should be excluded from scoring output
    const addresses = scored.map((w) => w.address);
    expect(addresses).not.toContain('pinned-1');
    expect(addresses).toContain('regular-1');
  });

  it('dual-path extraction: Jupiter (events.swap) and Pump.fun (tokenTransfers)', () => {
    const tracker = createCounterpartyTracker({ minOverlap: 2 });

    // Jupiter swap (uses events.swap path)
    tracker.recordSwap(makeJupiterSwapTx('smart-1', 'multi-path-target'), MONITORED);
    // Pump.fun swap (uses tokenTransfers fallback)
    tracker.recordSwap(makePumpFunSwapTx('smart-2', 'multi-path-target'), MONITORED);

    const candidates = tracker.getCandidates(2);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.address).toBe('multi-path-target');
  });

  it('grace period: reverse-only wallet does not block eviction', () => {
    // First cycle: wallet discovered by both sources
    const dualSourceCandidate: WalletCandidate[] = [
      {
        address: 'grace-test',
        pnl: 5000,
        winRate: 0.6,
        tradeCount: 50,
        lastActiveTimestamp: Date.now(),
        sources: [
          { source: 'helius-reverse', weight: 0.5, discoveredAt: Date.now() } as SourceTag,
        ],
      },
    ];

    const cycle1 = scoreWallets(dualSourceCandidate, PINNED, [], 30);
    expect(cycle1).toHaveLength(1);

    // Second cycle: wallet not in candidates (absent)
    // grace period should increment missedCycles
    const cycle2 = scoreWallets([], PINNED, cycle1, 30);
    expect(cycle2).toHaveLength(1);
    expect(cycle2[0]!.missedCycles).toBe(1);

    // Third cycle: still absent → evicted (missedCycles >= MAX_MISSED_CYCLES=2)
    const cycle3 = scoreWallets([], PINNED, cycle2, 30);
    expect(cycle3).toHaveLength(0);
  });
});

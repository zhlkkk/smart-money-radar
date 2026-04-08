import { describe, it, expect } from 'vitest';
import {
  scoreWallets,
  mergeWithPinned,
  normalizeMetric,
  SOURCE_WEIGHTS,
  SOURCE_BONUS_WEIGHT,
  type ScoredWallet,
} from '../../src/discovery/scoring.js';
import type { WalletCandidate, SmartMoneyWallet, SourceTag } from '../../src/types.js';

function makeCandidate(overrides: Partial<WalletCandidate> & { address: string }): WalletCandidate {
  return {
    pnl: 0,
    winRate: 0.5,
    tradeCount: 10,
    lastActiveTimestamp: Date.now(),
    ...overrides,
  };
}

describe('normalizeMetric', () => {
  it('returns percentile ranks normalized to 0-1', () => {
    const result = normalizeMetric([10, 30, 20, 40]);
    // Sorted order: 10(0), 20(1), 30(2), 40(3) → ranks 0/3, 2/3, 1/3, 3/3
    expect(result).toEqual([0, 2 / 3, 1 / 3, 1]);
  });

  it('handles all identical values', () => {
    const result = normalizeMetric([5, 5, 5]);
    // All tied → all get same rank (average), should not crash
    expect(result).toHaveLength(3);
    result.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  it('handles single element', () => {
    const result = normalizeMetric([42]);
    expect(result).toEqual([0]);
  });

  it('handles empty array', () => {
    const result = normalizeMetric([]);
    expect(result).toEqual([]);
  });
});

describe('scoreWallets', () => {
  const pinnedAddresses = new Set<string>(['pinned1', 'pinned2']);
  const walletCap = 30;

  it('scores 50 candidates, selects top 30, sorted by composite descending', () => {
    const candidates: WalletCandidate[] = Array.from({ length: 50 }, (_, i) =>
      makeCandidate({
        address: `wallet${i}`,
        pnl: i * 100,
        winRate: i / 50,
        tradeCount: i * 5,
        lastActiveTimestamp: Date.now() - (50 - i) * 1000,
      }),
    );

    const result = scoreWallets(candidates, pinnedAddresses, [], walletCap);

    expect(result).toHaveLength(walletCap);
    // Verify descending order
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].compositeScore).toBeGreaterThanOrEqual(result[i].compositeScore);
    }
    // All should be discovered
    result.forEach((w) => {
      expect(w.category).toBe('discovered');
      expect(w.source).toBe('discovered');
      expect(w.missedCycles).toBe(0);
    });
  });

  it('excludes pinned addresses from scoring output', () => {
    const candidates: WalletCandidate[] = [
      makeCandidate({ address: 'pinned1', pnl: 999999 }),
      makeCandidate({ address: 'wallet1', pnl: 100 }),
      makeCandidate({ address: 'wallet2', pnl: 50 }),
    ];

    const result = scoreWallets(candidates, pinnedAddresses, [], walletCap);

    const addresses = result.map((w) => w.address);
    expect(addresses).not.toContain('pinned1');
    expect(addresses).toContain('wallet1');
    expect(addresses).toContain('wallet2');
  });

  it('includes all candidates when fewer than cap', () => {
    const candidates: WalletCandidate[] = [
      makeCandidate({ address: 'wallet1', pnl: 100 }),
      makeCandidate({ address: 'wallet2', pnl: 50 }),
    ];

    const result = scoreWallets(candidates, pinnedAddresses, [], walletCap);

    expect(result).toHaveLength(2);
  });

  it('handles all identical scores without crash and maintains stable sort', () => {
    const candidates: WalletCandidate[] = Array.from({ length: 10 }, (_, i) =>
      makeCandidate({
        address: `wallet${i}`,
        pnl: 100,
        winRate: 0.5,
        tradeCount: 10,
        lastActiveTimestamp: Date.now(),
      }),
    );

    const result = scoreWallets(candidates, pinnedAddresses, [], walletCap);

    expect(result).toHaveLength(10);
    // Should not crash; all scores equal
    const scores = result.map((w) => w.compositeScore);
    const unique = new Set(scores);
    expect(unique.size).toBe(1);
  });

  it('keeps wallet absent 1 cycle with missedCycles = 1', () => {
    const previousDiscovered: ScoredWallet[] = [
      {
        address: 'oldWallet',
        label: 'Birdeye #1',
        category: 'discovered',
        compositeScore: 0.8,
        missedCycles: 0,
        source: 'discovered',
      },
    ];

    // oldWallet is NOT in new candidates
    const candidates: WalletCandidate[] = [
      makeCandidate({ address: 'newWallet', pnl: 100 }),
    ];

    const result = scoreWallets(candidates, pinnedAddresses, previousDiscovered, walletCap);

    const old = result.find((w) => w.address === 'oldWallet');
    expect(old).toBeDefined();
    expect(old!.missedCycles).toBe(1);
  });

  it('removes wallet absent 2 cycles', () => {
    const previousDiscovered: ScoredWallet[] = [
      {
        address: 'dyingWallet',
        label: 'Birdeye #1',
        category: 'discovered',
        compositeScore: 0.8,
        missedCycles: 1, // already missed 1 cycle
        source: 'discovered',
      },
    ];

    const candidates: WalletCandidate[] = [
      makeCandidate({ address: 'newWallet', pnl: 100 }),
    ];

    const result = scoreWallets(candidates, pinnedAddresses, previousDiscovered, walletCap);

    const dying = result.find((w) => w.address === 'dyingWallet');
    expect(dying).toBeUndefined();
  });

  it('resets missedCycles to 0 when wallet returns after 1 absence', () => {
    const previousDiscovered: ScoredWallet[] = [
      {
        address: 'returningWallet',
        label: 'Birdeye #1',
        category: 'discovered',
        compositeScore: 0.5,
        missedCycles: 1,
        source: 'discovered',
      },
    ];

    const candidates: WalletCandidate[] = [
      makeCandidate({ address: 'returningWallet', pnl: 200 }),
    ];

    const result = scoreWallets(candidates, pinnedAddresses, previousDiscovered, walletCap);

    const returning = result.find((w) => w.address === 'returningWallet');
    expect(returning).toBeDefined();
    expect(returning!.missedCycles).toBe(0);
  });

  it('returns only grace-period wallets when candidates is empty', () => {
    const previousDiscovered: ScoredWallet[] = [
      {
        address: 'graceWallet',
        label: 'Birdeye #1',
        category: 'discovered',
        compositeScore: 0.7,
        missedCycles: 0,
        source: 'discovered',
      },
    ];

    const result = scoreWallets([], pinnedAddresses, previousDiscovered, walletCap);

    expect(result).toHaveLength(1);
    expect(result[0].address).toBe('graceWallet');
    expect(result[0].missedCycles).toBe(1);
  });

  it('assigns labels as "Birdeye #${rank}" based on position', () => {
    const candidates: WalletCandidate[] = [
      makeCandidate({ address: 'wallet1', pnl: 200 }),
      makeCandidate({ address: 'wallet2', pnl: 100 }),
    ];

    const result = scoreWallets(candidates, pinnedAddresses, [], walletCap);

    expect(result[0].label).toBe('Birdeye #1');
    expect(result[1].label).toBe('Birdeye #2');
  });
});

describe('scoreWallets — multi-source scoring', () => {
  const pinnedAddresses = new Set<string>(['pinned1']);
  const walletCap = 30;

  function makeSourceTag(source: string, weight?: number): SourceTag {
    return {
      source,
      weight: weight ?? SOURCE_WEIGHTS[source] ?? 0.5,
      discoveredAt: Date.now(),
    };
  }

  it('single-source (birdeye) candidate has no bonus — score unchanged', () => {
    const candidates: WalletCandidate[] = [
      makeCandidate({
        address: 'w1',
        pnl: 100,
        sources: [makeSourceTag('birdeye')],
      }),
      makeCandidate({
        address: 'w2',
        pnl: 50,
        sources: [makeSourceTag('birdeye')],
      }),
    ];

    const withSources = scoreWallets(candidates, pinnedAddresses, [], walletCap);

    // Same candidates without sources (backward compat path)
    const withoutSources = scoreWallets(
      candidates.map(({ sources: _s, ...rest }) => rest as WalletCandidate),
      pinnedAddresses,
      [],
      walletCap,
    );

    // Scores should be identical — single source gets no bonus
    expect(withSources[0].compositeScore).toBeCloseTo(withoutSources[0].compositeScore, 10);
    expect(withSources[1].compositeScore).toBeCloseTo(withoutSources[1].compositeScore, 10);
  });

  it('dual-source candidate scores higher than single-source', () => {
    const singleSource: WalletCandidate[] = [
      makeCandidate({
        address: 'single',
        pnl: 100,
        winRate: 0.6,
        tradeCount: 20,
        sources: [makeSourceTag('birdeye')],
      }),
      makeCandidate({ address: 'filler', pnl: 50 }), // need 2+ for normalization
    ];

    const dualSource: WalletCandidate[] = [
      makeCandidate({
        address: 'dual',
        pnl: 100,
        winRate: 0.6,
        tradeCount: 20,
        sources: [makeSourceTag('birdeye'), makeSourceTag('helius-reverse')],
      }),
      makeCandidate({ address: 'filler', pnl: 50 }),
    ];

    const singleResult = scoreWallets(singleSource, pinnedAddresses, [], walletCap);
    const dualResult = scoreWallets(dualSource, pinnedAddresses, [], walletCap);

    const singleScore = singleResult.find((w) => w.address === 'single')!.compositeScore;
    const dualScore = dualResult.find((w) => w.address === 'dual')!.compositeScore;

    expect(dualScore).toBeGreaterThan(singleScore);
  });

  it('sources undefined (backward compat) → no bonus', () => {
    const candidates: WalletCandidate[] = [
      makeCandidate({ address: 'legacy', pnl: 100 }), // no sources field
      makeCandidate({ address: 'filler', pnl: 50 }),
    ];

    const result = scoreWallets(candidates, pinnedAddresses, [], walletCap);
    const legacy = result.find((w) => w.address === 'legacy')!;

    // Should have empty sources array
    expect(legacy.sources).toEqual([]);
    // Label defaults to 'Birdeye'
    expect(legacy.label).toMatch(/^Birdeye #\d+$/);
  });

  it('helius-reverse-only candidates get fixed 0.5 normalized values', () => {
    const candidates: WalletCandidate[] = [
      makeCandidate({
        address: 'reverse1',
        pnl: NaN,
        winRate: NaN,
        tradeCount: NaN,
        sources: [makeSourceTag('helius-reverse')],
      }),
    ];

    const result = scoreWallets(candidates, pinnedAddresses, [], walletCap);

    // With all 4 dimensions at 0.5, baseScore = 0.35*0.5 + 0.30*0.5 + 0.20*0.5 + 0.15*0.5 = 0.5
    // Single source → no bonus → compositeScore = 0.5
    expect(result).toHaveLength(1);
    expect(result[0].compositeScore).toBeCloseTo(0.5, 5);
  });

  it('reverse-only candidates do not pollute Birdeye percentile rankings', () => {
    // Two Birdeye candidates with distinct PnL: 100 and 200
    // If reverse-only (NaN) was included in normalizeMetric, rankings would shift
    const birdeyeOnly: WalletCandidate[] = [
      makeCandidate({ address: 'b1', pnl: 100, sources: [makeSourceTag('birdeye')] }),
      makeCandidate({ address: 'b2', pnl: 200, sources: [makeSourceTag('birdeye')] }),
    ];

    const withReverse: WalletCandidate[] = [
      ...birdeyeOnly,
      makeCandidate({
        address: 'r1',
        pnl: NaN,
        winRate: NaN,
        tradeCount: NaN,
        sources: [makeSourceTag('helius-reverse')],
      }),
    ];

    const resultWithout = scoreWallets(birdeyeOnly, pinnedAddresses, [], walletCap);
    const resultWith = scoreWallets(withReverse, pinnedAddresses, [], walletCap);

    const b1Without = resultWithout.find((w) => w.address === 'b1')!.compositeScore;
    const b1With = resultWith.find((w) => w.address === 'b1')!.compositeScore;
    const b2Without = resultWithout.find((w) => w.address === 'b2')!.compositeScore;
    const b2With = resultWith.find((w) => w.address === 'b2')!.compositeScore;

    // Birdeye candidate scores should be identical regardless of reverse-only presence
    expect(b1With).toBeCloseTo(b1Without, 10);
    expect(b2With).toBeCloseTo(b2Without, 10);
  });

  it('label reflects primary source name by highest weight', () => {
    const candidates: WalletCandidate[] = [
      makeCandidate({
        address: 'multi',
        pnl: 100,
        sources: [makeSourceTag('helius-reverse'), makeSourceTag('birdeye')],
      }),
    ];

    const result = scoreWallets(candidates, pinnedAddresses, [], walletCap);

    // Birdeye has weight 0.7 > helius-reverse 0.5 → primary is 'Birdeye'
    expect(result[0].label).toBe('Birdeye #1');
  });

  it('label shows Helius-Reverse when it is the only source', () => {
    const candidates: WalletCandidate[] = [
      makeCandidate({
        address: 'rev',
        pnl: NaN,
        winRate: NaN,
        tradeCount: NaN,
        sources: [makeSourceTag('helius-reverse')],
      }),
    ];

    const result = scoreWallets(candidates, pinnedAddresses, [], walletCap);
    expect(result[0].label).toBe('Helius-Reverse #1');
  });

  it('empty candidates array returns empty', () => {
    const result = scoreWallets([], pinnedAddresses, [], walletCap);
    expect(result).toEqual([]);
  });
});

describe('mergeWithPinned', () => {
  it('produces correct combined Map from pinned and discovered', () => {
    const pinned = new Map<string, SmartMoneyWallet>([
      ['pinned1', { label: 'Whale A', category: 'whale' }],
      ['pinned2', { label: 'Insider B', category: 'insider' }],
    ]);

    const discovered: ScoredWallet[] = [
      {
        address: 'disc1',
        label: 'Birdeye #1',
        category: 'discovered',
        compositeScore: 0.9,
        missedCycles: 0,
        source: 'discovered',
      },
      {
        address: 'disc2',
        label: 'Birdeye #2',
        category: 'discovered',
        compositeScore: 0.7,
        missedCycles: 0,
        source: 'discovered',
      },
    ];

    const result = mergeWithPinned(pinned, discovered);

    expect(result.size).toBe(4);
    expect(result.get('pinned1')).toEqual({ label: 'Whale A', category: 'whale' });
    expect(result.get('pinned2')).toEqual({ label: 'Insider B', category: 'insider' });
    expect(result.get('disc1')).toEqual({ label: 'Birdeye #1', category: 'discovered' });
    expect(result.get('disc2')).toEqual({ label: 'Birdeye #2', category: 'discovered' });
  });

  it('pinned wallets override discovered with same address', () => {
    const pinned = new Map<string, SmartMoneyWallet>([
      ['overlap', { label: 'Pinned Label', category: 'whale' }],
    ]);

    const discovered: ScoredWallet[] = [
      {
        address: 'overlap',
        label: 'Birdeye #1',
        category: 'discovered',
        compositeScore: 0.9,
        missedCycles: 0,
        source: 'discovered',
      },
    ];

    const result = mergeWithPinned(pinned, discovered);

    expect(result.size).toBe(1);
    expect(result.get('overlap')).toEqual({ label: 'Pinned Label', category: 'whale' });
  });

  it('handles empty discovered list', () => {
    const pinned = new Map<string, SmartMoneyWallet>([
      ['pinned1', { label: 'Whale A', category: 'whale' }],
    ]);

    const result = mergeWithPinned(pinned, []);

    expect(result.size).toBe(1);
  });
});

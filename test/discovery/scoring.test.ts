import { describe, it, expect } from 'vitest';
import {
  scoreWallets,
  mergeWithPinned,
  normalizeMetric,
  type ScoredWallet,
} from '../../src/discovery/scoring.js';
import type { WalletCandidate, SmartMoneyWallet } from '../../src/types.js';

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

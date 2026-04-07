import type { SmartMoneyWallet, WalletCandidate } from '../types.js';

export interface ScoredWallet {
  address: string;
  label: string;
  category: string;
  compositeScore: number;
  missedCycles: number;
  source: 'pinned' | 'discovered';
  pnl?: number;
  winRate?: number;
  tradeCount?: number;
}

export interface DiscoveryState {
  discovered: ScoredWallet[];
  lastRefresh: number; // timestamp ms
}

// Weights for composite score
const WEIGHT_PNL = 0.35;
const WEIGHT_WIN_RATE = 0.30;
const WEIGHT_TRADE_COUNT = 0.20;
const WEIGHT_RECENCY = 0.15;

const MAX_MISSED_CYCLES = 2;

/**
 * Percentile rank normalization.
 * For each value, its normalized score is (number of values strictly less than it) / (n - 1).
 * Single element returns [0]. Empty returns [].
 */
export function normalizeMetric(values: number[]): number[] {
  const n = values.length;
  if (n <= 1) return values.map(() => 0);

  // Build sorted copy with indices for ranking
  const indexed = values.map((v, i) => ({ value: v, index: i }));
  indexed.sort((a, b) => a.value - b.value);

  const ranks = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    // Count how many values are strictly less than this one
    // Since sorted, find first occurrence of this value
    let firstOccurrence = i;
    while (firstOccurrence > 0 && indexed[firstOccurrence - 1].value === indexed[i].value) {
      firstOccurrence--;
    }
    // The rank for tied values = position of first occurrence / (n-1)
    ranks[indexed[i].index] = firstOccurrence / (n - 1);
  }

  return ranks;
}

/**
 * Score and select top discovered wallets from candidates.
 *
 * - Filters out pinned addresses
 * - Normalizes metrics via percentile ranking
 * - Computes composite score with weighted sum
 * - Applies grace period for previously discovered wallets not in current candidates
 * - Caps output at walletCap
 */
export function scoreWallets(
  candidates: WalletCandidate[],
  pinnedAddresses: Set<string>,
  currentDiscovered: ScoredWallet[],
  walletCap: number,
): ScoredWallet[] {
  // Filter out pinned addresses
  const filtered = candidates.filter((c) => !pinnedAddresses.has(c.address));
  const candidateAddresses = new Set(filtered.map((c) => c.address));

  // Score new candidates
  let scored: ScoredWallet[] = [];

  if (filtered.length > 0) {
    const now = Date.now();

    const pnlValues = filtered.map((c) => c.pnl);
    const winRateValues = filtered.map((c) => c.winRate);
    const tradeCountValues = filtered.map((c) => c.tradeCount);
    // Recency: more recent = higher value. Convert to "how recent" by negating age.
    const recencyValues = filtered.map((c) => -(now - c.lastActiveTimestamp));

    const normPnl = normalizeMetric(pnlValues);
    const normWinRate = normalizeMetric(winRateValues);
    const normTradeCount = normalizeMetric(tradeCountValues);
    const normRecency = normalizeMetric(recencyValues);

    scored = filtered.map((c, i) => {
      const compositeScore =
        WEIGHT_PNL * normPnl[i] +
        WEIGHT_WIN_RATE * normWinRate[i] +
        WEIGHT_TRADE_COUNT * normTradeCount[i] +
        WEIGHT_RECENCY * normRecency[i];

      // Check if this wallet was previously discovered (reset missedCycles)
      const prev = currentDiscovered.find((d) => d.address === c.address);

      return {
        address: c.address,
        label: '', // placeholder, assigned after sorting
        category: 'discovered',
        compositeScore,
        missedCycles: prev ? 0 : 0, // present in candidates → always 0
        source: 'discovered' as const,
        pnl: c.pnl,
        winRate: c.winRate,
        tradeCount: c.tradeCount,
      };
    });
  }

  // Grace period: wallets in currentDiscovered but NOT in new candidates
  const graceWallets: ScoredWallet[] = [];
  for (const prev of currentDiscovered) {
    if (candidateAddresses.has(prev.address)) continue; // already scored above
    if (pinnedAddresses.has(prev.address)) continue;

    const newMissedCycles = prev.missedCycles + 1;
    if (newMissedCycles >= MAX_MISSED_CYCLES) continue; // evict

    graceWallets.push({
      ...prev,
      missedCycles: newMissedCycles,
    });
  }

  // Combine and sort by composite score descending
  const combined = [...scored, ...graceWallets];
  combined.sort((a, b) => b.compositeScore - a.compositeScore);

  // Cap at walletCap
  const capped = combined.slice(0, walletCap);

  // Assign rank-based labels
  for (let i = 0; i < capped.length; i++) {
    capped[i].label = `Birdeye #${i + 1}`;
  }

  return capped;
}

/**
 * Merge pinned wallets with discovered wallets into a single Map.
 * Pinned wallets always take priority over discovered.
 */
export function mergeWithPinned(
  pinned: Map<string, SmartMoneyWallet>,
  discovered: ScoredWallet[],
): Map<string, SmartMoneyWallet> {
  const merged = new Map<string, SmartMoneyWallet>();

  // Add discovered first so pinned can override
  for (const wallet of discovered) {
    merged.set(wallet.address, {
      label: wallet.label,
      category: wallet.category,
    });
  }

  // Pinned always wins
  for (const [address, wallet] of pinned) {
    merged.set(address, wallet);
  }

  return merged;
}

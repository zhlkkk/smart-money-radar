import type { SmartMoneyWallet, SourceTag, WalletCandidate } from '../types.js';

export interface ScoredWallet {
  address: string;
  label: string;
  category: string;
  compositeScore: number;
  missedCycles: number;
  source: 'pinned' | 'discovered';
  sources: SourceTag[];
  pnl?: number;
  winRate?: number;
  tradeCount?: number;
}

export interface DiscoveryState {
  discovered: ScoredWallet[];
  lastRefresh: number; // timestamp ms
}

// Source weights for multi-source discovery
export const SOURCE_WEIGHTS: Record<string, number> = {
  birdeye: 0.7,
  'helius-reverse': 0.5,
};

export const SOURCE_BONUS_WEIGHT = 0.2;

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
    const current = indexed[i]!;
    let firstOccurrence = i;
    while (firstOccurrence > 0 && indexed[firstOccurrence - 1]!.value === current.value) {
      firstOccurrence--;
    }
    ranks[current.index] = firstOccurrence / (n - 1);
  }

  return ranks;
}

// Max possible source weight sum for bonus normalization
const MAX_SOURCE_WEIGHT_SUM = Object.values(SOURCE_WEIGHTS).reduce((a, b) => a + b, 0);

/**
 * Check if a candidate is helius-reverse-only (no quality data sources).
 * Candidates with undefined/empty sources are treated as Birdeye (backward compat).
 */
function isReverseOnly(candidate: WalletCandidate): boolean {
  const sources: SourceTag[] = candidate.sources ?? [];
  return sources.length > 0 && sources.every((s: SourceTag) => s.source === 'helius-reverse');
}

/**
 * Compute source bonus for multi-source candidates.
 * Single source → 0 (no bonus). Multiple sources → normalized weight sum × SOURCE_BONUS_WEIGHT.
 */
function computeSourceBonus(sources: SourceTag[]): number {
  if (sources.length < 2) return 0;
  const weightSum = sources.reduce((sum, s: SourceTag) => sum + s.weight, 0);
  return (weightSum / MAX_SOURCE_WEIGHT_SUM) * SOURCE_BONUS_WEIGHT;
}

/**
 * Get the primary source label (highest weight) from sources array.
 * Returns 'Birdeye' for undefined/empty sources (backward compat).
 */
function getPrimarySourceLabel(sources: SourceTag[]): string {
  if (sources.length === 0) return 'Birdeye';
  const primary = sources.reduce((best, s) => (s.weight > best.weight ? s : best));
  // Title Case: 'helius-reverse' → 'Helius-Reverse'
  return primary.source.replace(/(^|-)(\w)/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * Score and select top discovered wallets from candidates.
 *
 * - Filters out pinned addresses
 * - Separates helius-reverse-only candidates from quality-data candidates
 * - Normalizes metrics via percentile ranking (quality candidates only)
 * - Assigns fixed 0.5 normalized values for reverse-only candidates
 * - Computes composite score with weighted sum + multi-source bonus
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

    // Separate candidates: quality-data (Birdeye) vs reverse-only (helius-reverse)
    const qualityCandidates: WalletCandidate[] = [];
    const reverseOnlyCandidates: WalletCandidate[] = [];
    for (const c of filtered) {
      if (isReverseOnly(c)) {
        reverseOnlyCandidates.push(c);
      } else {
        qualityCandidates.push(c);
      }
    }

    // Normalize only quality candidates (preserves their percentile rankings)
    const qNormPnl = normalizeMetric(qualityCandidates.map((c) => c.pnl));
    const qNormWinRate = normalizeMetric(qualityCandidates.map((c) => c.winRate));
    const qNormTradeCount = normalizeMetric(qualityCandidates.map((c) => c.tradeCount));
    const qNormRecency = normalizeMetric(
      qualityCandidates.map((c) => -(now - c.lastActiveTimestamp)),
    );

    // Score quality candidates
    for (let i = 0; i < qualityCandidates.length; i++) {
      const c = qualityCandidates[i]!;
      const baseScore =
        WEIGHT_PNL * qNormPnl[i]! +
        WEIGHT_WIN_RATE * qNormWinRate[i]! +
        WEIGHT_TRADE_COUNT * qNormTradeCount[i]! +
        WEIGHT_RECENCY * qNormRecency[i]!;

      const sources = c.sources ?? [];
      const bonus = computeSourceBonus(sources);
      const compositeScore = baseScore * (1 + bonus);

      scored.push({
        address: c.address,
        label: '', // assigned after sorting
        category: 'discovered',
        compositeScore,
        missedCycles: 0,
        source: 'discovered' as const,
        sources,
        pnl: c.pnl,
        winRate: c.winRate,
        tradeCount: c.tradeCount,
      });
    }

    // Score reverse-only candidates with fixed 0.5 normalized values
    for (const c of reverseOnlyCandidates) {
      const baseScore =
        WEIGHT_PNL * 0.5 +
        WEIGHT_WIN_RATE * 0.5 +
        WEIGHT_TRADE_COUNT * 0.5 +
        WEIGHT_RECENCY * 0.5;

      const sources = c.sources ?? [];
      // Single source (helius-reverse only) → no bonus
      const bonus = computeSourceBonus(sources);
      const compositeScore = baseScore * (1 + bonus);

      scored.push({
        address: c.address,
        label: '',
        category: 'discovered',
        compositeScore,
        missedCycles: 0,
        source: 'discovered' as const,
        sources,
        pnl: c.pnl,
        winRate: c.winRate,
        tradeCount: c.tradeCount,
      });
    }
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

  // Assign rank-based labels with dynamic source name
  for (let i = 0; i < capped.length; i++) {
    const wallet = capped[i]!;
    const primarySource = getPrimarySourceLabel(wallet.sources ?? []);
    wallet.label = `${primarySource} #${i + 1}`;
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

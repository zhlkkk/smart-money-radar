import type { HeliusEnhancedTransaction, SmartMoneyWallet, WalletCandidate, WalletStateRef } from '../types.js';
import type { PoolDatabase } from '@radar/db';
import { createWalletState } from '../types.js';
import { fetchTopWallets, fetchHotTokensByVolume, fetchTokenTopTraders } from './birdeye.js';
import { createRateLimiter } from './rate-limiter.js';
import { updateHeliusWebhookAddresses } from './helius-webhooks.js';
import { scoreWallets, mergeWithPinned, SOURCE_WEIGHTS } from './scoring.js';
import type { DiscoveryState, ScoredWallet } from './scoring.js';
import { loadDiscoveryState, saveDiscoveryState } from './persistence.js';
import { syncTrackedWallets, deactivateWallets } from '../persistence/wallets.js';
import { createCounterpartyTracker } from './counterparty-tracker.js';
import type { CounterpartyTracker } from './counterparty-tracker.js';

/**
 * A discovery provider returns wallet candidates from a single data source.
 * Each provider is responsible for tagging its candidates with the correct SourceTag.
 */
export interface DiscoveryProvider {
  name: string;
  source: string;
  fetch: () => Promise<WalletCandidate[]>;
}

export interface DiscoveryConfig {
  walletStateRef: WalletStateRef;
  pinnedWallets: Map<string, SmartMoneyWallet>;
  birdeyeApiKey: string;
  heliusApiKey: string;
  heliusWebhookId: string;
  statePath: string;
  intervalMs: number;
  walletCap: number;
  db: PoolDatabase | null;
  /** Override for testing — if not provided, a tracker is created internally */
  counterpartyTracker?: CounterpartyTracker;
}

const STARTUP_DEBOUNCE_MS = 30_000;

/**
 * Merge candidates from multiple providers, deduplicating by address.
 * When the same address appears from multiple providers:
 * - Keep the record with the most complete metrics (non-NaN pnl preferred)
 * - Aggregate all SourceTags into the sources array
 */
function mergeCandidates(providerResults: WalletCandidate[][]): WalletCandidate[] {
  const candidateMap = new Map<string, WalletCandidate>();

  for (const candidates of providerResults) {
    for (const c of candidates) {
      const existing = candidateMap.get(c.address);
      if (!existing) {
        candidateMap.set(c.address, { ...c, sources: [...(c.sources ?? [])] });
        continue;
      }

      // Aggregate sources from all providers
      const mergedSources = [...(existing.sources ?? []), ...(c.sources ?? [])];

      // Keep the record with real metrics (non-NaN pnl) as the base
      if (Number.isNaN(existing.pnl) && !Number.isNaN(c.pnl)) {
        candidateMap.set(c.address, { ...c, sources: mergedSources });
      } else if (!Number.isNaN(existing.pnl) && !Number.isNaN(c.pnl) && c.pnl > existing.pnl) {
        candidateMap.set(c.address, { ...c, sources: mergedSources });
      } else {
        existing.sources = mergedSources;
        // Update lastActiveTimestamp to the more recent one
        if (c.lastActiveTimestamp > existing.lastActiveTimestamp) {
          existing.lastActiveTimestamp = c.lastActiveTimestamp;
        }
      }
    }
  }

  return [...candidateMap.values()];
}


export function createDiscovery(config: DiscoveryConfig) {
  let running = false;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let currentDiscovered: ScoredWallet[] = [];
  let cycleCount = 0;

  // Rate limiter for Birdeye top_traders calls (Starter plan: 15 rps global)
  const birdeyeRateLimiter = createRateLimiter(10);

  // CounterpartyTracker for helius reverse discovery
  const counterpartyTracker = config.counterpartyTracker ?? createCounterpartyTracker();

  // Load persisted state if available, normalize sources for backward compat
  const persisted = loadDiscoveryState(config.statePath);
  if (persisted) {
    currentDiscovered = persisted.discovered.map((w) => ({
      ...w,
      sources: w.sources ?? [],
    }));
    console.info(`[discovery] Loaded ${currentDiscovered.length} discovered wallets from persisted state`);
  }

  // Apply persisted discovered wallets to pipeline state immediately
  if (currentDiscovered.length > 0) {
    const merged = mergeWithPinned(config.pinnedWallets, currentDiscovered);
    config.walletStateRef.current = createWalletState(merged);
    console.info(`[discovery] Pipeline initialized with ${merged.size} total wallets (${config.pinnedWallets.size} pinned + ${currentDiscovered.length} discovered)`);
  }

  // Build provider array
  function buildProviders(): DiscoveryProvider[] {
    const providers: DiscoveryProvider[] = [];

    // Birdeye provider: gainers-losers + top_traders
    providers.push({
      name: 'birdeye',
      source: 'birdeye',
      fetch: async () => {
        const gainersLosers = await fetchTopWallets(config.birdeyeApiKey);
        const hotTokens = await fetchHotTokensByVolume(config.birdeyeApiKey);

        const topTraderResults = await Promise.allSettled(
          hotTokens.map((mint) =>
            fetchTokenTopTraders(config.birdeyeApiKey, mint, birdeyeRateLimiter),
          ),
        );

        // Re-throw auth errors — these won't self-resolve
        for (const r of topTraderResults) {
          if (r.status === 'rejected' && r.reason instanceof Error) {
            if (r.reason.message.includes('authentication failed')) {
              throw r.reason;
            }
            if (r.reason.message.includes('rate limit')) {
              console.warn('[discovery] Birdeye rate limit hit, continuing with partial data');
            }
          }
        }

        const topTraderCandidates = topTraderResults
          .filter(
            (r): r is PromiseFulfilledResult<WalletCandidate[]> => r.status === 'fulfilled',
          )
          .flatMap((r) => r.value);

        // Deduplicate within Birdeye (keep highest pnl)
        const candidateMap = new Map<string, WalletCandidate>();
        const birdeyeWeight = SOURCE_WEIGHTS['birdeye'] ?? 0.7;
        const now = Date.now();

        for (const c of [...gainersLosers, ...topTraderCandidates]) {
          const existing = candidateMap.get(c.address);
          if (!existing || c.pnl > existing.pnl) {
            candidateMap.set(c.address, {
              ...c,
              sources: c.sources ?? [
                { source: 'birdeye', weight: birdeyeWeight, discoveredAt: now },
              ],
            });
          }
        }

        const candidates = [...candidateMap.values()];
        console.info(
          `[discovery] Birdeye: ${gainersLosers.length} gainers-losers, ` +
            `${topTraderCandidates.length} top_traders (${hotTokens.length} tokens), ` +
            `${candidates.length} unique`,
        );
        return candidates;
      },
    });

    // Helius reverse provider (always available via internal tracker)
    providers.push({
      name: 'helius-reverse',
      source: 'helius-reverse',
      fetch: async () => {
        const candidates = counterpartyTracker.getCandidates();
        const stats = counterpartyTracker.getStats();
        console.info(
          `[discovery] Helius reverse: ${candidates.length} candidates ` +
            `(${stats.totalTracked} tracked, ${stats.totalGlobalCounts} global)`,
        );
        return candidates;
      },
    });

    return providers;
  }

  async function runCycle(): Promise<void> {
    if (running) {
      console.warn('[discovery] Cycle already running, skipping');
      return;
    }
    running = true;
    cycleCount++;
    const startTime = Date.now();
    console.info(`[discovery] Cycle #${cycleCount} starting`);

    try {
      // 1. Fetch candidates from all providers in parallel
      const providers = buildProviders();
      const results = await Promise.allSettled(providers.map((p) => p.fetch()));

      // Collect successful results, log failures, defer auth errors
      const providerCandidates: WalletCandidate[][] = [];
      let authError: Error | null = null;
      for (const [i, result] of results.entries()) {
        const provider = providers[i]!;
        if (result.status === 'fulfilled') {
          providerCandidates.push(result.value);
        } else {
          if (result.reason instanceof Error && result.reason.message.includes('authentication failed')) {
            authError = result.reason;
          } else {
            console.error(`[discovery] Provider ${provider.name} failed`, {
              error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            });
          }
        }
      }
      // Re-throw auth errors after collecting all provider results
      if (authError) throw authError;

      // 2. Merge and deduplicate across providers (aggregate sources)
      const candidates = mergeCandidates(providerCandidates);

      console.info(`[discovery] ${candidates.length} unique candidates after cross-provider merge`);

      if (candidates.length === 0) {
        console.warn('[discovery] No candidates from any source, keeping current wallet list');
        return;
      }

      // 3. Score and rank
      const pinnedAddresses = new Set(config.pinnedWallets.keys());

      const scored = scoreWallets(candidates, pinnedAddresses, currentDiscovered, config.walletCap);

      // 4. Diff against current state
      const currentAddresses = new Set(currentDiscovered.map((w) => w.address));
      const newAddresses = new Set(scored.map((w) => w.address));
      const added = scored.filter((w) => !currentAddresses.has(w.address));
      const removed = currentDiscovered.filter((w) => !newAddresses.has(w.address));

      if (added.length === 0 && removed.length === 0) {
        currentDiscovered = scored;
        console.info('[discovery] No wallet changes, updated scores only', {
          durationMs: Date.now() - startTime,
          totalDiscovered: scored.length,
        });
        return;
      }

      // 5. Save previous snapshot for rollback
      const previousSnapshot = config.walletStateRef.current;
      const previousDiscovered = currentDiscovered;

      // 6. Update in-memory state (atomic swap)
      const merged = mergeWithPinned(config.pinnedWallets, scored);
      config.walletStateRef.current = createWalletState(merged);
      currentDiscovered = scored;

      // 7. Update Helius webhook
      try {
        const allAddresses = [...merged.keys()];
        await updateHeliusWebhookAddresses(config.heliusApiKey, config.heliusWebhookId, allAddresses);
      } catch (heliusErr) {
        // Rollback in-memory state
        config.walletStateRef.current = previousSnapshot;
        currentDiscovered = previousDiscovered;
        console.error('[discovery] Helius webhook update failed, rolled back', {
          error: heliusErr instanceof Error ? heliusErr.message : String(heliusErr),
        });
        return;
      }

      // 8. Persist to JSON file
      const state: DiscoveryState = { discovered: scored, lastRefresh: Date.now() };
      const saved = saveDiscoveryState(config.statePath, state);

      // 9. Sync to database
      if (config.db) {
        try {
          const dbEntries = scored.map((w) => ({
            address: w.address,
            label: w.label,
            category: w.category,
            source: 'discovered' as const,
            compositeScore: w.compositeScore,
            winRate: w.winRate,
            pnl: w.pnl,
            tradeCount: w.tradeCount,
          }));
          await syncTrackedWallets(config.db, dbEntries);
          console.info(`[discovery] Database synced ${dbEntries.length} wallets`);

          if (removed.length > 0) {
            await deactivateWallets(config.db, removed.map((w) => w.address));
            console.info(`[discovery] Deactivated ${removed.length} wallets`);
          }
        } catch (dbErr) {
          console.error('[discovery] Database sync failed (non-fatal)', {
            error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          });
        }
      }

      console.info('[discovery] Cycle complete', {
        durationMs: Date.now() - startTime,
        candidatesEvaluated: candidates.length,
        added: added.length,
        removed: removed.length,
        totalDiscovered: scored.length,
        totalMonitored: merged.size,
        persisted: saved,
      });
    } catch (err) {
      console.error('[discovery] Cycle failed', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        cycle: cycleCount,
        durationMs: Date.now() - startTime,
      });
    } finally {
      running = false;
    }
  }

  function start(): void {
    console.info('[discovery] Starting', {
      intervalMs: config.intervalMs,
      walletCap: config.walletCap,
      hasDb: config.db !== null,
    });
    // Determine when to run first cycle
    const persisted = loadDiscoveryState(config.statePath);
    const now = Date.now();

    if (persisted && now - persisted.lastRefresh < config.intervalMs) {
      const remaining = config.intervalMs - (now - persisted.lastRefresh);
      console.info(`[discovery] Recent state found, next cycle in ${Math.round(remaining / 60000)}m`);
      setTimeout(() => {
        runCycle().catch(() => {});
        intervalHandle = setInterval(() => runCycle().catch(() => {}), config.intervalMs);
      }, remaining);
    } else {
      console.info(`[discovery] No recent state, first cycle in ${STARTUP_DEBOUNCE_MS / 1000}s`);
      setTimeout(() => {
        runCycle().catch(() => {});
        intervalHandle = setInterval(() => runCycle().catch(() => {}), config.intervalMs);
      }, STARTUP_DEBOUNCE_MS);
    }
  }

  function stop(): void {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  /**
   * Record a swap transaction for counterparty tracking.
   * Fire-and-forget — errors are silently caught to avoid affecting the webhook pipeline.
   */
  function recordSwap(tx: HeliusEnhancedTransaction): void {
    try {
      counterpartyTracker.recordSwap(tx, config.walletStateRef.current.watchedAddresses);
    } catch (err) {
      console.debug('[discovery] recordSwap error (non-fatal)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { start, stop, runCycle, recordSwap };
}

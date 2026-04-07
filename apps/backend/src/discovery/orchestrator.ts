import type { SmartMoneyWallet, WalletCandidate, WalletStateRef } from '../types.js';
import type { PoolDatabase } from '@radar/db';
import { createWalletState } from '../types.js';
import { fetchTopWallets, fetchHotTokensByVolume, fetchTokenTopTraders } from './birdeye.js';
import { createRateLimiter } from './rate-limiter.js';
import { updateHeliusWebhookAddresses } from './helius-webhooks.js';
import { scoreWallets, mergeWithPinned } from './scoring.js';
import type { DiscoveryState, ScoredWallet } from './scoring.js';
import { loadDiscoveryState, saveDiscoveryState } from './persistence.js';
import { syncTrackedWallets, deactivateWallets } from '../persistence/wallets.js';

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
}

const STARTUP_DEBOUNCE_MS = 30_000;

export function createDiscovery(config: DiscoveryConfig) {
  let running = false;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let currentDiscovered: ScoredWallet[] = [];
  let cycleCount = 0;

  // Rate limiter for Birdeye top_traders calls (100 req/min, API allows 300 rps)
  const birdeyeRateLimiter = createRateLimiter(100);

  // Load persisted state if available
  const persisted = loadDiscoveryState(config.statePath);
  if (persisted) {
    currentDiscovered = persisted.discovered;
    console.info(`[discovery] Loaded ${currentDiscovered.length} discovered wallets from persisted state`);
  }

  // Apply persisted discovered wallets to pipeline state immediately
  if (currentDiscovered.length > 0) {
    const merged = mergeWithPinned(config.pinnedWallets, currentDiscovered);
    config.walletStateRef.current = createWalletState(merged);
    console.info(`[discovery] Pipeline initialized with ${merged.size} total wallets (${config.pinnedWallets.size} pinned + ${currentDiscovered.length} discovered)`);
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
      // 1. Fetch candidates from multiple sources in parallel
      const [gainersLosers, hotTokens] = await Promise.all([
        fetchTopWallets(config.birdeyeApiKey),
        fetchHotTokensByVolume(config.birdeyeApiKey),
      ]);

      // 2. Fetch top traders for each hot token (rate-limited)
      const topTraderResults = await Promise.allSettled(
        hotTokens.map((mint) => fetchTokenTopTraders(config.birdeyeApiKey, mint, birdeyeRateLimiter)),
      );

      // Re-throw auth errors (invalid API key) — these won't self-resolve.
      // Rate-limit (429) errors are transient: log and continue with partial data.
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
        .filter((r): r is PromiseFulfilledResult<WalletCandidate[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value);

      // 3. Merge gainers-losers + top_traders, deduplicate by address (keep highest pnl)
      const candidateMap = new Map<string, WalletCandidate>();
      for (const c of [...gainersLosers, ...topTraderCandidates]) {
        const existing = candidateMap.get(c.address);
        if (!existing || c.pnl > existing.pnl) {
          candidateMap.set(c.address, c);
        }
      }
      const candidates = [...candidateMap.values()];

      console.info(
        `[discovery] Aggregated candidates: ${gainersLosers.length} from gainers-losers, ` +
          `${topTraderCandidates.length} from top_traders (${hotTokens.length} tokens), ` +
          `${candidates.length} unique after dedup`,
      );

      if (candidates.length === 0) {
        console.warn('[discovery] No candidates from any source, keeping current wallet list');
        return;
      }

      // 2. Score and rank
      const pinnedAddresses = new Set(config.pinnedWallets.keys());
      const scored = scoreWallets(candidates, pinnedAddresses, currentDiscovered, config.walletCap);

      // 3. Diff against current state
      const currentAddresses = new Set(currentDiscovered.map((w) => w.address));
      const newAddresses = new Set(scored.map((w) => w.address));
      const added = scored.filter((w) => !currentAddresses.has(w.address));
      const removed = currentDiscovered.filter((w) => !newAddresses.has(w.address));

      if (added.length === 0 && removed.length === 0) {
        // Update scores even if no address changes (scores may shift)
        currentDiscovered = scored;
        console.info('[discovery] No wallet changes, updated scores only', {
          durationMs: Date.now() - startTime,
          totalDiscovered: scored.length,
        });
        return;
      }

      // 4. Save previous snapshot for rollback
      const previousSnapshot = config.walletStateRef.current;
      const previousDiscovered = currentDiscovered;

      // 5. Update in-memory state first (so pipeline is ready for new wallets)
      const merged = mergeWithPinned(config.pinnedWallets, scored);
      config.walletStateRef.current = createWalletState(merged);
      currentDiscovered = scored;

      // 6. Update Helius webhook
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

      // 7. Persist to JSON file
      const state: DiscoveryState = { discovered: scored, lastRefresh: Date.now() };
      const saved = saveDiscoveryState(config.statePath, state);

      // 8. Sync to database
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

  return { start, stop, runCycle };
}

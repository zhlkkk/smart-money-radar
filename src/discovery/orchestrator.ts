import type { SmartMoneyWallet, WalletStateRef } from '../types.js';
import { createWalletState } from '../types.js';
import { fetchTopWallets } from './birdeye.js';
import { updateHeliusWebhookAddresses } from './helius-webhooks.js';
import { scoreWallets, mergeWithPinned } from './scoring.js';
import type { DiscoveryState, ScoredWallet } from './scoring.js';
import { loadDiscoveryState, saveDiscoveryState } from './persistence.js';

export interface DiscoveryConfig {
  walletStateRef: WalletStateRef;
  pinnedWallets: Map<string, SmartMoneyWallet>;
  birdeyeApiKey: string;
  heliusApiKey: string;
  heliusWebhookId: string;
  statePath: string;
  intervalMs: number;
  walletCap: number;
}

const STARTUP_DEBOUNCE_MS = 30_000;

export function createDiscovery(config: DiscoveryConfig) {
  let running = false;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let currentDiscovered: ScoredWallet[] = [];

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
    const startTime = Date.now();

    try {
      // 1. Fetch candidates from Birdeye
      const candidates = await fetchTopWallets(config.birdeyeApiKey);
      if (candidates.length === 0) {
        console.warn('[discovery] No candidates from Birdeye, keeping current wallet list');
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

      // 7. Persist
      const state: DiscoveryState = { discovered: scored, lastRefresh: Date.now() };
      const saved = saveDiscoveryState(config.statePath, state);

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
        durationMs: Date.now() - startTime,
      });
    } finally {
      running = false;
    }
  }

  function start(): void {
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

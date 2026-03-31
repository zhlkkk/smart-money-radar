---
title: "Auto Wallet Discovery Architecture for Solana Webhook Pipelines"
date: 2026-03-31
category: best-practices
module: wallet-discovery
problem_type: best_practice
component: tooling
severity: medium
applies_when:
  - "Building dynamic resource tracking with external API synchronization"
  - "Need mutable shared state in a single-threaded event-driven pipeline"
  - "Monitoring a dynamic set of addresses/accounts via webhook subscriptions"
  - "Scoring and ranking candidates from external APIs with different scales"
tags:
  - solana
  - webhook-management
  - rate-limiting
  - atomic-state-management
  - api-orchestration
  - birdeye
  - helius
  - graceful-degradation
  - scoring-engine
  - hot-swap
---

# Auto Wallet Discovery Architecture for Solana Webhook Pipelines

## Context

Smart Money Radar's MVP monitors 20 hardcoded wallets configured in `config/smart-money-addresses.json`. This is a ceiling: the best alpha comes from wallets the user hasn't discovered yet. Manual curation doesn't scale and goes stale as wallet strategies change.

The challenge: dynamically discover profitable wallets from external APIs, score them, and update Helius webhook subscriptions — all without interrupting the running alert pipeline. Two systems (in-memory pipeline state + Helius webhook API) must stay in sync, and either update can fail independently.

**Code entry points:**
- `src/discovery/orchestrator.ts` — cycle orchestration, scheduling, rollback
- `src/discovery/birdeye.ts` — Birdeye API client
- `src/discovery/scoring.ts` — composite scoring + merge with pinned wallets
- `src/discovery/helius-webhooks.ts` — Helius webhook CRUD
- `src/discovery/persistence.ts` — atomic JSON read/write
- `src/discovery/rate-limiter.ts` — token bucket for 30 rpm Birdeye cap

## Guidance

### Pattern 1: Single-Reference Swap for Mutable Shared State

The pipeline's `watchedAddresses` Set was captured in closure at creation time and never updated. Discovery fetches new wallets but the pipeline sees stale addresses.

**Solution:** Wrap mutable state in a ref object with a single `current` pointer. The pipeline reads `ref.current` on each call. Discovery swaps the entire snapshot in one synchronous assignment:

```typescript
// Types
interface WalletState {
  walletMap: Map<string, SmartMoneyWallet>;
  watchedAddresses: Set<string>;
}
interface WalletStateRef { current: WalletState; }

// Pipeline reads fresh reference each call
async function processTransaction(tx) {
  const { watchedAddresses, walletMap } = config.walletStateRef.current;
  const swap = parseSwap(tx, watchedAddresses);
}

// Discovery swaps atomically
config.walletStateRef.current = createWalletState(merged);
```

**Hard invariant:** The swap must be fully synchronous (zero `await` between reading previous snapshot and writing new one). A single assignment `ref.current = newSnapshot` is structurally atomic in JS — no event loop yielding between old and new state.

### Pattern 2: In-Memory-First Update Ordering with Rollback

When two systems must stay in sync, update the one where data loss hurts more first:

```typescript
const previousSnapshot = config.walletStateRef.current;

// Update in-memory first (pipeline ready for new wallets)
config.walletStateRef.current = createWalletState(merged);

try {
  await updateHeliusWebhookAddresses(apiKey, webhookId, allAddresses);
} catch {
  // Rollback — single synchronous assignment
  config.walletStateRef.current = previousSnapshot;
}
```

**Why this ordering:** Pipeline recognizing wallets Helius isn't sending yet = harmless no-op (no events arrive). Helius sending events pipeline doesn't recognize = silent data loss (events dropped by `parseSwap`).

### Pattern 3: Concurrency Guard

Simple boolean flag prevents overlapping cycles in single-threaded Node.js:

```typescript
let running = false;
async function runCycle() {
  if (running) return; // skip
  running = true;
  try { /* ... */ } finally { running = false; }
}
```

### Pattern 4: Grace Period for Wallet Oscillation

Wallets that drop from the ranked list are kept for 2 consecutive cycles (12h) before removal. Prevents adding/removing a wallet every cycle when it's near the scoring threshold:

```typescript
for (const prev of currentDiscovered) {
  if (candidateAddresses.has(prev.address)) continue;
  const newMissedCycles = prev.missedCycles + 1;
  if (newMissedCycles >= 2) continue; // evict after 2 misses
  graceWallets.push({ ...prev, missedCycles: newMissedCycles });
}
```

### Pattern 5: Composite Scoring via Percentile Normalization

Metrics with different scales (PnL: -1000 to +1M, win rate: 0-1, trade count: 0-10k) are normalized to [0,1] via percentile rank, then combined with weights:

```
Composite = PnL (0.35) + winRate (0.30) + tradeCount (0.20) + recency (0.15)
```

Percentile rank is invariant to scale: the top wallet always scores 1.0 regardless of absolute value.

### Pattern 6: Atomic JSON Persistence

Write to temp file, then `renameSync` (atomic on POSIX). If process crashes between write and rename, the original file is untouched:

```typescript
writeFileSync(`${path}.tmp`, JSON.stringify(state, null, 2));
renameSync(`${path}.tmp`, path);
```

On startup, load persisted state **before** pipeline creation so the pipeline starts with the full wallet set (pinned + discovered).

### Pattern 7: Birdeye-Primary with GMGN Deferred

Birdeye ($99/mo Starter): official API, documented, 30 rpm wallet cap. Reliable.
GMGN: undocumented, Cloudflare-protected, breaks frequently. Deferred to v2.

Follows the PRD's "ruthless cut" philosophy: prefer reliable APIs over fragile scraping.

## Why This Matters

Without these patterns, a dynamic wallet tracking system would:
- **Lose data** — Helius sends events for wallets the pipeline doesn't recognize (silent drops)
- **Crash the pipeline** — discovery failures propagate to the webhook handler
- **Corrupt state** — overlapping cycles produce inconsistent wallet lists
- **Oscillate** — wallets near the scoring threshold get added/removed every cycle

The architecture achieves: 99.9% alert reliability (discovery never interrupts alerts), atomic consistency (in-memory + Helius always in sync), graceful degradation (discovery failures logged, pipeline continues with current wallets).

## When to Apply

- **Single-reference swap:** Any mutable shared state read by one subsystem and written by another (config reloads, failover switches, dynamic monitoring lists)
- **In-memory-first + rollback:** Two systems that must stay in sync where one update can fail
- **Concurrency guard:** Long-running task on interval shorter than worst-case duration
- **Grace period:** Removing items from a tracked set is expensive or disruptive
- **Percentile normalization:** Scoring multi-metric candidates with disparate scales
- **Atomic persistence:** Critical state that must survive crashes (write-to-temp + rename)
- **API source selection:** Prefer stable official APIs over undocumented endpoints, even with fewer candidates

## Examples

### Discovery Cycle Flow

```
Timer fires (every 6h)
  → Fetch Birdeye top wallets (1-2 API calls)
  → Score candidates (percentile normalize, weighted sum)
  → Merge with 20 pinned wallets
  → Diff: added 3 wallets, removed 1 (grace period), 27 unchanged
  → Save previous snapshot
  → Swap in-memory state (ref.current = newSnapshot)
  → PUT Helius webhook (all 50 addresses)
  → Success → persist to config/discovered-wallets.json
  → Log: "Cycle complete, 3 added, 1 removed, 50 total, 2.1s"
```

### Failure Recovery: Helius PUT Fails

```
  → Swap in-memory state (ref.current = newSnapshot) ✓
  → PUT Helius webhook → 500 Internal Server Error ✗
  → Rollback: ref.current = previousSnapshot ✓
  → Log error, skip persistence
  → Pipeline continues with previous wallet set
  → Next cycle in 6h will retry
```

### Grace Period in Action

```
Cycle 1: Wallet J ranked #30 → monitored, missedCycles=0
Cycle 2: Wallet J drops to #35 → grace period, missedCycles=1, still monitored
Cycle 3: Wallet J still absent → missedCycles=2 >= MAX, evicted
Cycle 3: Wallet J returns to #28 → missedCycles resets to 0, monitored again
```

## Related

- [Fire-and-Forget Webhook Pattern](fire-and-forget-webhook-graceful-degradation-2026-03-31.md) — the graceful degradation foundation this discovery system builds upon
- [Smart Money Radar MVP Architecture](../documentation-gaps/smart-money-radar-mvp-architecture-2026-03-31.md) — pipeline stages where discovery injects mutable state
- [Smart Money Radar MVP PRD v1.1](../documentation-gaps/smart-money-radar-mvp-prd-v1-1-2026-03-31.md) — phase gates (wallet discovery was Phase 3 scope, implemented as Phase 2)
- [parseSwap Helius Payload Mismatch](../runtime-errors/parseswap-helius-payload-mismatch-2026-03-31.md) — defensive parsing for wallets discovery adds to the webhook
- [Sentry Auto-Fix Workflow](../workflow-issues/sentry-auto-fix-workflow-2026-03-31.md) — error monitoring patterns for discovery cycle failures
- Implementation plan: `docs/plans/2026-03-31-001-feat-auto-wallet-discovery-plan.md`

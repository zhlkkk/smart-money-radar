---
title: "Sentry Auto-Fix Workflow for Smart Money Radar"
date: 2026-03-31
category: workflow-issues
module: error-monitoring
problem_type: workflow_issue
component: tooling
severity: high
applies_when:
  - "Production errors captured by Sentry need systematic triage and auto-remediation"
  - "Upstream webhook payloads (Helius) have inconsistent shapes that cause runtime crashes"
  - "Manual error triage MTTR exceeds acceptable threshold for real-time alerting systems"
tags:
  - sentry
  - auto-fix
  - error-monitoring
  - defensive-coding
  - solana-webhooks
  - graceful-degradation
  - automation
  - typescript
---

# Sentry Auto-Fix Workflow for Smart Money Radar

## Context

Smart Money Radar is a real-time Solana webhook pipeline (Helius -> enrichment -> AI summary -> Telegram alert) with a < 5-second end-to-end latency SLA and 99.9% message reliability target. The system already implements graceful degradation via fire-and-forget patterns (`Promise.allSettled`, per-call timeouts, typed fallbacks).

Production revealed a gap: **Helius webhook payloads are not always complete.** The `parseSwap` function (`src/webhook/parse.ts`) crashed when `tx.events` was undefined or when `tokenOutputs` lacked values (commit `2496092`). This cascading failure silently dropped alerts. Manual triage took hours; the fix took minutes once identified.

This workflow closes the feedback loop: Sentry detects errors -> AI analyzes root cause -> generates defensive fix + tests -> creates PR for human review -> documents the new pattern via `/ce:compound`.

## Guidance

### The 6-Phase Workflow

#### Phase 1: Sentry Integration (Foundation)

Already in place (`src/index.ts`):

```typescript
import * as Sentry from '@sentry/node';

if (env.SENTRY_DSN) {
  Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
}

process.on('unhandledRejection', (err) => {
  app.log.error(err, 'Unhandled rejection');
  Sentry.captureException(err);
});

process.on('uncaughtException', (err) => {
  app.log.fatal(err, 'Uncaught exception');
  Sentry.captureException(err);
  process.exit(1);
});
```

For in-pipeline capture, tag errors with pipeline stage context:

```typescript
Sentry.captureException(error, {
  tags: { pipeline_stage: 'parse_swap' },
  extra: { webhook_type: tx.type, signature: tx.signature },
});
```

#### Phase 2: Periodic AI Review

Trigger manually or via cron:

```bash
/ce:review --sentry          # manual
# or schedule hourly via cron
```

The AI review:
1. Queries Sentry API for unresolved issues (configurable time window)
2. Groups by error fingerprint
3. Maps stack traces to source files
4. Identifies root cause pattern (missing null check, timeout, type mismatch)

#### Phase 3: Defensive Fix Generation

The fix pattern learned from the `parseSwap` incident:

1. **Optional chaining on property access** — never trust upstream data shape
2. **Early returns with warning logs** — skip bad data, don't crash
3. **Fallback values for optional fields** — `|| 'UNKNOWN'` over throwing
4. **Structured logging at parse boundary** — warn, not error (data incompleteness is expected)

#### Phase 4: Test Generation

Write regression tests for each defensive check:

```typescript
describe('parseSwap defensive checks', () => {
  it('returns null when tx.events is missing', () => {
    expect(parseSwap({ type: 'SWAP' })).toBeNull();
  });

  it('returns null when tokenOutputs is empty', () => {
    const tx = { type: 'SWAP', events: { swap: { tokenOutputs: [] } } };
    expect(parseSwap(tx)).toBeNull();
  });

  it('returns null when tokenOutput has no mint', () => {
    const tx = { type: 'SWAP', events: { swap: { tokenOutputs: [{ decimals: 6 }] } } };
    expect(parseSwap(tx)).toBeNull();
  });
});
```

#### Phase 5: PR Creation

```markdown
Title: [auto-fix] parseSwap: add defensive checks for incomplete Helius payloads

- Root Cause: Helius webhooks occasionally omit `events` or `tokenOutputs`
- Impact: Pipeline crash, silent alert drop
- Fix: Optional chaining + early returns with warning logs
- Testing: Regression tests covering missing events, tokenOutputs, mint
- Sentry: Links to resolved issue
```

Human review required before merge (AI generates, human approves).

#### Phase 6: Knowledge Compounding

After merge, auto-run `/ce:compound` to document the new error pattern in `docs/solutions/`. Each documented pattern compounds the team's defensive knowledge.

### The Compounding Loop

```
Production Error
    -> Sentry captures (automatic)
    -> AI analyzes root cause (periodic review)
    -> Generates fix + tests (defensive pattern)
    -> PR for human review ([auto-fix] tag)
    -> Merge & deploy
    -> /ce:compound documents pattern
    -> Team knowledge grows
    -> Fewer errors of this class
```

## Why This Matters

**Real-time financial pipelines cannot crash.** Each dropped Solana whale alert is a missed opportunity. The existing graceful degradation patterns (fire-and-forget, `Promise.allSettled`, timeouts) handle *expected* failures. Sentry catches the *unexpected* ones.

**Manual triage is slow.** The `parseSwap` crash took hours to diagnose manually; the fix was 20 lines of optional chaining. An automated workflow reduces MTTR from hours to minutes for pattern-based errors.

**Knowledge compounds.** Without documentation, the team re-learns "Helius payloads sometimes lack events" every time. With this workflow, each production error becomes a documented defensive pattern that prevents the entire class of errors from recurring.

After 5-10 cycles, the system's error surface shrinks measurably. The team anticipates missing fields and adds checks upfront.

## When to Apply

- Any Solana webhook pipeline processing third-party data (Helius, Jupiter, Magic Eden)
- Services where upstream payload shape isn't contractually guaranteed
- Real-time alerting systems where crashes block all delivery
- Financial pipelines where false negatives (missed alerts) are expensive
- Sentry error frequency > 3 incidents/day in the same code path

**Not recommended for:**
- Synchronous user-facing APIs (need immediate error feedback, not graceful skip)
- In-house pipelines with guaranteed schemas (optional chaining is overkill)

## Examples

### The parseSwap Fix (commit `2496092`)

**Before** — crashed on incomplete Helius payload:

```typescript
export function parseSwap(
  tx: HeliusEnhancedTransaction,
  watchedAddresses: Set<string>,
): ParsedSwap | null {
  if (tx.type !== 'SWAP') return null;        // crashes if tx is null
  const swapEvent = tx.events.swap;            // crashes if events missing
  if (!swapEvent) return null;

  const interestingOutput = swapEvent.tokenOutputs.find(
    (o) => !BASE_TOKEN_MINTS.has(o.mint),      // crashes if tokenOutputs missing
  );
  // ...
}
```

**After** — defensive checks, graceful skip:

```typescript
export function parseSwap(tx: any): ParsedSwap | null {
  if (tx?.type !== 'SWAP') return null;

  const swapEvent = tx.events?.swap;
  if (!swapEvent) {
    console.warn('[parseSwap] No swap event found, skipping');
    return null;
  }

  const tokenOutput = swapEvent.tokenOutputs?.[0];
  if (!tokenOutput?.mint) {
    console.warn('[parseSwap] No tokenOutput mint found, skipping');
    return null;
  }

  return {
    signature: tx.signature,
    buyerAddress: tx.feePayer,
    tokenMint: tokenOutput.mint,
    tokenSymbol: tokenOutput.symbol || 'UNKNOWN',
    amountRaw: tokenOutput.amount,
    dexSource: tx.source || 'UNKNOWN',
    timestamp: Date.now(),
  };
}
```

**Result:** Zero crashes on incomplete payloads. Incomplete data is logged and skipped. Pipeline continues processing other transactions.

## Related

- [Fire-and-Forget Webhook Pattern with Graceful Degradation](../best-practices/fire-and-forget-webhook-graceful-degradation-2026-03-31.md) — the defensive coding foundation this workflow monitors and extends
- [Smart Money Radar MVP Architecture](../documentation-gaps/smart-money-radar-mvp-architecture-2026-03-31.md) — pipeline stages where Sentry injects observability
- [Solana TypeScript Implementation Gotchas](../developer-experience/solana-typescript-implementation-gotchas-2026-03-31.md) — SDK-level edge cases that trigger Sentry alerts when unhandled
- [Smart Money Radar MVP PRD v1.1](../documentation-gaps/smart-money-radar-mvp-prd-v1-1-2026-03-31.md) — reliability targets (99.9% message reliability, < 5s latency) that justify this workflow

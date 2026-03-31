---
title: "Fire-and-Forget Webhook Pattern with Graceful Degradation"
date: 2026-03-31
category: best-practices
module: smart-money-radar
problem_type: best_practice
component: service_object
severity: medium
applies_when:
  - "Building a webhook handler where the sender retries on non-200 responses"
  - "Processing pipeline touches multiple independent external APIs"
  - "Real-time alerting where partial data is better than no alert"
  - "Strict latency SLA must be met despite unreliable downstream services"
tags:
  - webhook
  - fire-and-forget
  - graceful-degradation
  - promise-allsettled
  - timeout
  - real-time-alerting
  - typescript
  - fastify
---

# Fire-and-Forget Webhook Pattern with Graceful Degradation

## Context

When building the Smart Money Radar MVP, we needed a Fastify webhook handler receiving Helius Enhanced Transaction events and pushing real-time alerts to Telegram. The processing pipeline touches 4 external dependencies (DexScreener API, Solana RPC, Claude AI, Telegram Bot API), any of which can fail or be slow. Helius retries on non-200 responses and may auto-disable webhooks that consistently fail, so the handler must respond immediately and never crash regardless of downstream failures. The entire pipeline must complete within a 5-second SLA.

This pattern generalizes beyond this specific project to any webhook-driven, multi-dependency processing pipeline.

## Guidance

### 1. Respond 200 Immediately, Process Asynchronously

The webhook handler validates the auth header, returns 200 OK, and kicks off fire-and-forget processing. No `await` on the response path.

```typescript
app.post('/webhook', async (request, reply) => {
  if (request.headers.authorization !== expectedToken) {
    return reply.status(401).send();
  }
  reply.status(200).send({ ok: true }); // Respond BEFORE processing

  const events = request.body as Event[];
  for (const event of events) {
    processEvent(event).catch((err) => logger.error(err));
  }
});
```

### 2. Dedup with In-Memory TTL Map

Webhook senders often retry (Helius: up to 3x, 1 min apart). Track seen event IDs in a `Map<string, number>` with TTL cleanup. Avoids external state (Redis) at MVP traffic levels.

```typescript
class EventDedup {
  private seen = new Map<string, number>();
  isDuplicate(id: string): boolean {
    if (this.seen.has(id)) return true;
    this.seen.set(id, Date.now());
    return false;
  }
}
```

### 3. Parallel Enrichment with `Promise.allSettled` + Timeouts

Run independent external calls concurrently. Use `Promise.allSettled` (NOT `Promise.all`) so partial results are preserved when one call fails. Wrap each call with a timeout.

```typescript
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

const [resultA, resultB] = await Promise.allSettled([
  withTimeout(fetchServiceA(token), 2000),
  withTimeout(fetchServiceB(token), 2000),
]);

const dataA = resultA.status === 'fulfilled' ? resultA.value : fallbackA;
const dataB = resultB.status === 'fulfilled' ? resultB.value : fallbackB;
```

### 4. Typed Fallback for Every External Call

Each external dependency returns a safe default on failure:
- Market data API timeout → `{ liquidity: null, fdv: null }`
- Authority check failure → `'unchecked'`
- AI generation timeout → `''` (empty string, omit the AI line)
- Message delivery failure → retry once, then log and move on

### 5. Pipeline Never Throws

The fire-and-forget processing function must never propagate errors. Wrap everything in try/catch, log to Sentry.

### 6. Helius-Specific: Auth is Header-Echo, Not HMAC

Helius webhooks use a shared secret echoed in the `Authorization` header. Verification is a string comparison, not cryptographic signing.

## Why This Matters

**If followed:**
- Alerts always send, even when partially degraded — traders still get value from "Liquidity: N/A"
- The webhook stays registered because it never returns non-200
- No external dependency failure crashes the process
- The 5-second SLA is met: parallel enrichment (2s) + AI (1s) + push (0.5s) = ~3.5s

**If not followed:**
- `Promise.all` means a single DexScreener timeout kills the Solana authority result too
- Blocking the webhook response causes retries (tripling load) and eventual auto-disable
- Serial enrichment doubles latency and blows the SLA
- Unhandled rejections in fire-and-forget promises crash the Node process

## When to Apply

- Webhook handlers where the sender retries on non-200 or slow responses
- Processing pipelines with 2+ independent external dependencies
- Real-time alerting where partial data is better than no alert
- MVP-scale systems where in-memory dedup suffices (< thousands of events/minute)
- Any scenario with a strict latency SLA despite unreliable downstream services

**Not appropriate when:**
- Exactly-once processing is required (need persistent dedup like Redis/DB)
- The webhook sender doesn't retry (no urgency to respond 200 fast)
- All external calls are to a single dependency (no parallelism benefit)

## Examples

**Anti-pattern: Serial + `Promise.all` + blocking response**

```typescript
// WRONG: blocks response, serial calls, Promise.all loses partial results
app.post('/webhook', async (request, reply) => {
  const events = request.body as Event[];
  for (const event of events) {
    const dataA = await fetchServiceA(event.id);           // Serial: wastes time
    const [dataB, dataC] = await Promise.all([             // Promise.all: one failure kills both
      fetchServiceB(event.id),
      fetchServiceC(event.id),
    ]);
    await sendAlert(format(dataA, dataB, dataC));
  }
  return reply.status(200).send();                          // Too late — sender already retried
});
```

**Correct: Fire-and-forget + parallel + graceful degradation**

```typescript
app.post('/webhook', async (request, reply) => {
  if (request.headers.authorization !== secret) return reply.status(401).send();
  reply.status(200).send({ ok: true });

  for (const event of request.body as Event[]) {
    processEvent(event).catch((err) => logger.error(err));
  }
});

async function processEvent(event: Event): Promise<void> {
  if (dedup.isDuplicate(event.id)) return;

  const [resultA, resultB] = await Promise.allSettled([
    withTimeout(fetchServiceA(event.id), 2000),
    withTimeout(fetchServiceB(event.id), 2000),
  ]);

  const dataA = resultA.status === 'fulfilled' ? resultA.value : null;
  const dataB = resultB.status === 'fulfilled' ? resultB.value : 'unknown';

  let aiSummary = '';
  try { aiSummary = await withTimeout(generateAI(dataA, dataB), 1000); } catch {}

  await sendAlert(format(event, dataA, dataB, aiSummary));
}
```

## Related

- [Smart Money Radar MVP PRD v1.1](../documentation-gaps/smart-money-radar-mvp-prd-v1-1-2026-03-31.md) — NFRs and reliability targets that motivated this pattern
- [Webhook Pipeline Design Spec](../../superpowers/specs/2026-03-31-mvp-webhook-pipeline-design.md) — concrete implementation of this pattern with module-level detail
- [Solana TypeScript Gotchas](../developer-experience/solana-typescript-implementation-gotchas-2026-03-31.md) — implementation-time gotchas discovered while building this pattern

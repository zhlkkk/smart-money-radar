---
title: Smart Money Radar MVP Phase 1 — End-to-End Architecture
date: 2026-03-31
category: documentation-gaps
module: smart-money-radar
problem_type: documentation_gap
component: service_object
severity: medium
applies_when:
  - Building a Helius webhook listener for Solana transaction events
  - Implementing parallel async enrichment pipelines with timeout budgets
  - Sending structured Telegram alerts from a Fastify service
  - Applying fire-and-forget pattern for webhook processing in TypeScript
tags:
  - solana
  - helius
  - webhook
  - typescript
  - fastify
  - telegram
  - dexscreener
  - parallel-enrichment
  - fire-and-forget
  - claude-ai
  - smart-money
  - mvp-architecture
---

# Smart Money Radar MVP Phase 1 — End-to-End Architecture

## Context

The MVP needed a real-time Solana wallet activity tracker: Helius Enhanced Transaction Webhooks as the event source, parallel external API enrichment (DexScreener + Solana RPC), AI-generated Chinese summaries, and Telegram delivery. The primary engineering challenge was keeping end-to-end latency under 5 seconds while treating every external dependency as unreliable.

This document records the implemented architecture and the non-obvious decisions made during the build. For the product specification, see the [MVP PRD](../documentation-gaps/smart-money-radar-mvp-prd-v1-1-2026-03-31.md). For the webhook resilience pattern in depth, see [Fire-and-Forget Webhook Pattern](../best-practices/fire-and-forget-webhook-graceful-degradation-2026-03-31.md). For Solana TypeScript SDK gotchas, see [Solana TypeScript Gotchas](../developer-experience/solana-typescript-implementation-gotchas-2026-03-31.md).

## Guidance

### Pipeline Architecture

```
Helius Webhook → Fastify (auth + 200 OK) → fire-and-forget loop
  → dedup (LRU signature cache)
  → parseSwap (filter SWAP type, identify buyer, find purchased token)
  → enrichToken (Promise.allSettled: DexScreener ∥ authority check, 2s timeout)
  → generateAttribution (Claude Haiku, 1s timeout, empty-string fallback)
  → formatAlert (HTML with escaping + USD formatting)
  → sendAlert (Telegram Bot API, 1 retry)
```

### 1. Fire-and-Forget Webhook Handler

Helius enforces strict response timeouts. Respond `200 OK` immediately, process async. Per-transaction `.catch()` is load-bearing — without it, a rejected promise becomes an unhandled rejection that can crash the process.

```typescript
// src/webhook/handler.ts
reply.status(200).send({ ok: true });

for (const tx of transactions) {
  config.processTransaction(tx).catch((err) => {
    request.log.error({ err, signature: tx.signature }, 'Pipeline processing failed');
  });
}
```

### 2. `Promise.allSettled` for Parallel Enrichment

DexScreener and Solana RPC have independent failure modes. `Promise.allSettled` + per-call `withTimeout` ensures one failure never blocks the alert. Fallback values: `null` for DexScreener, `'unchecked'` for authority checks.

```typescript
// src/enrichment/enrich.ts
const [dexResult, authResult] = await Promise.allSettled([
  withTimeout(fetchDexScreenerData(tokenMint), timeoutMs),
  withTimeout(checkAuthorities(rpc, tokenMint), timeoutMs),
]);

return {
  liquidity:       dexResult.status  === 'fulfilled' ? dexResult.value.liquidity      : null,
  mintAuthority:   authResult.status === 'fulfilled' ? authResult.value.mintAuthority  : 'unchecked',
  freezeAuthority: authResult.status === 'fulfilled' ? authResult.value.freezeAuthority : 'unchecked',
};
```

### 3. Base-Token Filtering in Swap Parsing

The "interesting" token is never SOL, USDC, or USDT — those are the payment leg. Buyer identification uses a two-step fallback: `feePayer` first, then `tokenOutput.userAccounts`.

```typescript
// src/webhook/parse.ts
const BASE_TOKEN_MINTS = new Set([
  'So11111111111111111111111111111111111111112',   // Wrapped SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
]);

const purchasedToken = swapEvent.tokenOutputs.find(
  (o) => !BASE_TOKEN_MINTS.has(o.mint),
);
```

### 4. AI Graceful Degradation

The AI summary is decorative — the alert must still send without it. 1-second timeout, empty string on any failure. The formatter conditionally includes the summary section.

```typescript
// src/ai/attribution.ts
try {
  const response = await withTimeout(client.messages.create({
    model: 'claude-3-5-haiku-latest',
    max_tokens: 100,
    messages: [{ role: 'user', content: buildPrompt(input) }],
  }), 1000);
  return textBlock?.text ?? '';
} catch {
  return '';
}
```

### 5. Telegram HTML Requirements

- The bot must be a **channel administrator** to use `parse_mode: 'HTML'` in channels.
- All dynamic strings must escape `&`, `<`, `>`, `"` — unescaped characters cause silent message corruption or 400 errors.
- Human-readable USD formatting tiers: `$1.2B`, `$5.3M`, `$100K`.

### 6. Rate Limit Calibration

`@fastify/rate-limit` default of 100/min is insufficient for burst webhook traffic. Set to 500/min or higher, sized to watched wallets times expected burst depth.

### 7. Node.js ESM: `import.meta.dirname`

In Node.js 21+ with `"type": "module"`, use `import.meta.dirname` instead of `__dirname` for resolving paths relative to source files.

### 8. Signature Dedup

Helius delivers at-least-once. An in-process LRU cache on `tx.signature` prevents duplicate alerts without requiring a database.

## Why This Matters

- **Fire-and-forget is not optional with Helius**: Slow synchronous handlers cause retries, duplicates, and alert storms.
- **`Promise.allSettled` is the correct enrichment tool**: `Promise.all` means a DexScreener outage kills all alerts. `allSettled` makes partial failure the normal case.
- **Graceful degradation compounds**: Each layer (enrichment, AI, Telegram retry) independently degrades. Alerts are nearly always delivered even when 1-2 upstream services are unavailable.
- **Telegram HTML quirks cause silent failures**: Bot-admin requirement is poorly documented; HTML escaping failures produce malformed messages.

## When to Apply

- Any webhook consumer with provider-enforced response timeouts (Helius, Stripe, GitHub) — fire-and-forget
- Any pipeline fanning out to multiple external APIs — `Promise.allSettled` + per-call timeouts
- Any AI-generated decorative content — optional with hard timeout and empty-string fallback
- Any Telegram channel bot — verify admin status and HTML-escape all dynamic content
- Any Node.js 21+ ESM project loading relative files — `import.meta.dirname`

## Examples

See the complete implementation in the source tree:

| Concern | File | Key Pattern |
|---------|------|-------------|
| Webhook handler | `src/webhook/handler.ts` | Fire-and-forget with per-tx error isolation |
| Swap parsing | `src/webhook/parse.ts` | Base-token filtering + buyer fallback |
| Parallel enrichment | `src/enrichment/enrich.ts` | `Promise.allSettled` + `withTimeout` |
| AI summary | `src/ai/attribution.ts` | 1s timeout + empty-string fallback |
| Alert formatting | `src/telegram/format.ts` | HTML escaping + USD tier formatting |
| Alert delivery | `src/telegram/bot.ts` | Simple retry with 2s delay |
| Pipeline orchestration | `src/pipeline.ts` | Dedup → parse → enrich → AI → format → send |

## Related

- [MVP PRD v1.1](../documentation-gaps/smart-money-radar-mvp-prd-v1-1-2026-03-31.md) — product specification and scope gates
- [Fire-and-Forget Webhook Pattern](../best-practices/fire-and-forget-webhook-graceful-degradation-2026-03-31.md) — deep-dive on the resilience pattern
- [Solana TypeScript Gotchas](../developer-experience/solana-typescript-implementation-gotchas-2026-03-31.md) — `@solana/kit`, ESM, authority check implementation details
- [Phased Frontend Design](../best-practices/phased-frontend-design-philosophy-2026-03-31.md) — why Telegram-first with no web UI in Phase 1

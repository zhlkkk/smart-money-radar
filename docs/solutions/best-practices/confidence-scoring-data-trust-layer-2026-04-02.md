---
title: "Confidence Scoring — Data Trust Layer for Alert Credibility"
date: 2026-04-02
category: best-practices
module: enrichment
problem_type: best_practice
component: tooling
severity: medium
tags: [confidence, scoring, data-quality, trust, transparency, enrichment]
applies_when: "Building data pipelines where output credibility varies by data source completeness and reliability"
---

# Confidence Scoring — Data Trust Layer for Alert Credibility

## Context

Smart Money Radar pushes real-time alerts based on data from multiple sources (Helius, DexScreener, Solana RPC, Birdeye). Each source has different reliability levels — chain data is immutable but DexScreener data may be stale; authority checks are binary but wallet scoring is probabilistic. Users had no way to judge how trustworthy a given alert was.

The solution: a confidence scoring system that quantifies data completeness and reliability per alert, surfaced as "信号强度: 高/中/低" (Signal Strength: High/Medium/Low).

## Guidance

### Additive Scoring Model

Use independent, orthogonal scoring dimensions that sum to a maximum (here, 100):

```
+30  Chain authority safe (mint + freeze both revoked)
+25  DexScreener data complete (liquidity + FDV non-null)
+25  Liquidity sufficient (> $50K)
+20  Top-tier wallet (Birdeye scoring pipeline)
───
100  Maximum possible score

high ≥ 80 | medium ≥ 45 | low < 45
```

Each dimension is a pure boolean check — no weighted averages, no normalization. This makes the scoring trivially testable and debuggable.

### Key Design Decisions

**Confidence ≠ investment advice**: The score measures "how complete and trustworthy is the data behind this alert", not "should you buy this token". This distinction must be clear in UI copy and disclaimers.

**Pure function, no side effects**: `computeConfidence(enrichment, isTopWallet) → ConfidenceResult` is a deterministic pure function. No API calls, no DB reads, no async. This makes it testable in isolation with 13 unit tests covering all dimensions and boundaries.

**Label generation in backend, i18n in frontend**: Backend generates Chinese emoji labels (`🟢 信号强度: 高`) for Telegram (always Chinese). Frontend ignores the label and generates its own via `next-intl` from the `level` enum. Two separate rendering paths, same underlying `level` field.

**HTML-escape the label**: Even though labels are hardcoded, always `escapeHtml(confidence.label)` before embedding in Telegram HTML — consistency with other fields and defense against future changes.

### Integration Pattern

```
Pipeline: enrichToken() → passesQualityFilter() → assessRisk() → computeConfidence() → generateAttribution() → formatAlert()
                                                                    ↓
                                                              alertBus.emit({ confidenceScore, confidenceLevel })
                                                                    ↓
                                                              SSE → Frontend AlertCard Badge
```

Confidence scoring slots into the existing pipeline as a synchronous step between risk assessment and AI attribution. No new async calls, no new failure modes.

## Why This Matters

- **User trust**: Transparent data quality signals build credibility — users know when to pay attention vs. be skeptical
- **Defensibility**: When data is wrong (DexScreener stale, fake pools), the confidence score visibly drops, protecting the product's reputation
- **Extensibility**: New scoring dimensions (e.g., "price cross-verified against AMM pool") can be added by incrementing the max score — existing thresholds auto-adjust

## When to Apply

- Any data pipeline aggregating from multiple sources with varying reliability
- Products where users need to judge output credibility
- Alert/notification systems where signal-to-noise ratio matters

## Examples

### Boundary test pattern for scoring functions

```typescript
it('returns high at exact threshold (score = 80)', () => {
  // authority safe (+30) + DexScreener complete (+25) + liquidity > $50K (+25) = 80, no top wallet
  const result = computeConfidence(healthyEnrichment, false);
  expect(result.score).toBe(80);
  expect(result.level).toBe('high');
});

it('does not grant +25 for liquidity exactly $50K (boundary)', () => {
  const atBoundary = computeConfidence({ ...healthyEnrichment, liquidity: 50_000 }, true);
  const aboveBoundary = computeConfidence({ ...healthyEnrichment, liquidity: 50_001 }, true);
  expect(aboveBoundary.score - atBoundary.score).toBe(25);
});
```

### LEFT JOIN NULL gotcha (also in cleanup)

When scoring dimensions come from LEFT JOIN queries, `ne(field, 'value')` does NOT match NULL rows. Always use `or(ne(field, 'value'), isNull(field))`.

## Related Issues

- `docs/superpowers/specs/2026-04-02-data-trust-layer-design.md` — design spec
- `docs/superpowers/plans/2026-04-02-data-trust-layer.md` — implementation plan
- `docs/solutions/best-practices/fire-and-forget-webhook-graceful-degradation-2026-03-31.md` — same pipeline pattern

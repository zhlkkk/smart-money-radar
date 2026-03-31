---
title: "Smart Money Radar MVP PRD v1.1"
date: 2026-03-31
category: documentation-gaps
module: smart-money-radar
problem_type: documentation_gap
component: documentation
severity: medium
applies_when:
  - "Making any technical decision during MVP development (weeks 1-4)"
  - "Evaluating whether a feature belongs in MVP scope"
  - "Onboarding a new contributor to the project"
  - "Choosing between enrichment strategies or fallback patterns"
tags:
  - prd
  - mvp
  - telegram-bot
  - solana
  - smart-money
  - typescript
  - helius
  - dexscreener
  - fastify
---

# Smart Money Radar MVP PRD v1.1

## Context

Smart Money Radar is a Telegram bot that tracks smart money wallet activity on Solana and pushes alerts to paying subscribers. The core friction it addresses: Solana Degen traders consistently miss early entries on tokens because they lack real-time visibility into what sophisticated wallets are buying. By the time retail notices, the opportunity window has closed.

This PRD (v1.1) defines the MVP scope, technical architecture, and explicit boundaries for a 4-week build targeting 10 invite-only users at $100/month. The guiding principle is **Ruthless Cut** -- remove anything that does not validate the core hypothesis: "users will pay $100/month for alerts that arrive 10 minutes faster than the competition."

## Guidance

### Product Shape

The MVP is a single private Telegram channel with a bot that pushes Chinese-language alerts summarizing smart money buys within 5 seconds of on-chain activity. No web UI, no dashboard, no payment system -- just a webhook listener, enrichment pipeline, and Telegram push.

**Pricing and validation gate**: $100/month, invite-only, 10 power users. Target: $1,000 MRR to validate willingness to pay before building anything beyond the core alert loop.

### Evolution Phases

| Phase | Timeline | Target | Product Shape | KPI |
|-------|----------|--------|---------------|-----|
| **Phase 1: MVP** | Weeks 1-4 | Validate core demand + willingness to pay | Private Telegram channel + manual invite | 10 power users + $1,000 MRR |
| **Phase 2: MLP** | Weeks 5-8 | Automate acquisition + payment | Stripe/Crypto payments + basic user mgmt | 50 paid users + $5,000 MRR |
| **Phase 3: Seed** | Weeks 9-12 | Scale + multi-chain | Web Dashboard + custom monitoring + EVM | $10,000 MRR + fundraising data |

### Core User Stories

1. As a trader, I want to receive a structured Telegram alert **within 5 seconds** of a smart money buy, so I can enter before retail.
2. As a trader, I want the alert to show liquidity, market cap, and Mint/Freeze authority status, so I can assess rug risk instantly.
3. As a trader, I want an AI-generated **<50 word** Chinese summary explaining the buy rationale.

### Technical Architecture (MVP)

Three-stage pipeline: **Monitor -> Enrich -> Push**.

```
Helius Enhanced Webhook
        |
        v
+---------------------+
|  Fastify Server      |  (TypeScript + Node.js)
|  - Verify signature  |
|  - Filter SWAP /     |
|    TOKEN_TRANSFER    |
|  - Extract token,    |
|    amount, buyer     |
+--------+------------+
         |
         v
+--------------------------------+
|  Parallel Enrichment (2s budget)|
|                                 |
|  Action A: DexScreener API      |
|  -> Liquidity, FDV, Market Cap  |
|                                 |
|  Action B: @solana/kit          |
|  -> getAccountInfo              |
|  -> mintAuthority / freezeAuth  |
|  -> null = safe (rug check)     |
|                                 |
|  Timeout -> "N/A" / "unchecked" |
|  (graceful degradation)         |
+--------+-----------------------+
         |
         v
+------------------------------+
|  AI Attribution + Push        |
|                               |
|  Claude 3.5 Haiku:            |
|  -> <50 word Chinese summary  |
|  -> "why did smart money buy?"|
|                               |
|  Telegram Bot API:            |
|  -> Push to private channel   |
|                               |
|  Fallback: Claude fails ->    |
|  push raw data template       |
+-------------------------------+
```

**Tech stack**: TypeScript, Node.js, Fastify, Helius Enhanced Transaction Webhooks, DexScreener API, @solana/kit, Claude claude-3-5-haiku, Telegram Bot API, Sentry.

**Data monitoring**: 20 fixed smart money wallet addresses configured in Helius Dashboard. No auto-discovery -- wallets are manually curated for MVP.

**Rug-pull protection**: Check `mintAuthority` and `freezeAuthority` via `getAccountInfo`. If either is non-null, the token issuer retains the ability to mint infinite supply or freeze accounts -- flag it in the alert.

**AI attribution**: Claude claude-3-5-haiku generates a sub-50-word Chinese summary. If the call fails or times out, fall back to a raw data template so the alert still ships.

### Non-functional Requirements

| Requirement | Target | Notes |
|-------------|--------|-------|
| End-to-end latency | < 5 seconds | Helius webhook -> Telegram message |
| Reliability | 99.9% message delivery | No single dependency failure crashes the service |
| Security | Helius signature verification | No private keys stored, rate limiting on all endpoints |
| Monitoring | Sentry + structured logs | Critical errors -> Telegram ops channel |
| Testing | TDD across all modules | Tests written before implementation |

### The Ruthless Cut List (NOT in MVP)

These items are explicitly excluded. Any temptation to add them must be resisted until Phase 1 validation succeeds:

- Web Dashboard / Frontend UI
- Automatic smart money wallet discovery algorithm
- User subscription or payment system (manual invite only)
- Historical backtesting or win rate analysis
- Multi-chain support (Solana only)

## Why This Matters

The entire architecture is shaped by one constraint: **validate demand before building infrastructure**.

- **Telegram-only** (no web UI) eliminates weeks of frontend work and keeps the feedback loop tight -- users are already in Telegram.
- **20 fixed wallets** (no auto-discovery) means monitoring setup is config, not an algorithm to build and tune.
- **Manual invite** (no payment system) trades automation for speed -- collecting $100/month from 10 people can be done via direct message.
- **Graceful degradation** on enrichment and AI means an external API outage delays information but never kills the alert. The 5-second SLA is protected.
- **Explicit cut list** prevents scope creep. Each excluded item would add value but delays launch past the 4-week window.

If demand validation fails at 10 users, the team has invested 4 weeks, not 12. If it succeeds, Phase 2 and 3 build on a proven core with paying users providing continuous feedback.

## When to Apply

- **All technical decisions during weeks 1-4** should be evaluated against this PRD. If a feature is not in the three-stage pipeline (Monitor -> Enrich -> Push), it does not belong in the MVP.
- **When debating "should we add X"**: check the cut list first. If it is listed, the answer is no until Phase 1 MRR target is hit.
- **When an external dependency is flaky**: follow the graceful degradation pattern -- timeout, substitute a safe default, continue the pipeline. Never block an alert on a non-critical enrichment.
- **When onboarding a new contributor**: this document is the single source of truth for what the MVP does, how it works, and what it deliberately ignores.

## Examples

**Scope creep pattern (avoid)**:
A developer considers adding a basic web page showing alert history because "it's just a simple page." This pulls in a frontend framework, hosting, authentication, and CORS configuration. The 4-week timeline slips to 6 weeks, and the core alert pipeline still has untested edge cases.

**Ruthless MVP pattern (follow)**:
The developer checks the cut list, sees "Web Dashboard/Frontend UI" is explicitly excluded, and instead hardens the enrichment timeout logic and adds Sentry alerts for the ops channel. The bot ships on time with 99.9% reliability.

**Brittle dependency chain (avoid)**:
```typescript
// Enrichment runs serially, Claude failure kills the alert
const dexData = await fetchDexScreener(token);
const rugCheck = await checkMintAuthority(token);
const summary = await claude.summarize(dexData, rugCheck); // throws on timeout
await telegram.send(formatAlert(dexData, rugCheck, summary));
```

**Graceful degradation pattern (follow)**:
```typescript
// Parallel enrichment with 2s budget, fallback on every stage
const [dexData, rugCheck] = await Promise.allSettled([
  withTimeout(fetchDexScreener(token), 2000),
  withTimeout(checkMintAuthority(token), 2000),
]);

const enriched = {
  liquidity: dexData.status === 'fulfilled' ? dexData.value.liquidity : 'N/A',
  fdv: dexData.status === 'fulfilled' ? dexData.value.fdv : 'N/A',
  rugSafe: rugCheck.status === 'fulfilled' ? rugCheck.value : 'unchecked',
};

let summary: string;
try {
  summary = await withTimeout(claude.summarize(enriched), 1000);
} catch {
  summary = formatRawTemplate(enriched); // fallback: raw data, still useful
}

await telegram.send(formatAlert(enriched, summary));
```

## Related

- [Frontend Design Philosophy - Phased Crypto Terminal](../best-practices/phased-frontend-design-philosophy-2026-03-31.md) — design tokens, typography, component patterns, and phase-gated frontend workflow
- [Fire-and-Forget Webhook Pattern](../best-practices/fire-and-forget-webhook-graceful-degradation-2026-03-31.md) — reusable pattern for webhook pipelines with parallel enrichment, timeouts, and graceful degradation

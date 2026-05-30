---
title: Current Project Documentation Refresh Pattern
date: 2026-05-30
category: documentation-gaps
module: smart-money-radar-docs
problem_type: documentation_gap
component: documentation
severity: medium
applies_when:
  - "Refreshing README, architecture, configuration, roadmap, and data-flow docs after multiple product phases"
  - "A repository has many historical plan docs but no current-state entry point"
  - "Code has evolved beyond the original MVP architecture"
tags: [documentation, architecture, roadmap, configuration, data-flow, readme]
---

# Current Project Documentation Refresh Pattern

## Context

Smart Money Radar had accumulated many accurate point-in-time plan and solution docs, but the root README still described the early Telegram bot MVP. The codebase had since grown into a Solana signal platform with Fastify backend, Next.js dashboard, Clerk auth, Paddle/Helio subscription handling, Telegram binding, SSE realtime alerts, and an admin backtest console.

The documentation gap was not a missing file; it was an outdated entry path. New contributors could easily read the README and form the wrong mental model before finding the newer plans buried under `docs/plans/`.

## Guidance

Refresh project documentation in layers:

1. Keep `README.md` as the concise entry point: current status, capabilities, top-level architecture, quick start, commands, and links.
2. Add a durable current-state architecture document for details that would bloat the README: runtime components, data flows, route maps, implementation principles, configuration groups, data model, and known gaps.
3. Add a roadmap document that distinguishes completed phases from recommended next work.
4. Update production configuration checklists and `.env.example` files from code, not from old plans.
5. Preserve historical plans and solution docs as context, but make it clear which docs represent current truth.
6. Document known inconsistencies directly, especially schema/API/type mismatches and legacy naming.

For Smart Money Radar, the refresh updated:

- `README.md`
- `apps/web/README.md`
- `.env.example`
- `apps/web/.env.example`
- `docs/current-architecture.md`
- `docs/roadmap.md`
- `docs/plans/production-env-checklist.md`

## Why This Matters

Long-lived product repositories often have a documentation failure mode where every individual historical doc is reasonable, but the combined documentation set is misleading. A current-state entry point prevents contributors from treating old plans as active architecture.

This matters especially for Smart Money Radar because implementation moved across several axes at once:

- Telegram-only MVP became a web-backed subscription product.
- Stripe-oriented naming remained in DB fields while Paddle and Helio became the active payment providers.
- Realtime confidence fields existed in pipeline/SSE/UI while historical DB persistence lagged behind.
- Discovery moved from a single Birdeye idea to multi-source Birdeye plus Helius reverse discovery.

Writing these mismatches down is more useful than smoothing them over. It turns hidden drift into an explicit Phase 4 backlog.

## When to Apply

- After several completed phases have changed the product shape.
- When README, `.env.example`, and production docs disagree.
- When architecture has evolved from MVP to product platform.
- When code contains legacy names that still work but no longer describe the active provider or concept.
- Before onboarding new contributors or starting a new phase.

## Examples

Recommended documentation split:

```text
README.md                         concise project entry
docs/current-architecture.md      current implementation truth
docs/roadmap.md                   phase status and next priorities
docs/plans/*.md                   historical and active plans
docs/solutions/*.md               durable patterns and lessons
```

Recommended wording for drift:

```markdown
Current known gap: `subscriptions` still has legacy `stripe*` field names while
current payment providers are Paddle and Helio.
```

Avoid rewriting history. Keep older plans, but point readers to the current-state docs first.

## Related

- `README.md`
- `docs/current-architecture.md`
- `docs/roadmap.md`
- `docs/plans/production-env-checklist.md`
- `docs/templates/combined-workflow.md`

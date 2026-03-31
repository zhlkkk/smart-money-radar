---
title: "Frontend Design Philosophy - Phased Crypto Terminal"
date: 2026-03-31
category: best-practices
module: smart-money-radar
problem_type: best_practice
component: frontend_stimulus
severity: medium
applies_when:
  - "Any frontend-related plan, work, review, or implementation"
  - "Phase 2+ development when web UI becomes in-scope"
  - "Choosing design tokens, typography, or component patterns"
  - "Evaluating whether a frontend task belongs in the current phase"
tags:
  - frontend
  - design-philosophy
  - phased-delivery
  - telegram-first
  - crypto-terminal
  - dark-theme
  - real-time
  - mvp-scope
---

# Frontend Design Philosophy - Phased Crypto Terminal

## Context

Smart Money Radar is a Telegram bot that tracks smart money wallet activity on Solana. The product evolves through three phases, each with strictly different frontend requirements. A common failure mode for crypto tools is spending weeks on a polished dashboard before validating that anyone will pay for the underlying data. This philosophy codifies both the phase gates and the design direction for when frontend work becomes justified.

All frontend-related plans, work, reviews, and implementations must comply with this philosophy plus the installed `frontend-design` and `impeccable` skills.

## Guidance

### Phase Gates (Strictly Enforced)

| Phase | Frontend Policy | Product Shape |
|-------|----------------|---------------|
| **Phase 1 MVP** (weeks 1-4) | **Completely forbidden.** No Web UI, no Dashboard, no Next.js, no frontend code of any kind. Reject any frontend task with: "Out of scope for MVP - see PRD." | Telegram private channel only |
| **Phase 2 MLP** (weeks 5-8) | Allowed. Minimal: payment page + subscription management. This design philosophy activates. | Stripe/Crypto payments + basic user mgmt |
| **Phase 3 Seed** (weeks 9-12) | Full dashboard. Multi-chain + custom monitoring UI. Design philosophy fully applied. | Web Dashboard + custom wallet config |

### Phase 2+ Design Direction: Crypto Terminal Style

**Overall Vibe**: Dark Cyber-Finance Terminal + Modern Neon Accents

#### Color System

| Role | Value | Usage |
|------|-------|-------|
| Primary background | `#0A0A0A` | Page background, extreme dark |
| Secondary background | `#111111` | Cards, panels, elevated surfaces |
| Neon Cyan | `#00F0FF` | Primary accent, active states, links |
| Neon Purple | `#C724FF` | Secondary accent, highlights, badges |
| Electric Green | `#00FF9D` | Positive PNL, success states, buy signals |
| Red (implied) | TBD | Negative PNL, danger states, sell signals |

#### Typography

| Role | Font Stack | Notes |
|------|-----------|-------|
| Headings | Space Grotesk / Satoshi | Modern geometric sans, bold presence |
| Body / Data | JetBrains Mono / IBM Plex Mono | Monospace mandatory for all data display |
| PNL / Numbers | JetBrains Mono with `font-variant-numeric: tabular-nums` | Dynamic color (green up, red down) |

**Rule**: All numerical data, addresses, and financial figures must use monospace. No proportional fonts for data display.

#### Layout & Motion

- Minimal grid + generous negative space (not cluttered, but dense where data lives)
- Live data effects: subtle glow, scanline overlays, real-time number ticking animations
- Table virtualization + infinite scroll for high-frequency trading data
- No excessive 3D effects or drop-shadows

#### Key Components (Phase 3)

| Component | Style Reference | Details |
|-----------|----------------|---------|
| Live trade flow | Bloomberg Terminal ticker | Streaming transaction feed, monospace, color-coded |
| Wallet cards | Glassmorphism + real-time PNL badge | Semi-transparent with backdrop blur, live updating |
| Charts | TradingView Lightweight Charts | Neon grid lines, dark theme, minimal chrome |
| Alert indicators | Pulse animation | Subtle breathing glow on new alerts |

### Mandatory Workflow (Phase 2+ Frontend Tasks)

Every frontend task must follow this sequence:

1. **Define direction**: Run `/frontend-design` to establish bold design direction
2. **Implement**: Build the feature
3. **Polish + Audit**: Run `/impeccable:polish` + `/impeccable:audit`
4. **Distill**: Run `/impeccable:distill` to extract reusable components

### Anti-Patterns (Absolutely Forbidden)

- Consumer-grade SaaS templates (generic purple gradient heroes, rounded card stacking)
- Proportional fonts for data display (all data must be monospace)
- Excessive 3D effects or drop-shadows
- Light mode as default (dark is the only mode for MVP dashboard)
- Marketing-site whitespace patterns (this is a terminal, not a landing page)

## Why This Matters

Crypto traders live in dark-themed terminals (TradingView, Dexscreener, Birdeye). A consumer-SaaS-looking dashboard signals "not built for us" and erodes trust. The terminal aesthetic is not just visual preference — it communicates data density, speed, and seriousness.

The phase gates matter equally: building frontend too early is one of the highest-cost mistakes for a solo-founder SaaS. By gating UI investment behind revenue milestones ($1K MRR before any frontend, $5K MRR before full dashboard), every hour of frontend work is justified by proven demand. If the Telegram-only model scales to $10K MRR without a dashboard, the dashboard may never need to be more than a settings page.

## When to Apply

- **Phase 1**: Any frontend request → reject immediately. "Out of scope for MVP - see PRD."
- **Phase 2 start**: Apply color system, typography, and layout principles to payment/subscription pages.
- **Phase 3 start**: Full component library, charting, real-time feeds, glassmorphism cards.
- **Any design review**: Check against anti-patterns list. If it looks like a generic SaaS template, it fails review.
- **Framework selection** (Phase 2): Choose based on 2026 best practices. Real-time capability (WebSocket/SSE) is a hard requirement.

## Examples

**Anti-pattern: Building ahead of phase**

A developer in Phase 1 scaffolds a Next.js app "so it's ready later." This creates a deployment to maintain, a repo to keep updated, security surface area, and psychological anchoring toward building more UI. The correct action in Phase 1 is zero frontend code in the repository.

**Anti-pattern: Consumer SaaS styling**

```css
/* WRONG: Generic SaaS look */
.card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  font-family: 'Inter', sans-serif;
}
```

```css
/* CORRECT: Crypto terminal look */
.card {
  background: rgba(17, 17, 17, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 240, 255, 0.1);
  font-family: 'JetBrains Mono', monospace;
}
```

**Correct: PNL display with tabular nums**

```css
.pnl {
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.pnl--positive { color: #00FF9D; }
.pnl--negative { color: #FF3B5C; }
```

**Correct: Real-time implementation (Phase 3)**

The alert feed uses WebSocket or Server-Sent Events so new alerts appear in the dashboard within the same latency window as the Telegram notification. The dashboard must never feel slower than the Telegram channel. No polling.

## Related

- [Smart Money Radar MVP PRD v1.1](../documentation-gaps/smart-money-radar-mvp-prd-v1-1-2026-03-31.md) — authoritative source for phase timeline, product scope, and ruthless cut list

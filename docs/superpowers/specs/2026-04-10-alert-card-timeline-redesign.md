# Alert Card Timeline Redesign

**Date:** 2026-04-10
**Status:** Approved

## Problem

The Dashboard alert cards and Telegram alert messages look inconsistent — different visual hierarchy, different AI summary treatment (Dashboard hides it behind a collapsible button; Telegram shows it inline), and the Dashboard cards lack the data source attribution footer present in TG messages.

## Goals

1. Unify visual language between Dashboard cards and Telegram alerts
2. Make AI summary always visible (inline, not behind a click)
3. Add data source footer (`Helius → DexScreener → Claude` + external links)
4. Improve scannability with a 4-column metrics row (add Vol 24h)

## Non-Goals

- Changing the Telegram format
- Changing the backend data model
- Adding new data fields (no new API calls)

---

## Design

### Risk Band (replaces left border)

A 3px top gradient strip replaces the current `border-l-4` left border:

| Risk Level | Color |
|---|---|
| high | `#ff4444` → `#ff444466` |
| medium | `#f5a623` → `#f5a62366` |
| low | `#0080FF` → `#0080FF66` |

CSS: `<div class="risk-band high/medium/low" />` at top of card, outside `.card-body`.

### Card Layout (top to bottom)

```
┌─────────────────────────────────────────────┐
│ [3px risk band]                              │
├─────────────────────────────────────────────┤
│ 🐋 Wallet Name        [Risk Badge]          │
│    pinned · 2分钟前 · Raydium  [Conf Badge] │
│                                              │
│ TOKEN  abc1...xyz9          ↗ Birdeye DSC   │
│                                              │
│ [⚠️ high-risk warning row — conditional]    │
│                                              │
│ ┌──────┬──────┬──────┬──────┐               │
│ │ Liq  │ FDV  │  MC  │Vol24h│               │
│ │$2.1M │ $45M │ $40M │$890K │               │
│ └──────┴──────┴──────┴──────┘               │
│                                              │
│ | 🤖 AI summary text here, always visible,  │
│ |    italic, left blue border               │
│                                              │
│ 🔍 Helius → DexScreener → Claude  [links]  │
└─────────────────────────────────────────────┘
```

### AI Summary

- **Always visible** — no expand/collapse button
- Styled: `font-style: italic`, `color: var(--smr-text-secondary)`
- Left border: `border-left: 2px solid var(--smr-accent-cyan)`
- Prefix: `🤖 ` emoji
- If `aiSummary` is null: section omitted entirely

### Metrics Row

Four columns instead of three, adding `Vol 24h`:

| Column | Field | Format |
|---|---|---|
| Liq | `alert.liquidity` | `$formatCompact()` — highlight cyan |
| FDV | `alert.fdv` | `$formatCompact()` |
| MC | `alert.marketCap` | `$formatCompact()` |
| Vol 24h | `alert.volume24h` | `$formatCompact()` |

Background: `var(--smr-bg-elevated)`, columns separated by 1px border.

### Card Footer (new)

Matches Telegram format exactly:

```
🔍 Helius → DexScreener → Claude    Birdeye · DexScreener
```

- Left: data source attribution (static text)
- Right: external links to Birdeye and DexScreener for the token
- Color: `var(--smr-text-muted)`, links `var(--smr-accent-cyan)` at 70% opacity
- Separated from body by `border-top: 1px solid var(--smr-glass-border)`

### Severity Logic Fix

Current `getSeverity()` only checks `freezeAuthority`. Align with backend `assessRisk()`:

```ts
function getSeverity(alert: AlertRow): Severity {
  if (
    (alert.freezeAuthority != null && alert.freezeAuthority !== '' && alert.freezeAuthority !== 'unchecked') ||
    (alert.mintAuthority != null && alert.mintAuthority !== '' && alert.mintAuthority !== 'unchecked')
  ) return 'high';
  // medium: low liquidity or low volume (if data present)
  if (
    (alert.liquidity !== null && alert.liquidity < 100_000) ||
    (alert.volume24h !== null && alert.volume24h < 50_000)
  ) return 'medium';
  return 'low';
}
```

### High-Risk Warning Row

Shown only when `severity === 'high'`. Text reflects which authority is active:
- Freeze Authority active → "⚠️ Freeze Authority 未撤销，存在冻结风险"
- Mint Authority active → "⚠️ Mint Authority 未撤销，存在增发风险"
- Both active → "⚠️ Mint & Freeze Authority 均未撤销"

### Timeline Dot Color

- Default: cyan (`var(--smr-accent-cyan)`)
- Realtime/live alerts: green (`var(--smr-accent-green)`) — unchanged

---

## Files to Change

| File | Change |
|---|---|
| `packages/db/src/schema/alerts.ts` | Add `volume24h: real('volume24h')` column |
| `apps/backend/src/persistence/alerts.ts` | Persist `enrichment.volume24h` |
| `apps/backend/src/api/alerts.ts` | Include `volume24h` in API response |
| `apps/web/src/lib/backend-client.ts` | Add `volume24h: number \| null` to `AlertRow` |
| `apps/web/src/components/alert-card.tsx` | Full redesign per spec |
| `apps/web/src/lib/format.ts` | No change expected |

> **Note:** `volume24h` is available at enrichment time (`EnrichmentResult.volume24h`) but was never persisted. A Drizzle migration is required. Existing rows will have `null` for this field — the Vol 24h column will show `–` for historical alerts.

## Files to Check

- `apps/web/src/app/dashboard/alerts/page.tsx` — no changes expected

---

## Testing

- Render card with all fields populated (high/medium/low risk)
- Render card with `aiSummary: null` — summary section must be absent
- Render card with `volume24h: null` — Vol 24h column shows `–`
- Render card with both authorities active — warning shows correct combined text
- Confirm no expand/collapse button remains anywhere

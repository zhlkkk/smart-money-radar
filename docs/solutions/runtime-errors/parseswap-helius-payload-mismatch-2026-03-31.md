---
title: "parseSwap crashes on real Helius payloads — events.swap missing or field mismatch"
date: 2026-03-31
category: runtime-errors
module: webhook/parse
problem_type: runtime_error
component: service_object
symptoms:
  - "console.warn floods: '⚠️ [parseSwap] No swap event found, skipping' on most real webhooks"
  - "tokenSymbol always shows UNKNOWN in Telegram alerts"
  - "Pipeline silently drops valid SWAP transactions from unsupported DEXes (Pump.fun, Meteora)"
  - "amountRaw is undefined — wrong field path used"
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags:
  - helius
  - parseswap
  - defensive-coding
  - tokenTransfers-fallback
  - solana-webhooks
  - payload-mismatch
---

# parseSwap crashes on real Helius payloads — events.swap missing or field mismatch

## Problem

After the initial defensive fix (commit `2496092`), `parseSwap` used incorrect field paths and dropped critical logic, causing most real Helius webhook events to be silently skipped. The function appeared to work with test fixtures but failed on production payloads.

## Symptoms

- `console.warn` floods with "No swap event found, skipping" — real SWAP transactions from Pump.fun, Meteora, etc. lack `events.swap`
- `tokenSymbol` always shows `UNKNOWN` — Helius `TokenBalanceChange` has no `symbol` field
- `amountRaw` is `undefined` — code read `tokenOutput.amount` instead of `tokenOutput.rawTokenAmount.tokenAmount`
- Watched wallet filtering was removed — any `feePayer` was treated as the buyer
- Base-token filtering was removed — SOL/USDC/USDT outputs were returned instead of the interesting token

## What Didn't Work

- **Initial defensive fix (2496092)**: Added optional chaining but simultaneously broke the function by:
  - Removing the `watchedAddresses` parameter entirely
  - Using `swapEvent.tokenOutputs?.[0]` (first output) instead of finding the non-base token
  - Reading `tokenOutput.symbol` (doesn't exist in Helius schema)
  - Reading `tokenOutput.amount` (doesn't exist — it's `rawTokenAmount.tokenAmount`)
  - Replacing `tx.timestamp` with `Date.now()`

## Solution

Rewrote `parseSwap` with a two-path parsing strategy:

**Path 1 — `events.swap`** (structured, preferred):
```typescript
const swapEvent = tx.events?.swap;
if (swapEvent?.tokenOutputs?.length) {
  // Find buyer from watchedAddresses (feePayer or output recipient)
  // Find non-base-token output (skip SOL/USDC/USDT)
  // Use rawTokenAmount.tokenAmount for amount
}
```

**Path 2 — `tokenTransfers` fallback** (always populated):
```typescript
if (tx.tokenTransfers?.length) {
  // Find non-base token transferred TO a watched address
  // Fall back to feePayer if no direct match
  // Use String(transfer.tokenAmount) for amount (UI-adjusted float)
}
```

Key corrections:
- Restored `watchedAddresses` parameter for buyer identification
- Restored base-token filtering (`BASE_TOKEN_MINTS` set)
- Removed `tokenSymbol` extraction (not in Helius payload — handled by downstream enrichment)
- Fixed amount field: `rawTokenAmount.tokenAmount` for events.swap, `String(tokenAmount)` for tokenTransfers
- Restored `tx.timestamp` instead of `Date.now()`

## Why This Works

Helius Enhanced Transactions have **two independent data paths** for swap information:

1. **`events.swap`**: High-level parsed swap event. Only populated when Helius has a parser for the DEX (Jupiter, Raydium, Orca). Contains structured `tokenInputs`/`tokenOutputs` with `mint`, `rawTokenAmount`, `userAccount`.

2. **`tokenTransfers`**: Raw SPL token transfer records. Always populated from transaction logs regardless of DEX support. Contains `fromUserAccount`, `toUserAccount`, `tokenAmount` (UI-adjusted float), `mint`.

The previous fix assumed `events.swap` was always present for `type: "SWAP"` transactions. In reality, Helius sets `type: "SWAP"` via instruction pattern matching but only populates `events.swap` for supported DEXes.

## Prevention

- **Test with real payloads**: Maintain fixtures for both `events.swap` present (Jupiter) and absent (Pump.fun) scenarios
- **Never assume field existence**: Helius `TokenBalanceChange` schema has exactly `mint`, `rawTokenAmount`, `tokenAccount`, `userAccount` — no `symbol`, no `amount`
- **Always provide a fallback path**: When consuming third-party webhooks, have a structured primary path and a raw-data fallback
- **Keep type definitions accurate**: `HeliusSwapTokenIO` must match the actual Helius API schema

## Related Issues


- [Fire-and-Forget Webhook Pattern](../best-practices/fire-and-forget-webhook-graceful-degradation-2026-03-31.md) — graceful degradation foundation
- [Solana TypeScript Gotchas](../developer-experience/solana-typescript-implementation-gotchas-2026-03-31.md) — related SDK edge cases

---
title: "Solana TypeScript Implementation Gotchas (2026)"
date: 2026-03-31
category: developer-experience
module: smart-money-radar
problem_type: developer_experience
component: tooling
severity: medium
applies_when:
  - "Setting up a new TypeScript project with @solana/kit and token programs"
  - "Using Zod for environment variable validation with optional URL fields"
  - "Importing JSON files in Node 22+ ESM projects"
  - "Checking mint/freeze authorities for SPL tokens on Solana"
tags:
  - solana
  - typescript
  - solana-kit
  - zod
  - esm
  - token-program
  - token-2022
  - developer-experience
---

# Solana TypeScript Implementation Gotchas (2026)

## Context

During the Smart Money Radar MVP implementation, we hit several non-obvious gotchas with the Solana TypeScript SDK, Zod validation, and Node.js ESM configuration. Each cost 10-30 minutes to diagnose. Documenting them here so the next implementation starts clean.

## Guidance

### 1. @solana/kit v6 Required (Not v2)

The spec originally referenced `@solana/kit@^2`, but `@solana-program/token@0.12` and `@solana-program/token-2022@0.9` require `@solana/kit@^6` as a peer dependency. Installing `@solana/kit@^2` causes peer dep warnings and may fail at runtime.

**Fix**: Always install the latest major version:

```bash
pnpm add @solana/kit@^6 @solana-program/token @solana-program/token-2022
```

**Note**: `@solana-program/token-2022@0.9` also has a peer dep on `@solana/sysvars@^5.0` but ships fine with `@solana/sysvars@6.x` (bundled with `@solana/kit@6`). This warning is cosmetic.

### 2. Dual Token Program Fallback (SPL Token + Token-2022)

Solana has two token programs. A token minted under Token-2022 cannot be queried with the SPL Token program and vice versa. You cannot know in advance which program owns a given mint.

**Pattern**: Try SPL Token first, catch, try Token-2022, catch, return fallback:

```typescript
import { fetchMint } from '@solana-program/token';
import { fetchMint as fetchMint2022 } from '@solana-program/token-2022';

async function checkAuthorities(rpc: unknown, mintAddr: string) {
  try {
    const mint = await fetchMint(rpc as any, address(mintAddr));
    return extractAuthorities(mint);
  } catch {
    try {
      const mint = await fetchMint2022(rpc as any, address(mintAddr));
      return extractAuthorities(mint);
    } catch {
      return { mintAuthority: 'unchecked', freezeAuthority: 'unchecked' };
    }
  }
}
```

**Why not check the account owner first?** That requires an extra RPC call. The try/catch approach makes only 1 call for the common case (SPL Token) and 2 for the less common case (Token-2022). Given our 2-second timeout budget, this is acceptable.

### 3. Zod: Empty String Fails `.url().optional()`

When using Zod to validate environment variables, `z.string().url().optional()` does NOT accept an empty string `""`. Environment variables like `SENTRY_DSN=` (empty) are parsed as `""` by dotenv, which fails URL validation.

**Broken**:
```typescript
SENTRY_DSN: z.string().url().optional(),
// Error: "Invalid url" for SENTRY_DSN=""
```

**Fixed**:
```typescript
SENTRY_DSN: z.string().url().optional()
  .or(z.literal(''))
  .transform((v) => v || undefined),
```

This accepts either a valid URL or an empty string, transforming empty to `undefined`.

### 4. Node 22+ ESM: JSON Imports Require `with { type: 'json' }`

In Node.js 22+ with ESM (`"type": "module"` in package.json), importing JSON files requires the import attribute syntax:

**Broken** (Node 22 ESM):
```typescript
import data from './data.json';
// Error: ERR_IMPORT_ATTRIBUTE_MISSING
```

**Fixed**:
```typescript
import data from './data.json' with { type: 'json' };
```

This applies to test fixtures, config files, and any JSON import. In Vitest test files, this syntax works out of the box.

### 5. Helius Auth: Header Echo, Not HMAC

Helius webhooks do NOT use cryptographic signature verification (HMAC-SHA256 or similar). Instead, they echo back the `authHeader` string you configure when creating the webhook. Verification is a simple string comparison:

```typescript
if (request.headers.authorization !== env.HELIUS_AUTH_TOKEN) {
  return reply.status(401).send();
}
```

Do not waste time implementing HMAC verification — Helius doesn't send a signature header.

## Why This Matters

Each of these gotchas costs 10-30 minutes when first encountered. For a team building on Solana with TypeScript in 2026, hitting all four in sequence can burn half a day. Documenting them turns a half-day debugging session into a 5-minute checklist read.

The dual token program issue is especially insidious — it only manifests when you encounter a Token-2022 mint for the first time in production, which may be weeks after initial development.

## When to Apply

- Starting any new TypeScript project using `@solana/kit` and token programs
- Setting up Zod-based env validation with optional URL fields (Sentry DSN, webhook URLs)
- Importing JSON fixtures or config in Node 22+ ESM projects
- Integrating with Helius webhooks for the first time

## Examples

**Quick validation checklist for new Solana TypeScript projects:**

1. `@solana/kit` version matches peer dep requirements of `@solana-program/token`
2. Authority check handles both SPL Token and Token-2022
3. Zod schema handles empty-string env vars for optional URLs
4. JSON imports use `with { type: 'json' }` attribute
5. Helius webhook auth is string comparison, not HMAC

## Related

- [Smart Money Radar MVP PRD v1.1](../documentation-gaps/smart-money-radar-mvp-prd-v1-1-2026-03-31.md) — project context and architecture
- [Fire-and-Forget Webhook Pattern](../best-practices/fire-and-forget-webhook-graceful-degradation-2026-03-31.md) — the pipeline pattern these gotchas were discovered while implementing

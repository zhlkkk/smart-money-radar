# MVP Webhook Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Fastify webhook server that receives Helius smart money swap events, enriches with market data + rug checks, generates AI summaries, and pushes HTML alerts to Telegram — all in <5 seconds.

**Architecture:** Single Fastify server with fire-and-forget pipeline. Helius webhook → auth validation → dedup → parse swap → parallel enrichment (DexScreener + Solana authority check) → Claude AI attribution → HTML format → Telegram push. Every external call has a timeout and fallback.

**Tech Stack:** TypeScript, Node.js, Fastify 5, Vitest, Zod, @solana/kit, @solana-program/token, @anthropic-ai/sdk, Sentry, Pino

**Spec:** `docs/superpowers/specs/2026-03-31-mvp-webhook-pipeline-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | TypeScript strict config |
| `vitest.config.ts` | Test runner config |
| `.env.example` | Template for required env vars |
| `config/smart-money-addresses.json` | 20 wallet addresses with labels |
| `src/types.ts` | All shared TypeScript interfaces |
| `src/env.ts` | Zod env validation, fail-fast |
| `src/webhook/dedup.ts` | TTL Map deduplication by tx signature |
| `src/webhook/parse.ts` | Helius enhanced tx → ParsedSwap extraction |
| `src/enrichment/dexscreener.ts` | DexScreener API: liquidity, FDV, marketCap |
| `src/enrichment/authority-check.ts` | Solana mint/freeze authority check |
| `src/enrichment/enrich.ts` | Parallel orchestrator + withTimeout |
| `src/ai/attribution.ts` | Claude haiku <50 word summary |
| `src/telegram/format.ts` | HTML escaping + message template |
| `src/telegram/bot.ts` | Telegram sendMessage + 1 retry |
| `src/pipeline.ts` | Full pipeline: dedup → parse → enrich → AI → push |
| `src/webhook/handler.ts` | Fastify route: POST /webhook, GET /health |
| `src/index.ts` | Server bootstrap, Sentry init |
| `test/fixtures/swap-event.json` | Sample Helius enhanced swap payload |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/longkai/workspace/smart-money-radar
pnpm init
```

- [ ] **Step 2: Install production dependencies**

```bash
pnpm add fastify@^5 @fastify/rate-limit@^10 @anthropic-ai/sdk@^0.39 @solana/kit@^2 @solana-program/token@^0.5 @solana-program/token-2022@^0.4 zod@^3 @sentry/node@^9 dotenv@^16
```

- [ ] **Step 3: Install dev dependencies**

```bash
pnpm add -D typescript@^5.7 vitest@^3 @types/node@^22 tsx@^4
```

- [ ] **Step 4: Create tsconfig.json**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 5: Create vitest.config.ts**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
});
```

- [ ] **Step 6: Create .env.example**

Create `.env.example`:
```
HELIUS_AUTH_TOKEN=Bearer your-secret-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
TELEGRAM_BOT_TOKEN=123456:ABC-DEF-your-token
TELEGRAM_CHANNEL_ID=-100xxxxxxxxxx
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-key
PORT=3000
SENTRY_DSN=
NODE_ENV=development
```

- [ ] **Step 7: Update .gitignore — add .env**

Append to `.gitignore`:
```
# Local env
.env
.env.local

# Build output
dist/
```

- [ ] **Step 8: Add scripts to package.json**

Update `package.json` scripts:
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "NODE_ENV=production tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 9: Verify setup compiles**

```bash
pnpm typecheck
```

Expected: Success (no source files yet, but config is valid).

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts .env.example .gitignore
git commit -m "chore: scaffold project with TypeScript, Vitest, Fastify deps"
```

---

### Task 2: Types & Env Validation

**Files:**
- Create: `src/types.ts`
- Create: `src/env.ts`
- Create: `config/smart-money-addresses.json`
- Test: `test/env.test.ts`

- [ ] **Step 1: Create shared types**

Create `src/types.ts`:
```typescript
// --- Helius Enhanced Transaction (subset we use) ---

export interface HeliusTokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  fromTokenAccount: string;
  toTokenAccount: string;
  tokenAmount: number;
  mint: string;
  tokenStandard: string;
}

export interface HeliusSwapTokenIO {
  mint: string;
  rawTokenAmount: {
    decimals: number;
    tokenAmount: string;
  };
  tokenAccount: string;
  userAccount: string;
}

export interface HeliusSwapEvent {
  nativeInput?: { account: string; amount: string };
  nativeOutput?: { account: string; amount: string };
  tokenInputs: HeliusSwapTokenIO[];
  tokenOutputs: HeliusSwapTokenIO[];
}

export interface HeliusEnhancedTransaction {
  signature: string;
  type: string;
  source: string;
  description: string;
  fee: number;
  feePayer: string;
  slot: number;
  timestamp: number;
  nativeTransfers: { from: string; to: string; amount: number }[];
  tokenTransfers: HeliusTokenTransfer[];
  events: {
    swap?: HeliusSwapEvent;
  };
  transactionError: unknown;
}

// --- Our domain types ---

export interface SmartMoneyWallet {
  label: string;
  category: string;
}

export interface ParsedSwap {
  signature: string;
  buyerAddress: string;
  tokenMint: string;
  tokenSymbol?: string;
  amountRaw?: string;
  dexSource: string;
  timestamp: number;
}

export interface DexScreenerData {
  liquidity: number | null;
  fdv: number | null;
  marketCap: number | null;
}

export interface AuthorityData {
  mintAuthority: string | null;
  freezeAuthority: string | null;
}

export interface EnrichmentResult {
  liquidity: number | null;
  fdv: number | null;
  marketCap: number | null;
  mintAuthority: string | null | 'unchecked';
  freezeAuthority: string | null | 'unchecked';
}

export interface AlertData {
  wallet: SmartMoneyWallet;
  swap: ParsedSwap;
  enrichment: EnrichmentResult;
  aiSummary: string;
}
```

- [ ] **Step 2: Create env validation**

Create `src/env.ts`:
```typescript
import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  HELIUS_AUTH_TOKEN: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHANNEL_ID: z.string().min(1),
  SOLANA_RPC_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  SENTRY_DSN: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${formatted}`);
  }
  return result.data;
}
```

- [ ] **Step 3: Create smart money addresses config**

Create `config/smart-money-addresses.json`:
```json
{
  "7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB": { "label": "Wintermute", "category": "DEX Whale" },
  "9vXqYPzAN6ByMnMrJFcxJv1Rmg6B7ZwMdFeaJkBXnuPd": { "label": "AlphaTrader42", "category": "Alpha Trader" }
}
```

Note: Replace with real addresses before deployment. These are placeholder examples for development.

- [ ] **Step 4: Write env validation test**

Create `test/env.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test loadEnv by manipulating process.env directly
describe('loadEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function loadEnvFresh() {
    const mod = await import('../src/env.js');
    return mod.loadEnv;
  }

  it('parses valid env', async () => {
    process.env.HELIUS_AUTH_TOKEN = 'Bearer test-secret';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.TELEGRAM_BOT_TOKEN = '123:ABC';
    process.env.TELEGRAM_CHANNEL_ID = '-100123';
    process.env.SOLANA_RPC_URL = 'https://rpc.example.com';
    process.env.PORT = '4000';
    process.env.NODE_ENV = 'test';

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.HELIUS_AUTH_TOKEN).toBe('Bearer test-secret');
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('test');
  });

  it('throws on missing required fields', async () => {
    // Clear all relevant vars
    delete process.env.HELIUS_AUTH_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHANNEL_ID;
    delete process.env.SOLANA_RPC_URL;

    const loadEnv = await loadEnvFresh();
    expect(() => loadEnv()).toThrow('Environment validation failed');
  });

  it('uses defaults for optional fields', async () => {
    process.env.HELIUS_AUTH_TOKEN = 'Bearer test';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.TELEGRAM_BOT_TOKEN = '123:ABC';
    process.env.TELEGRAM_CHANNEL_ID = '-100123';
    process.env.SOLANA_RPC_URL = 'https://rpc.example.com';
    delete process.env.PORT;
    delete process.env.NODE_ENV;

    const loadEnv = await loadEnvFresh();
    const env = loadEnv();

    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test -- test/env.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 6: Typecheck**

```bash
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/env.ts config/smart-money-addresses.json test/env.test.ts
git commit -m "feat: add shared types, env validation with Zod, smart money config"
```

---

### Task 3: Deduplication

**Files:**
- Create: `src/webhook/dedup.ts`
- Test: `test/webhook/dedup.test.ts`

- [ ] **Step 1: Write dedup tests**

Create `test/webhook/dedup.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TxDedup } from '../../src/webhook/dedup.js';

describe('TxDedup', () => {
  let dedup: TxDedup;

  beforeEach(() => {
    vi.useFakeTimers();
    dedup = new TxDedup();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false for a new signature', () => {
    expect(dedup.isDuplicate('sig-1')).toBe(false);
  });

  it('returns true for a repeated signature within TTL', () => {
    dedup.isDuplicate('sig-1');
    expect(dedup.isDuplicate('sig-1')).toBe(true);
  });

  it('returns false after TTL expires', () => {
    dedup.isDuplicate('sig-1');
    vi.advanceTimersByTime(61_000); // 61s > 60s TTL
    expect(dedup.isDuplicate('sig-1')).toBe(false);
  });

  it('handles multiple distinct signatures', () => {
    expect(dedup.isDuplicate('sig-a')).toBe(false);
    expect(dedup.isDuplicate('sig-b')).toBe(false);
    expect(dedup.isDuplicate('sig-a')).toBe(true);
    expect(dedup.isDuplicate('sig-b')).toBe(true);
    expect(dedup.isDuplicate('sig-c')).toBe(false);
  });

  it('cleans up expired entries during cleanup cycle', () => {
    // Insert one entry
    dedup.isDuplicate('old-sig');

    // Advance past TTL
    vi.advanceTimersByTime(61_000);

    // Trigger cleanup by calling isDuplicate enough times
    for (let i = 0; i < 100; i++) {
      dedup.isDuplicate(`filler-${i}`);
    }

    // The old sig should now be gone — inserting it again returns false
    expect(dedup.isDuplicate('old-sig')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- test/webhook/dedup.test.ts
```

Expected: FAIL — module `../../src/webhook/dedup.js` not found.

- [ ] **Step 3: Implement dedup**

Create `src/webhook/dedup.ts`:
```typescript
export class TxDedup {
  private seen: Map<string, number> = new Map();
  private readonly ttlMs: number;
  private callsSinceCleanup = 0;

  constructor(ttlMs = 60_000) {
    this.ttlMs = ttlMs;
  }

  isDuplicate(signature: string): boolean {
    const now = Date.now();
    if (++this.callsSinceCleanup >= 100) {
      this.cleanup(now);
      this.callsSinceCleanup = 0;
    }
    if (this.seen.has(signature)) return true;
    this.seen.set(signature, now);
    return false;
  }

  private cleanup(now: number): void {
    for (const [sig, ts] of this.seen) {
      if (now - ts > this.ttlMs) {
        this.seen.delete(sig);
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- test/webhook/dedup.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/webhook/dedup.ts test/webhook/dedup.test.ts
git commit -m "feat: add TTL-based tx signature deduplication"
```

---

### Task 4: Transaction Parsing

**Files:**
- Create: `src/webhook/parse.ts`
- Create: `test/fixtures/swap-event.json`
- Test: `test/webhook/parse.test.ts`

- [ ] **Step 1: Create test fixture**

Create `test/fixtures/swap-event.json`:
```json
{
  "signature": "5UfDuX9MnWkceVdaKmAeYR1vN3VXJhMFwJxQMkp3FRZN8kPJNbLEZzWVKAj2TAQVFcHG3USH7LaVgZCxWkNL7oJ",
  "type": "SWAP",
  "source": "JUPITER",
  "description": "7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB swapped 1 SOL for 1000 BONK",
  "fee": 5000,
  "feePayer": "7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB",
  "slot": 250000000,
  "timestamp": 1711900800,
  "nativeTransfers": [
    { "from": "7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB", "to": "DEXPool111111111111111111111111111111111111", "amount": 1000000000 }
  ],
  "tokenTransfers": [
    {
      "fromUserAccount": "DEXPool111111111111111111111111111111111111",
      "toUserAccount": "7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB",
      "fromTokenAccount": "PoolTokenAccount1111111111111111111111111",
      "toTokenAccount": "UserTokenAccount1111111111111111111111111",
      "tokenAmount": 1000,
      "mint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
      "tokenStandard": "Fungible"
    }
  ],
  "events": {
    "swap": {
      "nativeInput": { "account": "7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB", "amount": "1000000000" },
      "nativeOutput": null,
      "tokenInputs": [],
      "tokenOutputs": [
        {
          "mint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
          "rawTokenAmount": { "decimals": 5, "tokenAmount": "100000000" },
          "tokenAccount": "UserTokenAccount1111111111111111111111111",
          "userAccount": "7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB"
        }
      ]
    }
  },
  "transactionError": null
}
```

- [ ] **Step 2: Write parse tests**

Create `test/webhook/parse.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { parseSwap } from '../../src/webhook/parse.js';
import type { HeliusEnhancedTransaction } from '../../src/types.js';
import swapFixture from '../fixtures/swap-event.json';

const WATCHED_ADDRESSES = new Set([
  '7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB',
]);

// Well-known stablecoin / base token mints to skip
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

describe('parseSwap', () => {
  it('parses a valid SWAP transaction from a watched wallet', () => {
    const result = parseSwap(swapFixture as HeliusEnhancedTransaction, WATCHED_ADDRESSES);

    expect(result).not.toBeNull();
    expect(result!.signature).toBe(swapFixture.signature);
    expect(result!.buyerAddress).toBe('7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB');
    expect(result!.tokenMint).toBe('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
    expect(result!.dexSource).toBe('JUPITER');
    expect(result!.timestamp).toBe(1711900800);
  });

  it('returns null for non-SWAP transactions', () => {
    const transfer = { ...swapFixture, type: 'TRANSFER' } as HeliusEnhancedTransaction;
    expect(parseSwap(transfer, WATCHED_ADDRESSES)).toBeNull();
  });

  it('returns null when feePayer is not in watchlist', () => {
    const tx = {
      ...swapFixture,
      feePayer: 'SomeRandomWallet111111111111111111111111111',
      // Also ensure no tokenOutputs match the watchlist
      events: {
        swap: {
          ...swapFixture.events.swap,
          tokenOutputs: swapFixture.events.swap.tokenOutputs.map((o) => ({
            ...o,
            userAccount: 'SomeRandomWallet111111111111111111111111111',
          })),
        },
      },
    } as HeliusEnhancedTransaction;
    expect(parseSwap(tx, WATCHED_ADDRESSES)).toBeNull();
  });

  it('returns null when swap events are missing', () => {
    const noEvents = { ...swapFixture, events: {} } as HeliusEnhancedTransaction;
    expect(parseSwap(noEvents, WATCHED_ADDRESSES)).toBeNull();
  });

  it('skips SOL/USDC outputs and finds the interesting token', () => {
    const tx = {
      ...swapFixture,
      events: {
        swap: {
          ...swapFixture.events.swap,
          tokenOutputs: [
            {
              mint: SOL_MINT,
              rawTokenAmount: { decimals: 9, tokenAmount: '1000000000' },
              tokenAccount: 'acc1',
              userAccount: '7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB',
            },
            {
              mint: 'InterestingToken1111111111111111111111111',
              rawTokenAmount: { decimals: 6, tokenAmount: '500000' },
              tokenAccount: 'acc2',
              userAccount: '7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB',
            },
          ],
        },
      },
    } as HeliusEnhancedTransaction;

    const result = parseSwap(tx, WATCHED_ADDRESSES);
    expect(result).not.toBeNull();
    expect(result!.tokenMint).toBe('InterestingToken1111111111111111111111111');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm test -- test/webhook/parse.test.ts
```

Expected: FAIL — `parseSwap` not found.

- [ ] **Step 4: Implement parseSwap**

Create `src/webhook/parse.ts`:
```typescript
import type { HeliusEnhancedTransaction, ParsedSwap } from '../types.js';

// Well-known base token mints to skip when identifying the "interesting" token
const BASE_TOKEN_MINTS = new Set([
  'So11111111111111111111111111111111111111112',  // Wrapped SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',  // USDT
]);

export function parseSwap(
  tx: HeliusEnhancedTransaction,
  watchedAddresses: Set<string>,
): ParsedSwap | null {
  // 1. Only process SWAP transactions
  if (tx.type !== 'SWAP') return null;

  // 2. Must have swap events
  const swapEvent = tx.events.swap;
  if (!swapEvent) return null;

  // 3. Identify the buyer — check feePayer first, then tokenOutputs
  let buyerAddress: string | null = null;

  if (watchedAddresses.has(tx.feePayer)) {
    buyerAddress = tx.feePayer;
  } else {
    // Check if a watched wallet received tokens in the outputs
    for (const output of swapEvent.tokenOutputs) {
      if (watchedAddresses.has(output.userAccount)) {
        buyerAddress = output.userAccount;
        break;
      }
    }
  }

  if (!buyerAddress) return null;

  // 4. Find the interesting token (not SOL/USDC/USDT)
  const interestingOutput = swapEvent.tokenOutputs.find(
    (o) => !BASE_TOKEN_MINTS.has(o.mint),
  );

  if (!interestingOutput) return null;

  return {
    signature: tx.signature,
    buyerAddress,
    tokenMint: interestingOutput.mint,
    amountRaw: interestingOutput.rawTokenAmount.tokenAmount,
    dexSource: tx.source,
    timestamp: tx.timestamp,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test -- test/webhook/parse.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/webhook/parse.ts test/webhook/parse.test.ts test/fixtures/swap-event.json
git commit -m "feat: add Helius swap transaction parser with watchlist filtering"
```

---

### Task 5: DexScreener Client

**Files:**
- Create: `src/enrichment/dexscreener.ts`
- Test: `test/enrichment/dexscreener.test.ts`

- [ ] **Step 1: Write DexScreener tests**

Create `test/enrichment/dexscreener.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchDexScreenerData } from '../../src/enrichment/dexscreener.js';

describe('fetchDexScreenerData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts data from the highest-liquidity pair', async () => {
    const mockResponse = [
      {
        liquidity: { usd: 500_000 },
        fdv: 10_000_000,
        marketCap: 5_000_000,
      },
      {
        liquidity: { usd: 1_200_000 },
        fdv: 12_000_000,
        marketCap: 6_000_000,
      },
    ];

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await fetchDexScreenerData('TokenMint123');

    expect(result.liquidity).toBe(1_200_000);
    expect(result.fdv).toBe(12_000_000);
    expect(result.marketCap).toBe(6_000_000);
  });

  it('returns nulls when fdv/marketCap are missing', async () => {
    const mockResponse = [
      { liquidity: { usd: 100_000 } },
    ];

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await fetchDexScreenerData('TokenMint123');

    expect(result.liquidity).toBe(100_000);
    expect(result.fdv).toBeNull();
    expect(result.marketCap).toBeNull();
  });

  it('returns all nulls on empty response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    const result = await fetchDexScreenerData('TokenMint123');

    expect(result.liquidity).toBeNull();
    expect(result.fdv).toBeNull();
    expect(result.marketCap).toBeNull();
  });

  it('returns all nulls on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchDexScreenerData('TokenMint123');

    expect(result.liquidity).toBeNull();
    expect(result.fdv).toBeNull();
    expect(result.marketCap).toBeNull();
  });

  it('returns all nulls on non-200 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('rate limited', { status: 429 }),
    );

    const result = await fetchDexScreenerData('TokenMint123');

    expect(result.liquidity).toBeNull();
    expect(result.fdv).toBeNull();
    expect(result.marketCap).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- test/enrichment/dexscreener.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement DexScreener client**

Create `src/enrichment/dexscreener.ts`:
```typescript
import type { DexScreenerData } from '../types.js';

const DEXSCREENER_BASE = 'https://api.dexscreener.com/tokens/v1/solana';

interface DexScreenerPair {
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
}

const NULL_RESULT: DexScreenerData = { liquidity: null, fdv: null, marketCap: null };

export async function fetchDexScreenerData(mintAddress: string): Promise<DexScreenerData> {
  try {
    const response = await fetch(`${DEXSCREENER_BASE}/${mintAddress}`, {
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) return NULL_RESULT;

    const pairs: DexScreenerPair[] = await response.json();

    const bestPair = pairs
      .filter((p) => p.liquidity?.usd != null)
      .sort((a, b) => (b.liquidity!.usd! - a.liquidity!.usd!))
      [0];

    if (!bestPair) return NULL_RESULT;

    return {
      liquidity: bestPair.liquidity?.usd ?? null,
      fdv: bestPair.fdv ?? null,
      marketCap: bestPair.marketCap ?? null,
    };
  } catch {
    return NULL_RESULT;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- test/enrichment/dexscreener.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/enrichment/dexscreener.ts test/enrichment/dexscreener.test.ts
git commit -m "feat: add DexScreener API client with graceful degradation"
```

---

### Task 6: Authority Check

**Files:**
- Create: `src/enrichment/authority-check.ts`
- Test: `test/enrichment/authority-check.test.ts`

- [ ] **Step 1: Write authority check tests**

Create `test/enrichment/authority-check.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { checkAuthorities } from '../../src/enrichment/authority-check.js';

// Mock both token programs
vi.mock('@solana-program/token', () => ({
  fetchMint: vi.fn(),
}));

vi.mock('@solana-program/token-2022', () => ({
  fetchMint: vi.fn(),
}));

vi.mock('@solana/kit', () => ({
  address: (addr: string) => addr,
  unwrapOption: (opt: { __option: string; value?: string }) => {
    if (opt.__option === 'None') return null;
    return opt.value ?? null;
  },
}));

import { fetchMint } from '@solana-program/token';
import { fetchMint as fetchMint2022 } from '@solana-program/token-2022';

const mockRpc = {} as any;

describe('checkAuthorities', () => {
  it('returns null for both when authorities are revoked (SPL Token)', async () => {
    vi.mocked(fetchMint).mockResolvedValueOnce({
      data: {
        mintAuthority: { __option: 'None' },
        freezeAuthority: { __option: 'None' },
      },
    } as any);

    const result = await checkAuthorities(mockRpc, 'SomeMint123');

    expect(result.mintAuthority).toBeNull();
    expect(result.freezeAuthority).toBeNull();
  });

  it('returns addresses when authorities are active', async () => {
    vi.mocked(fetchMint).mockResolvedValueOnce({
      data: {
        mintAuthority: { __option: 'Some', value: 'MintAuth111' },
        freezeAuthority: { __option: 'Some', value: 'FreezeAuth222' },
      },
    } as any);

    const result = await checkAuthorities(mockRpc, 'SomeMint123');

    expect(result.mintAuthority).toBe('MintAuth111');
    expect(result.freezeAuthority).toBe('FreezeAuth222');
  });

  it('falls back to Token-2022 when SPL Token fetch fails', async () => {
    vi.mocked(fetchMint).mockRejectedValueOnce(new Error('Account not owned by SPL Token'));

    vi.mocked(fetchMint2022).mockResolvedValueOnce({
      data: {
        mintAuthority: { __option: 'None' },
        freezeAuthority: { __option: 'Some', value: 'FreezeAuth333' },
      },
    } as any);

    const result = await checkAuthorities(mockRpc, 'SomeMint123');

    expect(result.mintAuthority).toBeNull();
    expect(result.freezeAuthority).toBe('FreezeAuth333');
  });

  it('returns unchecked when both programs fail', async () => {
    vi.mocked(fetchMint).mockRejectedValueOnce(new Error('SPL fail'));
    vi.mocked(fetchMint2022).mockRejectedValueOnce(new Error('Token-2022 fail'));

    const result = await checkAuthorities(mockRpc, 'SomeMint123');

    expect(result.mintAuthority).toBe('unchecked');
    expect(result.freezeAuthority).toBe('unchecked');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- test/enrichment/authority-check.test.ts
```

Expected: FAIL — `checkAuthorities` not found.

- [ ] **Step 3: Implement authority check**

Create `src/enrichment/authority-check.ts`:
```typescript
import { address, unwrapOption } from '@solana/kit';
import { fetchMint } from '@solana-program/token';
import { fetchMint as fetchMint2022 } from '@solana-program/token-2022';
import type { AuthorityData } from '../types.js';

const UNCHECKED: AuthorityData = { mintAuthority: 'unchecked', freezeAuthority: 'unchecked' };

export async function checkAuthorities(
  rpc: unknown,
  mintAddr: string,
): Promise<AuthorityData> {
  try {
    // Try SPL Token first
    const mint = await fetchMint(rpc as any, address(mintAddr));
    return {
      mintAuthority: unwrapOption(mint.data.mintAuthority) as string | null,
      freezeAuthority: unwrapOption(mint.data.freezeAuthority) as string | null,
    };
  } catch {
    try {
      // Fall back to Token-2022
      const mint = await fetchMint2022(rpc as any, address(mintAddr));
      return {
        mintAuthority: unwrapOption(mint.data.mintAuthority) as string | null,
        freezeAuthority: unwrapOption(mint.data.freezeAuthority) as string | null,
      };
    } catch {
      return UNCHECKED;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- test/enrichment/authority-check.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/enrichment/authority-check.ts test/enrichment/authority-check.test.ts
git commit -m "feat: add Solana mint/freeze authority checker with Token-2022 fallback"
```

---

### Task 7: Parallel Enrichment Orchestrator

**Files:**
- Create: `src/enrichment/enrich.ts`
- Test: `test/enrichment/enrich.test.ts`

- [ ] **Step 1: Write enrichment orchestrator tests**

Create `test/enrichment/enrich.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/enrichment/dexscreener.js', () => ({
  fetchDexScreenerData: vi.fn(),
}));

vi.mock('../../src/enrichment/authority-check.js', () => ({
  checkAuthorities: vi.fn(),
}));

import { enrichToken } from '../../src/enrichment/enrich.js';
import { fetchDexScreenerData } from '../../src/enrichment/dexscreener.js';
import { checkAuthorities } from '../../src/enrichment/authority-check.js';

const mockRpc = {} as any;

describe('enrichToken', () => {
  it('returns full data when both succeed', async () => {
    vi.mocked(fetchDexScreenerData).mockResolvedValueOnce({
      liquidity: 1_000_000,
      fdv: 10_000_000,
      marketCap: 5_000_000,
    });
    vi.mocked(checkAuthorities).mockResolvedValueOnce({
      mintAuthority: null,
      freezeAuthority: null,
    });

    const result = await enrichToken('SomeMint', mockRpc);

    expect(result.liquidity).toBe(1_000_000);
    expect(result.fdv).toBe(10_000_000);
    expect(result.mintAuthority).toBeNull();
    expect(result.freezeAuthority).toBeNull();
  });

  it('degrades DexScreener gracefully on error', async () => {
    vi.mocked(fetchDexScreenerData).mockRejectedValueOnce(new Error('timeout'));
    vi.mocked(checkAuthorities).mockResolvedValueOnce({
      mintAuthority: null,
      freezeAuthority: null,
    });

    const result = await enrichToken('SomeMint', mockRpc);

    expect(result.liquidity).toBeNull();
    expect(result.fdv).toBeNull();
    expect(result.marketCap).toBeNull();
    expect(result.mintAuthority).toBeNull();
  });

  it('degrades authority check gracefully on error', async () => {
    vi.mocked(fetchDexScreenerData).mockResolvedValueOnce({
      liquidity: 500_000,
      fdv: 2_000_000,
      marketCap: 1_000_000,
    });
    vi.mocked(checkAuthorities).mockRejectedValueOnce(new Error('timeout'));

    const result = await enrichToken('SomeMint', mockRpc);

    expect(result.liquidity).toBe(500_000);
    expect(result.mintAuthority).toBe('unchecked');
    expect(result.freezeAuthority).toBe('unchecked');
  });

  it('degrades both gracefully when both fail', async () => {
    vi.mocked(fetchDexScreenerData).mockRejectedValueOnce(new Error('fail'));
    vi.mocked(checkAuthorities).mockRejectedValueOnce(new Error('fail'));

    const result = await enrichToken('SomeMint', mockRpc);

    expect(result.liquidity).toBeNull();
    expect(result.fdv).toBeNull();
    expect(result.marketCap).toBeNull();
    expect(result.mintAuthority).toBe('unchecked');
    expect(result.freezeAuthority).toBe('unchecked');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- test/enrichment/enrich.test.ts
```

Expected: FAIL — `enrichToken` not found.

- [ ] **Step 3: Implement enrichment orchestrator**

Create `src/enrichment/enrich.ts`:
```typescript
import { fetchDexScreenerData } from './dexscreener.js';
import { checkAuthorities } from './authority-check.js';
import type { EnrichmentResult } from '../types.js';

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
    ),
  ]);
}

export async function enrichToken(
  tokenMint: string,
  rpc: unknown,
  timeoutMs = 2000,
): Promise<EnrichmentResult> {
  const [dexResult, authResult] = await Promise.allSettled([
    withTimeout(fetchDexScreenerData(tokenMint), timeoutMs),
    withTimeout(checkAuthorities(rpc, tokenMint), timeoutMs),
  ]);

  return {
    liquidity: dexResult.status === 'fulfilled' ? dexResult.value.liquidity : null,
    fdv: dexResult.status === 'fulfilled' ? dexResult.value.fdv : null,
    marketCap: dexResult.status === 'fulfilled' ? dexResult.value.marketCap : null,
    mintAuthority: authResult.status === 'fulfilled' ? authResult.value.mintAuthority : 'unchecked',
    freezeAuthority: authResult.status === 'fulfilled' ? authResult.value.freezeAuthority : 'unchecked',
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- test/enrichment/enrich.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/enrichment/enrich.ts test/enrichment/enrich.test.ts
git commit -m "feat: add parallel enrichment orchestrator with timeout + degradation"
```

---

### Task 8: AI Attribution

**Files:**
- Create: `src/ai/attribution.ts`
- Test: `test/ai/attribution.test.ts`

- [ ] **Step 1: Write attribution tests**

Create `test/ai/attribution.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

import Anthropic from '@anthropic-ai/sdk';
import { generateAttribution, type AttributionInput } from '../../src/ai/attribution.js';

const input: AttributionInput = {
  tokenSymbol: 'BONK',
  tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  liquidity: 1_200_000,
  fdv: 10_000_000,
  walletLabel: 'Wintermute',
  walletCategory: 'DEX Whale',
  dexSource: 'JUPITER',
};

describe('generateAttribution', () => {
  it('returns AI summary on success', async () => {
    const mockClient = new Anthropic();
    vi.mocked(mockClient.messages.create).mockResolvedValueOnce({
      content: [{ type: 'text', text: '新 meme 叙事，社区热度暴增，链上资金密集流入' }],
    } as any);

    const result = await generateAttribution(input, mockClient);

    expect(result).toBe('新 meme 叙事，社区热度暴增，链上资金密集流入');
    expect(mockClient.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.stringContaining('haiku'),
        max_tokens: 100,
      }),
    );
  });

  it('returns empty string on API error', async () => {
    const mockClient = new Anthropic();
    vi.mocked(mockClient.messages.create).mockRejectedValueOnce(new Error('rate limit'));

    const result = await generateAttribution(input, mockClient);

    expect(result).toBe('');
  });

  it('returns empty string on timeout', async () => {
    const mockClient = new Anthropic();
    vi.mocked(mockClient.messages.create).mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 100)),
    );

    const result = await generateAttribution(input, mockClient);

    expect(result).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- test/ai/attribution.test.ts
```

Expected: FAIL — `generateAttribution` not found.

- [ ] **Step 3: Implement attribution**

Create `src/ai/attribution.ts`:
```typescript
import type Anthropic from '@anthropic-ai/sdk';
import { withTimeout } from '../enrichment/enrich.js';

export interface AttributionInput {
  tokenSymbol?: string;
  tokenMint: string;
  liquidity: number | null;
  fdv: number | null;
  walletLabel: string;
  walletCategory: string;
  dexSource: string;
}

function formatValue(val: number | null): string {
  if (val === null) return 'N/A';
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

function buildPrompt(input: AttributionInput): string {
  return `用 <50 字中文总结这个 Solana 代币为什么被聪明钱买入，只说基本面和叙事，禁止废话。

代币: ${input.tokenSymbol ?? 'Unknown'} (${input.tokenMint})
流动性: ${formatValue(input.liquidity)}
FDV: ${formatValue(input.fdv)}
买家: ${input.walletLabel} (${input.walletCategory})
DEX来源: ${input.dexSource}`;
}

export async function generateAttribution(
  input: AttributionInput,
  client: Anthropic,
  timeoutMs = 1000,
): Promise<string> {
  try {
    const responsePromise = client.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 100,
      temperature: 0.3,
      messages: [{ role: 'user', content: buildPrompt(input) }],
    });

    const response = await withTimeout(responsePromise, timeoutMs);

    const textBlock = response.content.find((c) => c.type === 'text');
    return textBlock?.text ?? '';
  } catch {
    return '';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- test/ai/attribution.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ai/attribution.ts test/ai/attribution.test.ts
git commit -m "feat: add Claude haiku AI attribution with timeout fallback"
```

---

### Task 9: Telegram Formatter

**Files:**
- Create: `src/telegram/format.ts`
- Test: `test/telegram/format.test.ts`

- [ ] **Step 1: Write formatter tests**

Create `test/telegram/format.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { formatAlert, escapeHtml, formatUsd, formatAuthority, truncateMint } from '../../src/telegram/format.js';
import type { AlertData } from '../../src/types.js';

describe('escapeHtml', () => {
  it('escapes <, >, &, "', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('passes through normal text', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });
});

describe('formatUsd', () => {
  it('formats billions', () => {
    expect(formatUsd(1_500_000_000)).toBe('$1.5B');
  });

  it('formats millions', () => {
    expect(formatUsd(1_240_000)).toBe('$1.24M');
  });

  it('formats thousands', () => {
    expect(formatUsd(52_300)).toBe('$52.3K');
  });

  it('formats small values', () => {
    expect(formatUsd(999)).toBe('$999');
  });

  it('returns N/A for null', () => {
    expect(formatUsd(null)).toBe('N/A');
  });
});

describe('formatAuthority', () => {
  it('shows revoked for null', () => {
    expect(formatAuthority(null)).toBe('✅ Revoked');
  });

  it('shows active for an address', () => {
    expect(formatAuthority('SomeAddress123')).toBe('⚠️ Active');
  });

  it('shows unchecked for unchecked string', () => {
    expect(formatAuthority('unchecked')).toBe('❓ Unchecked');
  });
});

describe('truncateMint', () => {
  it('truncates long addresses', () => {
    expect(truncateMint('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')).toBe('DezX...B263');
  });

  it('returns short strings as-is', () => {
    expect(truncateMint('SHORT')).toBe('SHORT');
  });
});

describe('formatAlert', () => {
  const fullAlert: AlertData = {
    wallet: { label: 'Wintermute', category: 'DEX Whale' },
    swap: {
      signature: 'sig123',
      buyerAddress: '7xKXt...',
      tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      tokenSymbol: 'BONK',
      dexSource: 'JUPITER',
      timestamp: 1711900800,
    },
    enrichment: {
      liquidity: 1_240_000,
      fdv: 6_800_000,
      marketCap: 3_200_000,
      mintAuthority: null,
      freezeAuthority: null,
    },
    aiSummary: '新 meme 叙事，社区热度暴增',
  };

  it('renders full alert with all fields', () => {
    const html = formatAlert(fullAlert);

    expect(html).toContain('<b>Wintermute</b>');
    expect(html).toContain('(DEX Whale)');
    expect(html).toContain('<code>BONK</code>');
    expect(html).toContain('$1.24M');
    expect(html).toContain('$6.8M');
    expect(html).toContain('$3.2M');
    expect(html).toContain('✅ Revoked');
    expect(html).toContain('<i>新 meme 叙事，社区热度暴增</i>');
    expect(html).toContain('href="https://birdeye.so/token/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263?chain=solana"');
    expect(html).toContain('href="https://dexscreener.com/solana/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"');
  });

  it('omits AI line when aiSummary is empty', () => {
    const noAi = { ...fullAlert, aiSummary: '' };
    const html = formatAlert(noAi);

    expect(html).not.toContain('🤖');
    expect(html).not.toContain('<i>');
  });

  it('uses truncated mint when tokenSymbol is missing', () => {
    const noSymbol = {
      ...fullAlert,
      swap: { ...fullAlert.swap, tokenSymbol: undefined },
    };
    const html = formatAlert(noSymbol);

    expect(html).toContain('<code>DezX...B263</code>');
  });

  it('escapes HTML in dynamic values', () => {
    const xssAlert = {
      ...fullAlert,
      wallet: { label: '<b>Evil</b>', category: 'Hacker' },
      aiSummary: '<script>alert(1)</script>',
    };
    const html = formatAlert(xssAlert);

    expect(html).toContain('&lt;b&gt;Evil&lt;/b&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('shows N/A for null enrichment values', () => {
    const degraded = {
      ...fullAlert,
      enrichment: {
        liquidity: null,
        fdv: null,
        marketCap: null,
        mintAuthority: 'unchecked' as const,
        freezeAuthority: 'unchecked' as const,
      },
    };
    const html = formatAlert(degraded);

    expect(html).toContain('Liq: <b>N/A</b>');
    expect(html).toContain('FDV: <b>N/A</b>');
    expect(html).toContain('❓ Unchecked');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- test/telegram/format.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement formatter**

Create `src/telegram/format.ts`:
```typescript
import type { AlertData } from '../types.js';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatUsd(value: number | null): string {
  if (value === null) return 'N/A';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

export function formatAuthority(value: string | null | 'unchecked'): string {
  if (value === null) return '✅ Revoked';
  if (value === 'unchecked') return '❓ Unchecked';
  return '⚠️ Active';
}

export function truncateMint(mint: string): string {
  if (mint.length <= 8) return mint;
  return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

export function formatAlert(data: AlertData): string {
  const { wallet, swap, enrichment, aiSummary } = data;

  const label = escapeHtml(wallet.label);
  const category = escapeHtml(wallet.category);
  const tokenDisplay = swap.tokenSymbol
    ? escapeHtml(swap.tokenSymbol)
    : truncateMint(swap.tokenMint);

  const liq = formatUsd(enrichment.liquidity);
  const fdv = formatUsd(enrichment.fdv);
  const mc = formatUsd(enrichment.marketCap);
  const mintStatus = formatAuthority(enrichment.mintAuthority);
  const freezeStatus = formatAuthority(enrichment.freezeAuthority);

  const lines: string[] = [
    `🐋 <b>${label}</b> (${category}) bought <code>${tokenDisplay}</code>`,
    '',
    `💰 Liq: <b>${liq}</b> | FDV: <b>${fdv}</b> | MC: <b>${mc}</b>`,
    `🔒 Mint: ${mintStatus} | Freeze: ${freezeStatus}`,
  ];

  if (aiSummary) {
    lines.push('', `🤖 <i>${escapeHtml(aiSummary)}</i>`);
  }

  lines.push(
    '',
    `📌 <a href="https://birdeye.so/token/${swap.tokenMint}?chain=solana">Birdeye</a> | <a href="https://dexscreener.com/solana/${swap.tokenMint}">DexScreener</a>`,
  );

  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- test/telegram/format.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/telegram/format.ts test/telegram/format.test.ts
git commit -m "feat: add HTML Telegram alert formatter with escaping and USD formatting"
```

---

### Task 10: Telegram Bot Client

**Files:**
- Create: `src/telegram/bot.ts`
- Test: `test/telegram/bot.test.ts`

- [ ] **Step 1: Write bot tests**

Create `test/telegram/bot.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendAlert } from '../../src/telegram/bot.js';

describe('sendAlert', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const botToken = '123:ABC';
  const channelId = '-100999';

  it('sends HTML message successfully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await sendAlert('<b>Test</b>', botToken, channelId);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, opts] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('https://api.telegram.org/bot123:ABC/sendMessage');
    const body = JSON.parse(opts!.body as string);
    expect(body.text).toBe('<b>Test</b>');
    expect(body.parse_mode).toBe('HTML');
    expect(body.disable_web_page_preview).toBe(true);
  });

  it('retries once on failure then succeeds', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('error', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await sendAlert('<b>Test</b>', botToken, channelId);

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws after retry failure', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('error', { status: 500 }))
      .mockResolvedValueOnce(new Response('still error', { status: 500 }));

    await expect(sendAlert('<b>Test</b>', botToken, channelId)).rejects.toThrow(
      'Telegram send failed after retry',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- test/telegram/bot.test.ts
```

Expected: FAIL — `sendAlert` not found.

- [ ] **Step 3: Implement bot client**

Create `src/telegram/bot.ts`:
```typescript
export async function sendAlert(
  html: string,
  botToken: string,
  channelId: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = JSON.stringify({
    chat_id: channelId,
    text: html,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
  const headers = { 'Content-Type': 'application/json' };

  const response = await fetch(url, { method: 'POST', headers, body: payload });

  if (!response.ok) {
    const body = await response.text();
    // Retry once after 2 seconds
    await new Promise((r) => setTimeout(r, 2000));
    const retry = await fetch(url, { method: 'POST', headers, body: payload });
    if (!retry.ok) {
      throw new Error(`Telegram send failed after retry: ${retry.status} ${body}`);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- test/telegram/bot.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/telegram/bot.ts test/telegram/bot.test.ts
git commit -m "feat: add Telegram bot client with single retry"
```

---

### Task 11: Pipeline Orchestrator

**Files:**
- Create: `src/pipeline.ts`
- Test: `test/pipeline.test.ts`

- [ ] **Step 1: Write pipeline tests**

Create `test/pipeline.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./src/webhook/dedup.js', () => {
  const TxDedup = vi.fn().mockImplementation(() => ({
    isDuplicate: vi.fn().mockReturnValue(false),
  }));
  return { TxDedup };
});

vi.mock('../src/webhook/parse.js', () => ({
  parseSwap: vi.fn(),
}));

vi.mock('../src/enrichment/enrich.js', () => ({
  enrichToken: vi.fn(),
  withTimeout: vi.fn((p: Promise<any>) => p),
}));

vi.mock('../src/ai/attribution.js', () => ({
  generateAttribution: vi.fn(),
}));

vi.mock('../src/telegram/format.js', () => ({
  formatAlert: vi.fn(),
}));

vi.mock('../src/telegram/bot.js', () => ({
  sendAlert: vi.fn(),
}));

import { createPipeline } from '../src/pipeline.js';
import { parseSwap } from '../src/webhook/parse.js';
import { enrichToken } from '../src/enrichment/enrich.js';
import { generateAttribution } from '../src/ai/attribution.js';
import { formatAlert } from '../src/telegram/format.js';
import { sendAlert } from '../src/telegram/bot.js';
import type { HeliusEnhancedTransaction } from '../src/types.js';
import swapFixture from './fixtures/swap-event.json';

describe('Pipeline', () => {
  let pipeline: ReturnType<typeof createPipeline>;

  beforeEach(() => {
    vi.clearAllMocks();

    pipeline = createPipeline({
      walletMap: new Map([
        ['7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB', { label: 'Wintermute', category: 'DEX Whale' }],
      ]),
      rpc: {} as any,
      anthropicClient: {} as any,
      botToken: '123:ABC',
      channelId: '-100999',
    });
  });

  it('processes a valid swap end-to-end', async () => {
    vi.mocked(parseSwap).mockReturnValueOnce({
      signature: 'sig1',
      buyerAddress: '7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB',
      tokenMint: 'TokenMint123',
      tokenSymbol: 'BONK',
      dexSource: 'JUPITER',
      timestamp: 1711900800,
    });

    vi.mocked(enrichToken).mockResolvedValueOnce({
      liquidity: 1_000_000,
      fdv: 10_000_000,
      marketCap: 5_000_000,
      mintAuthority: null,
      freezeAuthority: null,
    });

    vi.mocked(generateAttribution).mockResolvedValueOnce('AI summary here');
    vi.mocked(formatAlert).mockReturnValueOnce('<b>formatted</b>');
    vi.mocked(sendAlert).mockResolvedValueOnce(undefined);

    await pipeline.processTransaction(swapFixture as HeliusEnhancedTransaction);

    expect(parseSwap).toHaveBeenCalledOnce();
    expect(enrichToken).toHaveBeenCalledWith('TokenMint123', expect.anything());
    expect(generateAttribution).toHaveBeenCalledOnce();
    expect(formatAlert).toHaveBeenCalledOnce();
    expect(sendAlert).toHaveBeenCalledWith('<b>formatted</b>', '123:ABC', '-100999');
  });

  it('skips non-SWAP transactions', async () => {
    vi.mocked(parseSwap).mockReturnValueOnce(null);

    await pipeline.processTransaction(swapFixture as HeliusEnhancedTransaction);

    expect(enrichToken).not.toHaveBeenCalled();
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('skips when wallet not in watchlist', async () => {
    vi.mocked(parseSwap).mockReturnValueOnce({
      signature: 'sig1',
      buyerAddress: 'UnknownWallet1111111111111111111111111111',
      tokenMint: 'TokenMint123',
      dexSource: 'JUPITER',
      timestamp: 1711900800,
    });

    await pipeline.processTransaction(swapFixture as HeliusEnhancedTransaction);

    expect(enrichToken).not.toHaveBeenCalled();
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('continues with empty AI summary on attribution failure', async () => {
    vi.mocked(parseSwap).mockReturnValueOnce({
      signature: 'sig1',
      buyerAddress: '7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB',
      tokenMint: 'TokenMint123',
      dexSource: 'JUPITER',
      timestamp: 1711900800,
    });

    vi.mocked(enrichToken).mockResolvedValueOnce({
      liquidity: null, fdv: null, marketCap: null,
      mintAuthority: 'unchecked', freezeAuthority: 'unchecked',
    });

    vi.mocked(generateAttribution).mockResolvedValueOnce('');
    vi.mocked(formatAlert).mockReturnValueOnce('<b>degraded</b>');
    vi.mocked(sendAlert).mockResolvedValueOnce(undefined);

    await pipeline.processTransaction(swapFixture as HeliusEnhancedTransaction);

    expect(formatAlert).toHaveBeenCalledWith(
      expect.objectContaining({ aiSummary: '' }),
    );
    expect(sendAlert).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- test/pipeline.test.ts
```

Expected: FAIL — `createPipeline` not found.

- [ ] **Step 3: Implement pipeline**

Create `src/pipeline.ts`:
```typescript
import type Anthropic from '@anthropic-ai/sdk';
import type { HeliusEnhancedTransaction, SmartMoneyWallet } from './types.js';
import { TxDedup } from './webhook/dedup.js';
import { parseSwap } from './webhook/parse.js';
import { enrichToken } from './enrichment/enrich.js';
import { generateAttribution } from './ai/attribution.js';
import { formatAlert } from './telegram/format.js';
import { sendAlert } from './telegram/bot.js';

export interface PipelineConfig {
  walletMap: Map<string, SmartMoneyWallet>;
  rpc: unknown;
  anthropicClient: Anthropic;
  botToken: string;
  channelId: string;
}

export function createPipeline(config: PipelineConfig) {
  const dedup = new TxDedup();
  const watchedAddresses = new Set(config.walletMap.keys());

  async function processTransaction(tx: HeliusEnhancedTransaction): Promise<void> {
    // 1. Dedup
    if (dedup.isDuplicate(tx.signature)) return;

    // 2. Parse (includes type filter + watchlist check for buyer)
    const swap = parseSwap(tx, watchedAddresses);
    if (!swap) return;

    // 3. Lookup wallet
    const wallet = config.walletMap.get(swap.buyerAddress);
    if (!wallet) return;

    // 4. Enrich (parallel, 2s budget)
    const enrichment = await enrichToken(swap.tokenMint, config.rpc);

    // 5. AI attribution (1s budget)
    const aiSummary = await generateAttribution(
      {
        tokenSymbol: swap.tokenSymbol,
        tokenMint: swap.tokenMint,
        liquidity: enrichment.liquidity,
        fdv: enrichment.fdv,
        walletLabel: wallet.label,
        walletCategory: wallet.category,
        dexSource: swap.dexSource,
      },
      config.anthropicClient,
    );

    // 6. Format + send
    const html = formatAlert({ wallet, swap, enrichment, aiSummary });
    await sendAlert(html, config.botToken, config.channelId);
  }

  return { processTransaction };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- test/pipeline.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline.ts test/pipeline.test.ts
git commit -m "feat: add pipeline orchestrator wiring dedup, parse, enrich, AI, telegram"
```

---

### Task 12: Webhook Handler Route

**Files:**
- Create: `src/webhook/handler.ts`
- Test: `test/webhook/handler.test.ts`

- [ ] **Step 1: Write handler tests**

Create `test/webhook/handler.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { registerWebhookRoutes } from '../../src/webhook/handler.js';
import type { HeliusEnhancedTransaction } from '../../src/types.js';
import swapFixture from '../fixtures/swap-event.json';

describe('POST /webhook', () => {
  const mockProcessTransaction = vi.fn().mockResolvedValue(undefined);
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    registerWebhookRoutes(app, {
      authToken: 'Bearer test-secret',
      processTransaction: mockProcessTransaction,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 and dispatches processing on valid auth', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      headers: { authorization: 'Bearer test-secret' },
      payload: [swapFixture],
    });

    expect(response.statusCode).toBe(200);
    // Wait for fire-and-forget
    await new Promise((r) => setTimeout(r, 50));
    expect(mockProcessTransaction).toHaveBeenCalledOnce();
  });

  it('returns 401 on invalid auth', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      headers: { authorization: 'Bearer wrong-token' },
      payload: [swapFixture],
    });

    expect(response.statusCode).toBe(401);
    expect(mockProcessTransaction).not.toHaveBeenCalled();
  });

  it('returns 401 on missing auth header', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: [swapFixture],
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 200 on empty array without processing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      headers: { authorization: 'Bearer test-secret' },
      payload: [],
    });

    expect(response.statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockProcessTransaction).not.toHaveBeenCalled();
  });

  it('dispatches multiple transactions from array', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      headers: { authorization: 'Bearer test-secret' },
      payload: [swapFixture, { ...swapFixture, signature: 'different-sig' }],
    });

    expect(response.statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockProcessTransaction).toHaveBeenCalledTimes(2);
  });
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const app = Fastify();
    registerWebhookRoutes(app, {
      authToken: 'Bearer test',
      processTransaction: vi.fn(),
    });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });

    await app.close();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- test/webhook/handler.test.ts
```

Expected: FAIL — `registerWebhookRoutes` not found.

- [ ] **Step 3: Implement handler**

Create `src/webhook/handler.ts`:
```typescript
import type { FastifyInstance } from 'fastify';
import type { HeliusEnhancedTransaction } from '../types.js';

export interface WebhookHandlerConfig {
  authToken: string;
  processTransaction: (tx: HeliusEnhancedTransaction) => Promise<void>;
}

export function registerWebhookRoutes(
  app: FastifyInstance,
  config: WebhookHandlerConfig,
): void {
  app.post('/webhook', async (request, reply) => {
    // 1. Validate auth
    if (request.headers.authorization !== config.authToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // 2. Respond 200 immediately
    reply.status(200).send({ ok: true });

    // 3. Fire-and-forget processing
    const transactions = request.body as HeliusEnhancedTransaction[];
    for (const tx of transactions) {
      config.processTransaction(tx).catch((err) => {
        request.log.error({ err, signature: tx.signature }, 'Pipeline processing failed');
      });
    }
  });

  app.get('/health', async (_request, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- test/webhook/handler.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/webhook/handler.ts test/webhook/handler.test.ts
git commit -m "feat: add Fastify webhook route with auth validation and health check"
```

---

### Task 13: Server Bootstrap

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Implement server bootstrap**

Create `src/index.ts`:
```typescript
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import * as Sentry from '@sentry/node';
import Anthropic from '@anthropic-ai/sdk';
import { createSolanaRpc } from '@solana/kit';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from './env.js';
import { registerWebhookRoutes } from './webhook/handler.js';
import { createPipeline } from './pipeline.js';
import type { SmartMoneyWallet } from './types.js';

const env = loadEnv();

// Sentry
if (env.SENTRY_DSN) {
  Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
}

// Load wallet config
const addressPath = resolve(import.meta.dirname, '../config/smart-money-addresses.json');
const addressData: Record<string, SmartMoneyWallet> = JSON.parse(
  readFileSync(addressPath, 'utf-8'),
);
const walletMap = new Map(Object.entries(addressData));

// Solana RPC
const rpc = createSolanaRpc(env.SOLANA_RPC_URL);

// Anthropic client
const anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// Pipeline
const pipeline = createPipeline({
  walletMap,
  rpc,
  anthropicClient,
  botToken: env.TELEGRAM_BOT_TOKEN,
  channelId: env.TELEGRAM_CHANNEL_ID,
});

// Fastify server
const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

registerWebhookRoutes(app, {
  authToken: env.HELIUS_AUTH_TOKEN,
  processTransaction: pipeline.processTransaction,
});

// Global error handlers
process.on('unhandledRejection', (err) => {
  app.log.error(err, 'Unhandled rejection');
  Sentry.captureException(err);
});

process.on('uncaughtException', (err) => {
  app.log.fatal(err, 'Uncaught exception');
  Sentry.captureException(err);
  process.exit(1);
});

// Start
try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`Smart Money Radar listening on port ${env.PORT}`);
  app.log.info(`Monitoring ${walletMap.size} smart money addresses`);
} catch (err) {
  app.log.fatal(err, 'Failed to start server');
  process.exit(1);
}
```

- [ ] **Step 2: Typecheck the full project**

```bash
pnpm typecheck
```

Expected: No errors. If there are type errors from `@solana/kit` or other packages with complex types, resolve them. The most common issue is `createSolanaRpc` — adjust the import if needed based on the actual package export.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add server bootstrap with Sentry, rate limiting, and wallet config loading"
```

---

### Task 14: Run Full Test Suite

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: All tests pass (approximately 30+ tests across all modules).

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 3: Fix any failures**

If any tests fail or type errors exist, fix them before proceeding. Common issues:
- Import paths may need `.js` extensions for Node16 module resolution
- Mock module paths must match the actual import paths
- `@solana/kit` API may differ slightly — check actual exports

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve any type errors and test failures across full suite"
```

Only commit if there were actual fixes. Skip if everything passed clean.

---

### Task 15: Final Verification & Docs

- [ ] **Step 1: Verify project runs (dry)**

Create a temporary `.env` file for local testing:
```bash
cp .env.example .env
```

Edit `.env` with any valid-looking values (they don't need to be real for a startup test):
```
HELIUS_AUTH_TOKEN=Bearer dev-test-token
ANTHROPIC_API_KEY=sk-ant-fake-key-for-test
TELEGRAM_BOT_TOKEN=000000:FAKE
TELEGRAM_CHANNEL_ID=-100000000000
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
PORT=3000
NODE_ENV=development
```

```bash
timeout 5 pnpm dev || true
```

Expected: Server starts, logs "Smart Money Radar listening on port 3000" and "Monitoring 2 smart money addresses", then times out after 5 seconds. This confirms the bootstrap works.

- [ ] **Step 2: Test webhook endpoint manually**

In a separate terminal (or after starting dev):
```bash
curl -s -X POST http://localhost:3000/webhook \
  -H "Authorization: Bearer dev-test-token" \
  -H "Content-Type: application/json" \
  -d '[]' | jq .
```

Expected: `{"ok": true}`

```bash
curl -s http://localhost:3000/health | jq .
```

Expected: `{"status": "ok"}`

- [ ] **Step 3: Commit final state**

```bash
git add -A
git commit -m "chore: complete MVP webhook pipeline — all modules, tests, and bootstrap"
```

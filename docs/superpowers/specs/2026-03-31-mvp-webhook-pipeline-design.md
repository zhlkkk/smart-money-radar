# Smart Money Radar MVP — Webhook Pipeline Design Spec

**Status**: Approved  
**Date**: 2026-03-31  
**Scope**: Phase 1 MVP only (weeks 1-4)  
**References**: [PRD v1.1](../../solutions/documentation-gaps/smart-money-radar-mvp-prd-v1-1-2026-03-31.md) | [Frontend Philosophy](../../solutions/best-practices/phased-frontend-design-philosophy-2026-03-31.md)

---

## 1. Overview

A Fastify webhook server that receives Helius Enhanced Transaction events for 20 smart money wallets on Solana, enriches them with market data and rug-pull checks, generates an AI summary, and pushes formatted HTML alerts to a private Telegram channel. All within 5 seconds end-to-end.

**Pipeline**: Monitor → Enrich → Attribute → Push

**Explicitly NOT in scope**: Web UI, auto wallet discovery, payment system, backtesting, multi-chain.

---

## 2. Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Helius configuration | Single webhook, all 20 addresses | Simplest Helius setup. One endpoint. |
| Address management | Local `config/smart-money-addresses.json` with labels | Rich alerts without Helius complexity. Easy manual updates. |
| Telegram format | HTML (`parse_mode: "HTML"`) | Clickable links, monospace addresses, bold data. Less escaping risk than MarkdownV2. |
| Concurrency model | Direct in-request, fire-and-forget | 20 wallets, ~10-50 events/day. No queue needed. |
| Deduplication | In-memory TTL Map (60s) keyed by tx signature | Helius retries up to 3x. Simple, no external state. |

---

## 3. Project Structure

```
smart-money-radar/
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── .env                            # gitignored
├── config/
│   └── smart-money-addresses.json  # 20 wallets with labels
├── src/
│   ├── index.ts                    # Fastify server bootstrap + Sentry init
│   ├── env.ts                      # Zod env validation (fail-fast)
│   ├── types.ts                    # Shared TypeScript types
│   ├── pipeline.ts                 # Orchestrates: parse → enrich → AI → push
│   ├── webhook/
│   │   ├── handler.ts              # POST /webhook route
│   │   └── dedup.ts                # TTL Map deduplication
│   ├── enrichment/
│   │   ├── dexscreener.ts          # DexScreener API client
│   │   ├── authority-check.ts      # Solana mint/freeze authority checker
│   │   └── enrich.ts               # Parallel orchestrator
│   ├── ai/
│   │   └── attribution.ts          # Claude haiku attribution
│   └── telegram/
│       ├── bot.ts                  # Telegram Bot API client
│       └── format.ts              # HTML formatter + safe escaping
├── test/
│   ├── webhook/
│   │   ├── handler.test.ts
│   │   └── dedup.test.ts
│   ├── enrichment/
│   │   ├── dexscreener.test.ts
│   │   ├── authority-check.test.ts
│   │   └── enrich.test.ts
│   ├── ai/
│   │   └── attribution.test.ts
│   ├── telegram/
│   │   ├── bot.test.ts
│   │   └── format.test.ts
│   ├── pipeline.test.ts
│   └── fixtures/
│       └── swap-event.json         # Sample Helius enhanced tx payload
└── docs/
```

---

## 4. Data Flow

```
Helius POST /webhook (JSON array of enhanced transactions)
  │
  ├─ 1. Validate Authorization header === env.HELIUS_AUTH_TOKEN
  ├─ 2. Respond 200 OK immediately
  │
  └─ 3. For each transaction in array (fire-and-forget):
       │
       ├─ 4. Dedup: check tx.signature in TTL Map (60s window)
       ├─ 5. Filter: tx.type === "SWAP" only
       ├─ 6. Parse: extract tokenMint, buyerAddress, amount, dex source
       ├─ 7. Lookup buyerAddress in smart-money-addresses.json
       │     → Get label + category (skip if not in watchlist)
       │
       ├─ 8. Parallel enrichment (2s timeout):
       │     ├─ A: DexScreener → liquidity, FDV, marketCap
       │     └─ B: @solana/kit → mintAuthority, freezeAuthority
       │
       ├─ 9. AI attribution: Claude haiku (<50 words, 1s timeout)
       │     └─ Fallback: empty string → raw data template
       │
       └─ 10. Format HTML → Telegram sendMessage → private channel
```

---

## 5. Module Specifications

### 5.1 Environment & Config (`src/env.ts`)

Validate at startup with Zod. Missing or invalid → crash with clear error message.

```typescript
const envSchema = z.object({
  HELIUS_AUTH_TOKEN: z.string().min(1),        // e.g. "Bearer my-secret"
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHANNEL_ID: z.string().min(1),      // e.g. "-100xxxxxxxxxx"
  SOLANA_RPC_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  SENTRY_DSN: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});
```

### 5.2 Smart Money Config (`config/smart-money-addresses.json`)

```json
{
  "7xKXtRQ...abc": { "label": "Wintermute", "category": "DEX Whale" },
  "9vXqYPz...def": { "label": "AlphaTrader42", "category": "Alpha Trader" }
}
```

- Type: `Record<string, { label: string; category: string }>`
- Loaded once at startup into a `Map` for O(1) lookup
- 20 entries for MVP, manually maintained
- Changes require server restart (acceptable for MVP)

### 5.3 Webhook Handler (`src/webhook/handler.ts`)

**Route**: `POST /webhook`

**Logic**:
1. Check `request.headers.authorization === env.HELIUS_AUTH_TOKEN`. If not, return 401.
2. Parse body as `HeliusEnhancedTransaction[]` (Helius sends a JSON array).
3. Return `200 OK` immediately.
4. For each transaction, call `pipeline.process(tx)` as fire-and-forget. Catch and log errors.

**Helius auth model**: Helius echoes back the `authHeader` string configured when creating the webhook. This is a shared secret in the `Authorization` header, NOT HMAC signing. Verification is a string comparison.

**Health check**: `GET /health` → `200 { status: "ok" }`

### 5.4 Deduplication (`src/webhook/dedup.ts`)

```typescript
class TxDedup {
  private seen: Map<string, number> = new Map();
  private readonly ttlMs = 60_000;
  private callsSinceCleanup = 0;

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
      if (now - ts > this.ttlMs) this.seen.delete(sig);
    }
  }
}
```

- Singleton instance shared across requests
- 60-second TTL covers Helius's retry window (3 retries, 1 min apart)
- In-memory only — acceptable for single-process MVP

### 5.5 Transaction Parsing

Extract from Helius enhanced transaction payload:

```typescript
interface ParsedSwap {
  signature: string;
  buyerAddress: string;       // The smart money wallet
  tokenMint: string;          // Token being bought
  tokenSymbol?: string;       // From tokenTransfers if available
  amountRaw?: string;         // Raw token amount
  dexSource: string;          // "JUPITER", "RAYDIUM", etc. (tx.source)
  timestamp: number;          // Unix timestamp
}
```

**Parsing strategy**:
1. Filter: `tx.type === 'SWAP'` only. Skip all other transaction types.
2. Check if `tx.feePayer` is in our watchlist. This identifies the wallet that initiated the swap.
3. From `tx.events.swap.tokenOutputs`: the output tokens are what the smart money received (the token they bought).
4. Extract `mint` from the first tokenOutput that is NOT SOL/USDC/USDT (the interesting token).
5. If `tx.feePayer` is not in watchlist, scan `tx.tokenTransfers` for any `fromUserAccount` or `toUserAccount` that matches our watchlist. This catches cases where the watched wallet uses a different fee payer.

**Edge case — watched wallet as counterparty**: Helius may deliver transactions where our watched address appears as a liquidity provider or counterparty, not the initiator. Filter these out by requiring `tx.feePayer` match OR the watched address appears in `tokenOutputs` (they received the token).

### 5.6 DexScreener Client (`src/enrichment/dexscreener.ts`)

**Endpoint**: `GET https://api.dexscreener.com/tokens/v1/solana/{mintAddress}`

**Response**: JSON array of pair objects.

**Extraction logic**:
1. Filter pairs where `liquidity?.usd` exists
2. Sort by `liquidity.usd` descending
3. Take the first pair (highest liquidity)
4. Return: `{ liquidity: number | null, fdv: number | null, marketCap: number | null }`

**Rate limit**: 300 req/min (no API key needed). For 20 wallets with ~10-50 events/day, this is ample.

**Timeout**: 2000ms via `AbortSignal.timeout(2000)`.

**Fallback**: Any error or timeout → return `{ liquidity: null, fdv: null, marketCap: null }`.

### 5.7 Authority Check (`src/enrichment/authority-check.ts`)

**Packages**: `@solana/kit`, `@solana-program/token`, `@solana-program/token-2022`

**Logic**:
```typescript
import { address, unwrapOption } from '@solana/kit';
import { fetchMint } from '@solana-program/token';
import { fetchMint as fetchMint2022 } from '@solana-program/token-2022';

async function checkAuthorities(rpc, mintAddr: string) {
  try {
    const mint = await fetchMint(rpc, address(mintAddr));
    return {
      mintAuthority: unwrapOption(mint.data.mintAuthority),
      freezeAuthority: unwrapOption(mint.data.freezeAuthority),
    };
  } catch {
    // Might be Token-2022
    const mint = await fetchMint2022(rpc, address(mintAddr));
    return {
      mintAuthority: unwrapOption(mint.data.mintAuthority),
      freezeAuthority: unwrapOption(mint.data.freezeAuthority),
    };
  }
}
```

- `null` = authority revoked (safe)
- Non-null `Address` = authority active (rug risk)
- Timeout: 2000ms (shared with DexScreener via `Promise.allSettled`)
- Fallback: any error → `{ mintAuthority: 'unchecked', freezeAuthority: 'unchecked' }`

### 5.8 Parallel Enrichment Orchestrator (`src/enrichment/enrich.ts`)

```typescript
async function enrichToken(tokenMint: string): Promise<EnrichmentResult> {
  const [dexResult, authResult] = await Promise.allSettled([
    withTimeout(fetchDexScreenerData(tokenMint), 2000),
    withTimeout(checkAuthorities(rpc, tokenMint), 2000),
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

**`withTimeout` utility** (defined in `src/enrichment/enrich.ts`):
```typescript
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}
```

### 5.9 AI Attribution (`src/ai/attribution.ts`)

**Model**: `claude-3-5-haiku` (or latest available haiku)

**Prompt**:
```
用 <50 字中文总结这个 Solana 代币为什么被聪明钱买入，只说基本面和叙事，禁止废话。

代币: {tokenSymbol} ({tokenMint})
流动性: {liquidity}
FDV: {fdv}
买家: {walletLabel} ({walletCategory})
DEX来源: {dexSource}
```

**Parameters**:
- `max_tokens: 100`
- `temperature: 0.3` (consistent, factual output)
- Timeout: 1000ms

**Fallback**: On any error (timeout, API error, rate limit) → return empty string. The Telegram message will omit the AI line and show raw data only.

**SDK**: `@anthropic-ai/sdk`

### 5.10 Telegram Formatter (`src/telegram/format.ts`)

**HTML escaping function**:
```typescript
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

All dynamic values pass through `escapeHtml()` before insertion into the template. This prevents injection from token names, AI output, or wallet labels.

**Message template**:
```html
🐋 <b>{walletLabel}</b> ({walletCategory}) bought <code>{tokenSymbol}</code>

💰 Liq: <b>{liquidity}</b> | FDV: <b>{fdv}</b> | MC: <b>{marketCap}</b>
🔒 Mint: {mintStatus} | Freeze: {freezeStatus}

🤖 <i>{aiSummary}</i>

📌 <a href="https://birdeye.so/token/{mint}?chain=solana">Birdeye</a> | <a href="https://dexscreener.com/solana/{mint}">DexScreener</a>
```

**Display rules**:
- Authority status: `✅ Revoked` (null) or `⚠️ Active` (non-null) or `❓ Unchecked` (error)
- Financial values: Format with `$` prefix and K/M/B suffixes (e.g., `$1.24M`)
- If AI summary is empty: omit the `🤖` line entirely
- Token mint in `<code>` tags: show first 4 + last 4 characters (e.g., `7xKX...tabc`)

### 5.11 Telegram Bot (`src/telegram/bot.ts`)

```typescript
async function sendAlert(html: string): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHANNEL_ID,
      text: html,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    await new Promise(r => setTimeout(r, 2000));
    const retry = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHANNEL_ID,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!retry.ok) {
      throw new Error(`Telegram send failed after retry: ${retry.status} ${body}`);
    }
  }
}
```

- `disable_web_page_preview: true` — prevents Telegram from fetching link previews (faster delivery, cleaner look)
- One retry with 2s delay. After that, log to Sentry and move on.

### 5.12 Pipeline Orchestrator (`src/pipeline.ts`)

```typescript
async function processTransaction(tx: HeliusEnhancedTransaction): Promise<void> {
  // 1. Dedup
  if (dedup.isDuplicate(tx.signature)) return;

  // 2. Filter
  if (tx.type !== 'SWAP') return;

  // 3. Parse
  const swap = parseSwap(tx);
  if (!swap) return; // Could not extract meaningful data

  // 4. Lookup wallet
  const wallet = walletMap.get(swap.buyerAddress);
  if (!wallet) return; // Not our watched wallet

  // 5. Enrich (parallel, 2s budget)
  const enrichment = await enrichToken(swap.tokenMint);

  // 6. AI attribution (1s budget)
  const aiSummary = await generateAttribution({
    tokenSymbol: swap.tokenSymbol,
    tokenMint: swap.tokenMint,
    liquidity: enrichment.liquidity,
    fdv: enrichment.fdv,
    walletLabel: wallet.label,
    walletCategory: wallet.category,
    dexSource: swap.dexSource,
  });

  // 7. Format + send
  const html = formatAlert({
    wallet,
    swap,
    enrichment,
    aiSummary,
  });

  await sendAlert(html);
}
```

Each step has its own timeout and fallback. The pipeline never throws to the caller — all errors are caught and logged.

---

## 6. Error Handling & Degradation Matrix

| Failure Point | Impact | Behavior |
|---------------|--------|----------|
| Invalid auth header | Request rejected | 401, no processing |
| Duplicate tx signature | Request skipped | Silent skip (dedup) |
| Helius payload unparseable | Swap lost | Log error, skip transaction |
| Wallet not in watchlist | Not our concern | Silent skip |
| DexScreener timeout (>2s) | Missing market data | Liquidity/FDV/MC = "N/A" |
| DexScreener error (4xx/5xx) | Missing market data | Same as timeout |
| Solana RPC timeout (>2s) | Missing rug check | Mint/Freeze = "unchecked" |
| Solana RPC error | Missing rug check | Same as timeout |
| Both enrichments fail | Partial alert | Alert sent with all "N/A"/"unchecked" — still valuable |
| Claude timeout (>1s) | No AI summary | Omit AI line, show raw data only |
| Claude API error | No AI summary | Same as timeout |
| Telegram send failure | Alert delayed | Retry once after 2s |
| Telegram retry failure | Alert lost | Log to Sentry. Alert is lost for this tx. |
| Uncaught exception | Process survives | Sentry capture, error logged |

**Zero-crash guarantee**: No external dependency failure crashes the process. `Promise.allSettled` + try/catch at every boundary.

---

## 7. Security

| Concern | Mitigation |
|---------|------------|
| Unauthorized webhook calls | Validate `Authorization` header matches configured secret |
| HTML injection in alerts | `escapeHtml()` on all dynamic values before template insertion |
| Secret management | All secrets in `.env` (gitignored). `.env.example` committed with placeholder values. |
| Private key exposure | No private keys used or stored. Read-only RPC calls only. |
| Rate limiting | Fastify rate-limit plugin on `/webhook` (100 req/min). Prevents abuse if endpoint is discovered. |
| Dependency supply chain | Lock file (`pnpm-lock.yaml`) committed. Minimal dependency count. |

---

## 8. Monitoring

**Sentry** (`@sentry/node`):
- Initialize in `src/index.ts` with `SENTRY_DSN` from env
- Capture all unhandled rejections and uncaught exceptions
- Tag errors with `{ module, txSignature, tokenMint }`

**Structured logging** (Fastify/Pino):
- `info`: Each tx received, enrichment results, alert sent successfully
- `warn`: Enrichment degradation (timeout/error with fallback)
- `error`: Pipeline failure, Telegram send failure

**Phase 2 enhancement**: Critical errors pushed to a separate Telegram ops channel.

---

## 9. Testing Strategy

### Unit Tests

| Module | Test Cases |
|--------|-----------|
| `webhook/handler` | Valid auth → 200 + processing; Invalid auth → 401; Missing auth → 401; Empty array → 200 no processing; Multiple txns dispatched |
| `webhook/dedup` | New signature → not duplicate; Same signature within 60s → duplicate; Same signature after 60s → not duplicate; Cleanup removes expired entries |
| `enrichment/dexscreener` | Valid response → extract liquidity/fdv/mc; Multiple pairs → pick highest liquidity; Missing fdv field → null; Empty response → all null; Timeout → all null |
| `enrichment/authority-check` | Both revoked → null/null; Both active → addresses; SPL Token fallback to Token-2022; RPC error → unchecked |
| `enrichment/enrich` | Both succeed → full data; DexScreener fails → partial; Both fail → all degraded; Timeout respected |
| `ai/attribution` | Valid response → Chinese text <50 words; Timeout → empty string; API error → empty string |
| `telegram/format` | All fields present → correct HTML; N/A fields → "N/A" displayed; No AI summary → line omitted; HTML escaping of special chars; Token name with `<script>` → escaped |
| `telegram/bot` | 200 response → success; 429 → retry once; Retry success; Retry failure → throw |
| `pipeline` | Full happy path (all mocked); All enrichments degraded; Dedup filters duplicate; Non-SWAP filtered; Non-watchlist wallet filtered |

### Integration Test

One end-to-end test: POST a sample Helius payload to the Fastify server with mocked external services (DexScreener, Solana RPC, Claude, Telegram). Assert the Telegram `sendMessage` is called with correctly formatted HTML.

### Fixtures

`test/fixtures/swap-event.json`: A real Helius enhanced transaction payload for a SWAP event, anonymized. Used by multiple test files.

---

## 10. Dependencies

```json
{
  "dependencies": {
    "fastify": "^5",
    "@fastify/rate-limit": "^10",
    "@anthropic-ai/sdk": "^0.39",
    "@solana/kit": "^2",
    "@solana-program/token": "^0.5",
    "@solana-program/token-2022": "^0.4",
    "zod": "^3",
    "@sentry/node": "^9",
    "dotenv": "^16"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3",
    "@types/node": "^22",
    "tsx": "^4"
  }
}
```

---

## 11. Performance Budget

| Stage | Budget | Notes |
|-------|--------|-------|
| Auth validation + 200 response | <5ms | String comparison |
| Dedup check | <1ms | Map lookup |
| Transaction parsing | <5ms | In-memory JSON traversal |
| Wallet lookup | <1ms | Map lookup |
| Enrichment (parallel) | <2000ms | DexScreener + Solana RPC via Promise.allSettled |
| AI attribution | <1000ms | Claude haiku with hard timeout |
| HTML formatting | <1ms | String concatenation |
| Telegram send | <500ms | HTTP POST |
| **Total pipeline** | **<3500ms** | **Well within 5s SLA** |

---

## 12. Deployment (MVP)

- Single process, single server (VPS or cloud VM)
- Run with: `NODE_ENV=production tsx src/index.ts`
- Helius webhook URL pointed at server's public IP/domain + `/webhook`
- No containerization needed for MVP (add in Phase 2 if scaling)
- Process manager: `pm2` or `systemd` for auto-restart

---

## 13. Out of Scope (Ruthless Cut)

Explicitly not in this spec. Do not build:

- Web Dashboard or any frontend UI
- Automatic smart money wallet discovery
- User subscription or payment handling
- Historical backtesting or win rate analytics
- Multi-chain support (Solana only)
- Message queue or job queue
- Database (all state is in-memory or config files)
- User-facing API beyond the webhook endpoint

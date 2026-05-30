# Production Environment Variables Checklist

更新时间：2026-05-30

本文是当前生产配置的权威清单。根目录 `.env.example` 和 `apps/web/.env.example` 是本地开发模板；本文用于 Railway、Vercel、Neon、Clerk、Paddle、Helio、Telegram、Helius、Birdeye 的生产检查。

## Railway Backend

后端入口：`apps/backend/src/index.ts`

### Required: core webhook pipeline

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `HELIUS_AUTH_TOKEN` | yes | Helius incoming webhook auth token. Helius 请求头必须与此值匹配。 | `Bearer production-secret` |
| `TELEGRAM_BOT_TOKEN` | yes | Telegram Bot API token. | `123456:ABC-DEF...` |
| `TELEGRAM_CHANNEL_ID` | yes | Telegram private channel or group id. | `-100123456789` |
| `SOLANA_RPC_URL` | yes | Solana RPC endpoint. | `https://mainnet.helius-rpc.com/?api-key=...` |
| `LLM_API_KEY` | yes | OpenAI-compatible chat completions API key. | `sk-...` |
| `LLM_BASE_URL` | optional | Chat completions base URL. Defaults to Anthropic-compatible value in code. | `https://openrouter.ai/api/v1` |
| `LLM_MODEL` | optional | Model name. Defaults to `claude-haiku-4-5-20251001`. | `claude-haiku-4-5-20251001` |
| `PORT` | platform | Railway usually injects this. Code defaults to `3000`. | `3000` |
| `NODE_ENV` | yes | Must be `production` in production. | `production` |
| `SENTRY_DSN` | optional | Backend error tracking. | `https://xxx@sentry.io/yyy` |

### Optional: wallet discovery

Discovery is enabled only when all three of `HELIUS_API_KEY`, `HELIUS_WEBHOOK_ID`, and `BIRDEYE_API_KEY` are present.

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `HELIUS_API_KEY` | discovery | Helius REST API key for webhook address management. Different from `HELIUS_AUTH_TOKEN`. | `...` |
| `HELIUS_WEBHOOK_ID` | discovery | Existing Helius webhook id to hot-swap addresses. | `webhook-id` |
| `BIRDEYE_API_KEY` | discovery/enrichment/backtest | Birdeye API key for discovery, metadata fallback, and backtest. | `...` |
| `DISCOVERY_INTERVAL_MS` | optional | Discovery interval. Default: 6 hours. | `21600000` |
| `DISCOVERY_WALLET_CAP` | optional | Max discovered wallets. Pinned wallets do not count against this cap. Default: 30. | `30` |

### Optional: database-backed product features

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `DATABASE_POOL_URL` | dashboard/history/billing | Neon pooled PostgreSQL connection string for long-running backend service. | `postgresql://user:pass@ep-xxx-pooler.neon.tech/db?sslmode=require` |
| `BACKEND_API_KEY` | dashboard API | Shared secret expected in `X-API-Key` from web server routes. | `strong-random-secret` |

If `DATABASE_POOL_URL` is absent, the core Telegram alert pipeline can still run, but REST history, wallet list, billing state, Telegram binding, and admin backtest persistence integrations are limited or disabled.

### Optional: Paddle Billing

Paddle checkout and webhook routes are registered only when `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_PRICE_ID`, and `DATABASE_POOL_URL` are all configured.

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `PADDLE_API_KEY` | Paddle | Paddle API key. | `pdl_live_...` |
| `PADDLE_WEBHOOK_SECRET` | Paddle | Paddle webhook signing secret. | `pdl_ntfset_...` |
| `PADDLE_PRICE_ID` | Paddle | Monthly plan price id. | `pri_...` |
| `PADDLE_ENVIRONMENT` | Paddle | `sandbox` or `production`. Default: `sandbox`. | `production` |
| `APP_URL` | Paddle | Public web app URL used by checkout flow. | `https://smart-money-radar.vercel.app` |

Backend endpoints:

- `POST /api/v1/checkout`
- `POST /webhooks/paddle`

### Optional: Helio Pay

Helio webhook is registered only when `HELIO_WEBHOOK_SHARED_TOKEN` and `DATABASE_POOL_URL` are configured.

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `HELIO_WEBHOOK_SHARED_TOKEN` | Helio | Shared bearer token and optional HMAC secret. | `strong-random-secret` |
| `CLERK_SECRET_KEY` | recommended | Enables backend to sync Clerk publicMetadata after Helio subscription events. | `sk_live_...` |

Backend endpoint:

- `POST /webhooks/helio`

### Optional: Telegram bot webhook and channel access

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram binding | Secret token used by Telegram bot webhook. | `strong-random-secret` |
| `TELEGRAM_INVITE_LINK` | Telegram binding | Private invite link returned after successful `/bind`. | `https://t.me/+...` |

Backend endpoint:

- `POST /webhooks/telegram`

The hourly member cleanup task runs when `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`, and `DATABASE_POOL_URL` are available.

### Optional: admin backtest

Admin backtest routes are registered only when `ADMIN_API_KEY`, `BIRDEYE_API_KEY`, and `HELIUS_API_KEY` are configured.

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `ADMIN_API_KEY` | admin | Shared secret expected in `X-Admin-Key`. | `strong-random-admin-secret` |

Backend endpoints:

- `POST /api/v1/admin/backtest`
- `GET /api/v1/admin/backtest/status`
- `GET /api/v1/admin/backtest/report`
- `GET /api/v1/admin/backtest/stream`

## Vercel Web

Web entry: `apps/web/src/app`

### Required: Clerk and routing

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | Clerk browser key. | `pk_live_...` |
| `CLERK_SECRET_KEY` | yes | Clerk server key. | `sk_live_...` |
| `CLERK_WEBHOOK_SECRET` | yes | Svix secret for `/api/webhooks/clerk`. | `whsec_...` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | yes | Sign-in route. | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | yes | Sign-up route. | `/sign-up` |
| `NEXT_PUBLIC_APP_URL` | yes | Public Vercel app URL. | `https://smart-money-radar.vercel.app` |

### Required: backend API access

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `BACKEND_API_URL` | yes | Railway backend public URL. No trailing slash preferred. | `https://smart-money-radar-api.up.railway.app` |
| `BACKEND_API_KEY` | dashboard | Same value as Railway `BACKEND_API_KEY`. | `strong-random-secret` |
| `ADMIN_API_KEY` | admin UI | Same value as Railway `ADMIN_API_KEY`; used only in server route handlers. | `strong-random-admin-secret` |

### Required: database for Clerk webhook

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | Neon PostgreSQL URL for serverless HTTP client. | `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require` |

### Optional: Paddle checkout UI

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | optional | Paddle client-side token for checkout page. | `pdl_client_...` |
| `NEXT_PUBLIC_PADDLE_ENVIRONMENT` | optional | `sandbox` or `production`. | `production` |

### Optional: Helio checkout UI

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_HELIO_PAYLINK_ID` | optional | Helio paylink id used by Helio checkout component. | `...` |

### Optional: Telegram binding UI

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | optional | Bot username displayed by Telegram binding component. | `SmartMoneyRadarBot` |

## Neon PostgreSQL

Recommended setup:

1. Create one Neon project/database.
2. Use pooled connection string for Railway backend: `DATABASE_POOL_URL`.
3. Use serverless-compatible connection string for Vercel web: `DATABASE_URL`.
4. Run migrations from the monorepo root:

```bash
pnpm --filter @radar/db db:migrate
```

Current tables:

- `users`
- `subscriptions`
- `alerts_history`
- `tracked_wallets`
- `telegram_bindings`

Important caveat: `subscriptions` still has legacy `stripe*` field names while current providers are Paddle and Helio.

## Helius

1. Create an Enhanced Transaction webhook.
2. Set webhook target to `https://<railway-domain>/webhook`.
3. Configure auth header/token so it matches backend `HELIUS_AUTH_TOKEN`.
4. Copy webhook id to `HELIUS_WEBHOOK_ID`.
5. Configure `HELIUS_API_KEY` so discovery can hot-swap watched addresses.
6. Configure `SOLANA_RPC_URL`, ideally a Helius RPC URL for the same project.

## Birdeye

Birdeye is used by:

- wallet discovery,
- token metadata fallback,
- backtest seeding and price tracking.

Configure `BIRDEYE_API_KEY` in Railway backend. Admin backtest requires both `BIRDEYE_API_KEY` and `HELIUS_API_KEY`.

## Paddle

1. Create product and recurring price.
2. Configure Railway backend env vars:
   - `PADDLE_API_KEY`
   - `PADDLE_WEBHOOK_SECRET`
   - `PADDLE_PRICE_ID`
   - `PADDLE_ENVIRONMENT`
3. Configure Paddle webhook endpoint:
   - `https://<railway-domain>/webhooks/paddle`
4. Subscribe to subscription lifecycle events used by `apps/backend/src/stripe/webhook.ts`:
   - subscription created/activated
   - subscription updated
   - subscription canceled
   - subscription paused/resumed
   - subscription past due

## Helio Pay

1. Create Helio paylink/subscription flow.
2. Configure Railway backend env vars:
   - `HELIO_WEBHOOK_SHARED_TOKEN`
   - `CLERK_SECRET_KEY` if Clerk metadata sync is desired
3. Configure Helio webhook endpoint:
   - `https://<railway-domain>/webhooks/helio`
4. Ensure payload includes user email so backend can map payment to `users.email`.

## Clerk

1. Create Clerk application.
2. Configure sign-in/sign-up routes:
   - `/sign-in`
   - `/sign-up`
3. Configure Vercel env vars:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `CLERK_WEBHOOK_SECRET`
4. Configure webhook endpoint:
   - `https://<vercel-domain>/api/webhooks/clerk`
5. Enable events:
   - `user.created`
   - `user.deleted`
6. For paid access, set user public metadata:

```json
{
  "subscriptionStatus": "active"
}
```

7. For admin access, set user public metadata:

```json
{
  "role": "admin"
}
```

## Telegram

1. Create bot through BotFather.
2. Add bot as channel admin.
3. Configure `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHANNEL_ID`.
4. If using Telegram binding/join requests:
   - set Telegram webhook to `https://<railway-domain>/webhooks/telegram`;
   - include the secret token matching `TELEGRAM_WEBHOOK_SECRET`;
   - configure `TELEGRAM_INVITE_LINK`.

## Deployment Smoke Test

Backend:

```bash
curl https://<railway-domain>/health
curl -H "X-API-Key: $BACKEND_API_KEY" https://<railway-domain>/api/v1/wallets
```

Web:

```bash
pnpm --filter web build
```

End-to-end:

1. Create or sign in a Clerk user.
2. Confirm user exists in `users`.
3. Activate subscription via Paddle or Helio.
4. Confirm `subscriptions` row exists and Clerk metadata is active.
5. Open `/dashboard`.
6. Trigger a test Helius webhook payload in staging.
7. Confirm Telegram alert, `/api/v1/alerts`, and Dashboard alert list.
8. As admin, trigger `/admin/backtest` and confirm SSE progress/report.


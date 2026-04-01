# Production Environment Variables Checklist

## Railway (Backend - Fastify)

### Required (Phase 1 core)
| Variable | Description | Example |
|----------|-------------|---------|
| `HELIUS_AUTH_TOKEN` | Helius webhook signature verification token | `your-helius-auth-token` |
| `ANTHROPIC_API_KEY` | Claude API key for AI attribution | `sk-ant-...` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token | `123456:ABC-DEF...` |
| `TELEGRAM_CHANNEL_ID` | Telegram private channel ID | `-100123456789` |
| `SOLANA_RPC_URL` | Solana RPC endpoint | `https://api.mainnet-beta.solana.com` |
| `PORT` | Server port (Railway auto-assigns) | `3000` |
| `NODE_ENV` | Must be `production` | `production` |

### Optional (Phase 1 wallet discovery)
| Variable | Description | Example |
|----------|-------------|---------|
| `HELIUS_API_KEY` | Helius REST API key for webhook management | `your-helius-api-key` |
| `HELIUS_WEBHOOK_ID` | Helius webhook ID for hot-swap | `webhook-id` |
| `BIRDEYE_API_KEY` | Birdeye API key for wallet discovery | `your-birdeye-key` |
| `DISCOVERY_INTERVAL_MS` | Discovery cycle interval (default: 6h) | `21600000` |
| `DISCOVERY_WALLET_CAP` | Max discovered wallets (default: 30) | `30` |

### Optional (Phase 2 database + payments)
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_POOL_URL` | Neon PostgreSQL pooled connection URL | `postgresql://user:pass@ep-xxx-pooler.neon.tech/db` |
| `STRIPE_SECRET_KEY` | Stripe secret key (production mode) | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `STRIPE_PRICE_ID` | Stripe price ID for $100/month plan | `price_...` |
| `BACKEND_API_KEY` | Shared secret for Vercel→Railway API calls | `your-api-key` |
| `SENTRY_DSN` | Sentry error tracking DSN | `https://xxx@sentry.io/yyy` |

## Vercel (Frontend - Next.js)

### Required
| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | `pk_live_...` |
| `CLERK_SECRET_KEY` | Clerk secret key | `sk_live_...` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Sign-in route | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Sign-up route | `/sign-up` |
| `DATABASE_URL` | Neon PostgreSQL HTTP endpoint URL | `postgresql://user:pass@ep-xxx.neon.tech/db` |
| `BACKEND_API_URL` | Railway backend public URL | `https://your-app.up.railway.app` |
| `BACKEND_API_KEY` | Same shared secret as Railway | `your-api-key` |
| `NEXT_PUBLIC_APP_URL` | Vercel deployment URL | `https://your-app.vercel.app` |

### Required (Stripe)
| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (Vercel endpoint) | `whsec_...` |
| `STRIPE_PRICE_ID_MONTHLY` | Stripe price ID | `price_...` |

## Neon PostgreSQL

### Setup
1. Create database instance at neon.tech
2. Get two connection strings:
   - **HTTP endpoint** → `DATABASE_URL` (for Vercel)
   - **Pooled endpoint** → `DATABASE_POOL_URL` (for Railway)
3. Run initial migration: `pnpm --filter @radar/db db:migrate`

## Stripe

### Setup
1. Complete Stripe account activation (business info)
2. Create product + price ($100/month)
3. Configure webhook endpoints:
   - Railway: `https://your-app.up.railway.app/webhooks/stripe`
   - Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

## Clerk

### Setup
1. Create Clerk application
2. Configure webhook endpoint: `https://your-app.vercel.app/api/webhooks/clerk`
3. Events: `user.created`, `user.deleted`
4. Configure sign-in/sign-up URLs

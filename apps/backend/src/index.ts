import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import * as Sentry from '@sentry/node';
import { createSolanaRpc } from '@solana/kit';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from './env.js';
import { registerWebhookRoutes } from './webhook/handler.js';
import { registerAlertsRoutes } from './api/alerts.js';
import { registerWalletsRoutes } from './api/wallets.js';
import { registerHealthRoutes } from './api/health.js';
import { registerApiAuthPlugin } from './api/auth.js';
import { createPoolClient } from '@radar/db';
import { syncTrackedWallets } from './persistence/wallets.js';
import { createPipeline } from './pipeline.js';
import { createDiscovery } from './discovery/orchestrator.js';
import { registerCheckoutRoutes } from './stripe/checkout.js';
import { registerStripeWebhookRoutes } from './stripe/webhook.js';
import Stripe from 'stripe';
import { createWalletState } from './types.js';
import type { SmartMoneyWallet, WalletStateRef } from './types.js';

const env = loadEnv();

// Sentry
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.2 : 1.0,
  });
}

// Load pinned wallet config (always monitored regardless of discovery)
const addressPath = resolve(import.meta.dirname, '../config/smart-money-addresses.json');
const addressData: Record<string, SmartMoneyWallet> = JSON.parse(
  readFileSync(addressPath, 'utf-8'),
);
const pinnedWallets = new Map(Object.entries(addressData));

// Solana RPC
const rpc = createSolanaRpc(env.SOLANA_RPC_URL);

// LLM config (OpenAI-compatible API — works with n1n.ai, OpenRouter, etc.)
const llmConfig = {
  apiKey: env.LLM_API_KEY,
  baseURL: env.LLM_BASE_URL ?? 'https://api.anthropic.com/v1',
  model: env.LLM_MODEL ?? 'claude-haiku-4-5-20251001',
};

// Wallet state (mutable via single-reference swap for discovery)
const walletStateRef: WalletStateRef = { current: createWalletState(pinnedWallets) };

// Discovery state path (discovery created after db init below)
const discoveryStatePath = resolve(import.meta.dirname, '../config/discovered-wallets.json');

// Pipeline (uses walletStateRef which may now include discovered wallets)
const pipeline = createPipeline({
  walletStateRef,
  rpc,
  llmConfig,
  botToken: env.TELEGRAM_BOT_TOKEN,
  channelId: env.TELEGRAM_CHANNEL_ID,
});

// Fastify server
const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
  disableRequestLogging: env.NODE_ENV === 'production',
});

await app.register(rateLimit, { max: 500, timeWindow: '1 minute' });

registerWebhookRoutes(app, {
  authToken: env.HELIUS_AUTH_TOKEN,
  processTransaction: pipeline.processTransaction,
});

// Database (optional — Phase 2 features)
const db = env.DATABASE_POOL_URL ? createPoolClient(env.DATABASE_POOL_URL) : null;

// Sync pinned wallets to database on startup
if (db) {
  const pinnedEntries = [...pinnedWallets.entries()].map(([address, w]) => ({
    address,
    label: w.label,
    category: w.category,
    source: 'pinned' as const,
  }));
  await syncTrackedWallets(db, pinnedEntries);
  app.log.info(`Synced ${pinnedEntries.length} pinned wallets to database`);
}

// Discovery (created after db so discovered wallets sync to database)
let discovery: ReturnType<typeof createDiscovery> | null = null;

if (env.HELIUS_API_KEY && env.BIRDEYE_API_KEY && env.HELIUS_WEBHOOK_ID) {
  discovery = createDiscovery({
    walletStateRef,
    pinnedWallets,
    birdeyeApiKey: env.BIRDEYE_API_KEY,
    heliusApiKey: env.HELIUS_API_KEY,
    heliusWebhookId: env.HELIUS_WEBHOOK_ID,
    statePath: discoveryStatePath,
    intervalMs: env.DISCOVERY_INTERVAL_MS,
    walletCap: env.DISCOVERY_WALLET_CAP,
    db,
  });
}

// REST API routes (Phase 2b)
registerHealthRoutes(app, { db });

if (db) {
  if (env.BACKEND_API_KEY) {
    await app.register(registerApiAuthPlugin, { apiKey: env.BACKEND_API_KEY });
  }
  registerAlertsRoutes(app, { db });
  registerWalletsRoutes(app, { db });
}

// Stripe routes (Phase 2 — 订阅支付)
if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PRICE_ID && db) {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  registerCheckoutRoutes(app, {
    stripe,
    priceId: env.STRIPE_PRICE_ID,
    appUrl: process.env.APP_URL ?? 'https://smart-money-radar-web.vercel.app',
  });

  registerStripeWebhookRoutes(app, {
    stripe,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    db,
  });

  app.log.info('Stripe checkout + webhook routes registered');
}

// Sentry: capture all Fastify route errors (not just unhandled process errors)
if (env.SENTRY_DSN) {
  app.addHook('onError', (_request, _reply, error, done) => {
    Sentry.captureException(error);
    done();
  });
}

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
  const totalWallets = walletStateRef.current.walletMap.size;
  app.log.info(`Smart Money Radar listening on port ${env.PORT}`);
  app.log.info(`Monitoring ${totalWallets} wallets (${pinnedWallets.size} pinned${discovery ? `, discovery enabled` : ''})`);

  // Start wallet discovery after server is accepting webhooks
  if (discovery) {
    discovery.start();
  }
} catch (err) {
  app.log.fatal(err, 'Failed to start server');
  process.exit(1);
}

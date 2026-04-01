import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import * as Sentry from '@sentry/node';
import Anthropic from '@anthropic-ai/sdk';
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
import { createPipeline } from './pipeline.js';
import { createDiscovery } from './discovery/orchestrator.js';
import { createWalletState } from './types.js';
import type { SmartMoneyWallet, WalletStateRef } from './types.js';

const env = loadEnv();

// Sentry
if (env.SENTRY_DSN) {
  Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
}

// Load pinned wallet config (always monitored regardless of discovery)
const addressPath = resolve(import.meta.dirname, '../config/smart-money-addresses.json');
const addressData: Record<string, SmartMoneyWallet> = JSON.parse(
  readFileSync(addressPath, 'utf-8'),
);
const pinnedWallets = new Map(Object.entries(addressData));

// Solana RPC
const rpc = createSolanaRpc(env.SOLANA_RPC_URL);

// Anthropic client
const anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// Wallet state (mutable via single-reference swap for discovery)
const walletStateRef: WalletStateRef = { current: createWalletState(pinnedWallets) };

// Discovery: load persisted state and merge with pinned wallets before creating pipeline
const discoveryStatePath = resolve(import.meta.dirname, '../config/discovered-wallets.json');
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
  });
}

// Pipeline (uses walletStateRef which may now include discovered wallets)
const pipeline = createPipeline({
  walletStateRef,
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

await app.register(rateLimit, { max: 500, timeWindow: '1 minute' });

registerWebhookRoutes(app, {
  authToken: env.HELIUS_AUTH_TOKEN,
  processTransaction: pipeline.processTransaction,
});

// Database (optional — Phase 2 features)
const db = env.DATABASE_POOL_URL ? createPoolClient(env.DATABASE_POOL_URL) : null;

// REST API routes (Phase 2b)
registerHealthRoutes(app, { db });

if (db) {
  if (env.BACKEND_API_KEY) {
    await app.register(registerApiAuthPlugin, { apiKey: env.BACKEND_API_KEY });
  }
  registerAlertsRoutes(app, { db });
  registerWalletsRoutes(app, { db });
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

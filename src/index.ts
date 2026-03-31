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

await app.register(rateLimit, { max: 500, timeWindow: '1 minute' });

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

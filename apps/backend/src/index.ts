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
import { registerAlertsStreamRoute } from './api/alerts-stream.js';
import { registerApiAuthPlugin } from './api/auth.js';
import { registerAdminBacktestRoutes } from './api/admin-backtest.js';
import { createPoolClient } from '@radar/db';
import { syncTrackedWallets } from './persistence/wallets.js';
import { createPipeline } from './pipeline.js';
import { createDiscovery } from './discovery/orchestrator.js';
import { registerCheckoutRoutes } from './stripe/checkout.js';
import { registerPaddleWebhookRoutes } from './stripe/webhook.js';
import { registerHelioWebhookRoutes } from './helio/webhook.js';
import { telegramWebhookPlugin } from './telegram/webhook.js';
import { handleBindCommand } from './telegram/bind.js';
import { handleJoinRequest } from './telegram/join-request.js';
import { generateBindCode } from './telegram/bind-codes.js';
import { cleanupExpiredMembers } from './telegram/cleanup.js';
import { telegramBindings } from '@radar/db';
import { eq } from 'drizzle-orm';
import { Paddle, Environment } from '@paddle/paddle-node-sdk';
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

// Database (must init before pipeline so alerts get persisted)
const db = env.DATABASE_POOL_URL ? createPoolClient(env.DATABASE_POOL_URL) : null;

// Pipeline (uses walletStateRef + db for alert persistence)
const pipeline = createPipeline({
  walletStateRef,
  rpc,
  llmConfig,
  botToken: env.TELEGRAM_BOT_TOKEN,
  channelId: env.TELEGRAM_CHANNEL_ID,
  db,
  birdeyeApiKey: env.BIRDEYE_API_KEY,
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

// Admin backtest management (Phase 3 — 管理员回测控制)
if (env.ADMIN_API_KEY && env.BIRDEYE_API_KEY && env.HELIUS_API_KEY) {
  registerAdminBacktestRoutes(app, {
    adminKey: env.ADMIN_API_KEY,
    birdeyeApiKey: env.BIRDEYE_API_KEY,
    heliusApiKey: env.HELIUS_API_KEY,
  });
  app.log.info('Admin backtest routes registered');
}

// Paddle Billing routes (Phase 2 — 订阅支付)
if (env.PADDLE_API_KEY && env.PADDLE_WEBHOOK_SECRET && env.PADDLE_PRICE_ID && db) {
  const paddle = new Paddle(env.PADDLE_API_KEY, {
    environment: env.PADDLE_ENVIRONMENT === 'production' ? Environment.production : Environment.sandbox,
  });

  registerCheckoutRoutes(app, {
    paddle,
    priceId: env.PADDLE_PRICE_ID,
    appUrl: process.env.APP_URL ?? 'https://smart-money-radar-web.vercel.app',
  });

  registerPaddleWebhookRoutes(app, {
    paddle,
    webhookSecret: env.PADDLE_WEBHOOK_SECRET,
    db,
  });

  app.log.info('Paddle Billing checkout + webhook routes registered');
}

// Helio Pay webhook (Phase 2 — 加密支付)
if (env.HELIO_WEBHOOK_SHARED_TOKEN && db) {
  registerHelioWebhookRoutes(app, {
    sharedToken: env.HELIO_WEBHOOK_SHARED_TOKEN,
    db,
    clerkSecretKey: env.CLERK_SECRET_KEY,
  });
  app.log.info('Helio Pay webhook route registered');
}

// Telegram Bot Webhook（Phase 3 — 双向交互：命令 + 加入请求）
if (env.TELEGRAM_WEBHOOK_SECRET && env.TELEGRAM_BOT_TOKEN) {
  const inviteLink = env.TELEGRAM_INVITE_LINK ?? '';
  app.register(telegramWebhookPlugin({
    secretToken: env.TELEGRAM_WEBHOOK_SECRET,
    onMessage: async (update) => {
      if (db) {
        await handleBindCommand(update, db, env.TELEGRAM_BOT_TOKEN, inviteLink);
      }
    },
    onChatJoinRequest: async (update) => {
      if (db) {
        await handleJoinRequest(update, db, env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHANNEL_ID);
      }
    },
  }));
  app.log.info('Telegram Bot webhook route registered');
}

// Telegram 绑定 REST API（Phase 3 — Dashboard 获取验证码 + 查询绑定状态）
if (db) {
  app.get('/api/v1/telegram/bind-code', async (request, reply) => {
    const { clerkUserId } = request.query as { clerkUserId?: string };
    if (!clerkUserId) {
      return reply.code(400).send({ error: 'Missing clerkUserId query parameter' });
    }
    const code = generateBindCode(clerkUserId);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    return reply.send({ code, expiresAt });
  });

  app.get('/api/v1/telegram/status', async (request, reply) => {
    const { clerkUserId } = request.query as { clerkUserId?: string };
    if (!clerkUserId) {
      return reply.code(400).send({ error: 'Missing clerkUserId query parameter' });
    }
    const rows = await db
      .select()
      .from(telegramBindings)
      .where(eq(telegramBindings.clerkUserId, clerkUserId));

    if (rows.length === 0) {
      return reply.send({ status: 'not_bound' });
    }
    const binding = rows[0]!;
    // TODO: Unit 4 加入请求审批后可区分 bound_not_subscribed vs bound_and_subscribed
    return reply.send({
      status: 'bound_not_subscribed',
      telegramUsername: binding.telegramUsername ?? undefined,
    });
  });
}

// SSE 实时告警推送（无需鉴权，只读事件流）
registerAlertsStreamRoute(app);

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

  // 每小时清理过期订阅的频道成员
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHANNEL_ID && db) {
    setInterval(async () => {
      try {
        const result = await cleanupExpiredMembers(db, env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHANNEL_ID, app.log);
        if (result.removed > 0 || result.errors > 0) {
          app.log.info(result, 'Telegram cleanup completed');
        }
      } catch (err) {
        app.log.error({ err }, 'Telegram cleanup failed');
      }
    }, 60 * 60 * 1000); // 1 小时
  }
} catch (err) {
  app.log.fatal(err, 'Failed to start server');
  process.exit(1);
}

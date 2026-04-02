// Helio Pay Webhook — 加密支付订阅管理
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { subscriptions, users } from '@radar/db';
import type { PoolDatabase } from '@radar/db';
import { eq } from 'drizzle-orm';
import { createClerkClient } from '@clerk/backend';

export interface HelioWebhookConfig {
  sharedToken: string;
  db: PoolDatabase;
  clerkSecretKey?: string;
}

function verifySignature(rawBody: Buffer, secret: string, signature: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const sigBuf = Buffer.from(signature, 'utf8');
  if (expectedBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, sigBuf);
}

export function registerHelioWebhookRoutes(
  app: FastifyInstance,
  config: HelioWebhookConfig,
) {
  app.register(async function helioWebhookPlugin(instance) {
    instance.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_req, body, done) => {
        done(null, body);
      },
    );

    instance.post(
      '/webhooks/helio',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const rawBody = request.body as Buffer;
        const signature = request.headers['x-signature'] as string | undefined;
        const authHeader = request.headers['authorization'] as string | undefined;

        // 双重验证：Bearer token + HMAC 签名
        if (authHeader !== `Bearer ${config.sharedToken}`) {
          request.log.error('Helio webhook: invalid bearer token');
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        if (signature && !verifySignature(rawBody, config.sharedToken, signature)) {
          request.log.error('Helio webhook: invalid HMAC signature');
          return reply.status(401).send({ error: 'Invalid signature' });
        }

        const payload = JSON.parse(rawBody.toString()) as HelioWebhookPayload;

        try {
          await handleEvent(payload, config.db, request.log, config.clerkSecretKey);
        } catch (err) {
          request.log.error({ err, event: payload.event }, 'Helio webhook handler failed');
          return reply.status(500).send({ error: 'Handler failed' });
        }

        return reply.status(200).send({ received: true });
      },
    );
  });
}

// ─── 类型定义 ───

interface HelioWebhookPayload {
  event: 'CREATED' | 'SUBSCRIPTION_STARTED' | 'SUBSCRIPTION_PENDING_PAYMENT' | 'SUBSCRIPTION_ENDED';
  subscriptionId?: string;
  subscriptionState?: string;
  email?: string;
  nextChargeUrl?: string;
  transactionObject?: {
    id: string;
    paylinkId: string;
    meta?: {
      amount?: string;
      senderPK?: string;
      recipientPK?: string;
      transactionSignature?: string;
      customerDetails?: {
        email?: string;
      };
    };
  };
}

type LogFn = { error: (obj: unknown, msg: string) => void; info: (obj: unknown, msg: string) => void };

/** 异步更新 Clerk publicMetadata — fire-and-forget，失败仅日志 */
async function syncClerkMetadata(
  clerkId: string,
  subscriptionStatus: string,
  clerkSecretKey: string | undefined,
  log: LogFn,
): Promise<void> {
  if (!clerkSecretKey) return;
  try {
    const clerk = createClerkClient({ secretKey: clerkSecretKey });
    await clerk.users.updateUserMetadata(clerkId, {
      publicMetadata: { subscriptionStatus },
    });
    log.info({ clerkId, subscriptionStatus }, 'Clerk publicMetadata synced');
  } catch (err) {
    log.error({ err, clerkId }, 'Failed to sync Clerk publicMetadata (non-blocking)');
  }
}

// ─── 事件处理 ───

async function handleEvent(
  payload: HelioWebhookPayload,
  db: PoolDatabase,
  log: LogFn,
  clerkSecretKey?: string,
) {
  switch (payload.event) {
    case 'CREATED':
    case 'SUBSCRIPTION_STARTED': {
      const email = payload.transactionObject?.meta?.customerDetails?.email ?? payload.email;
      if (!email) {
        log.error({ event: payload.event }, 'Helio webhook: no email in payload');
        return;
      }

      // 通过 email 查找用户（Helio 不像 Paddle 有 customData 回传 clerkUserId）
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user) {
        log.error({ email }, 'Helio webhook: user not found by email, will retry');
        throw new Error(`User not found for email: ${email}`);
      }

      const subId = payload.subscriptionId ?? payload.transactionObject?.id ?? 'helio-onetime';

      await db.insert(subscriptions)
        .values({
          userId: user.id,
          stripeSubscriptionId: `helio_${subId}`,
          stripePriceId: 'helio_pro_monthly',
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
          cancelAtPeriodEnd: false,
        })
        .onConflictDoNothing({ target: subscriptions.stripeSubscriptionId });

      log.info({ userId: user.id, subId, email }, 'Helio subscription activated');

      // 同步 Clerk publicMetadata（fire-and-forget）
      syncClerkMetadata(user.clerkId, 'active', clerkSecretKey, log).catch(() => {});
      break;
    }

    case 'SUBSCRIPTION_PENDING_PAYMENT': {
      // 用户需要续费 — 记录状态但不立即取消
      const subId = payload.subscriptionId;
      if (subId) {
        await db.update(subscriptions)
          .set({ status: 'past_due' })
          .where(eq(subscriptions.stripeSubscriptionId, `helio_${subId}`));
        log.info({ subId }, 'Helio subscription pending payment');
      }
      break;
    }

    case 'SUBSCRIPTION_ENDED': {
      const subId = payload.subscriptionId;
      if (subId) {
        // 查找订阅记录以获取 userId → clerkId
        const sub = await db.query.subscriptions.findFirst({
          where: eq(subscriptions.stripeSubscriptionId, `helio_${subId}`),
        });
        await db.update(subscriptions)
          .set({ status: 'canceled' })
          .where(eq(subscriptions.stripeSubscriptionId, `helio_${subId}`));
        log.info({ subId }, 'Helio subscription ended');

        // 同步 Clerk publicMetadata
        if (sub) {
          const user = await db.query.users.findFirst({
            where: eq(users.id, sub.userId),
          });
          if (user) {
            syncClerkMetadata(user.clerkId, 'canceled', clerkSecretKey, log).catch(() => {});
          }
        }
      }
      break;
    }
  }
}

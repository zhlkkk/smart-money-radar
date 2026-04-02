// LemonSqueezy Webhook — 订阅生命周期管理
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { subscriptions, users } from '@radar/db';
import type { PoolDatabase } from '@radar/db';
import { eq } from 'drizzle-orm';

export interface LemonWebhookConfig {
  webhookSecret: string;
  db: PoolDatabase;
}

// ─── 类型定义 ───

type SubscriptionStatus = 'active' | 'on_trial' | 'paused' | 'cancelled' | 'expired';

interface SubscriptionAttributes {
  store_id: number;
  customer_id: number;
  order_id: number;
  variant_id: number;
  product_name: string;
  variant_name: string;
  user_email: string;
  status: SubscriptionStatus;
  cancelled: boolean;
  renews_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

interface WebhookPayload {
  meta: {
    event_name: string;
    test_mode: boolean;
    custom_data?: Record<string, string>;
  };
  data: {
    type: string;
    id: string;
    attributes: SubscriptionAttributes;
  };
}

// ─── 签名验证 ───

function verifySignature(rawBody: Buffer, secret: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
  const sigBuf = Buffer.from(signature, 'utf8');
  if (digest.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(digest, sigBuf);
}

// ─── 路由注册 ───

export function registerLemonWebhookRoutes(
  app: FastifyInstance,
  config: LemonWebhookConfig,
) {
  // 用 Fastify 插件封装，避免 raw body parser 污染全局
  app.register(async function lemonWebhookPlugin(instance) {
    instance.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_req, body, done) => {
        done(null, body);
      },
    );

    instance.post(
      '/webhooks/lemonsqueezy',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const signature = request.headers['x-signature'] as string | undefined;
        if (!signature) {
          return reply.status(400).send({ error: 'Missing X-Signature header' });
        }

        const rawBody = request.body as Buffer;
        if (!verifySignature(rawBody, config.webhookSecret, signature)) {
          request.log.error('LemonSqueezy webhook signature verification failed');
          return reply.status(400).send({ error: 'Invalid signature' });
        }

        const payload = JSON.parse(rawBody.toString()) as WebhookPayload;
        const eventName = payload.meta.event_name;

        try {
          await handleEvent(eventName, payload, config.db, request.log);
        } catch (err) {
          request.log.error({ err, eventName }, 'LemonSqueezy webhook handler failed');
          return reply.status(500).send({ error: 'Handler failed' });
        }

        return reply.status(200).send({ received: true });
      },
    );
  });
}

// ─── 事件处理 ───

async function handleEvent(
  eventName: string,
  payload: WebhookPayload,
  db: PoolDatabase,
  log: { error: (obj: unknown, msg: string) => void; info: (obj: unknown, msg: string) => void },
) {
  const attrs = payload.data.attributes;
  const lsSubscriptionId = payload.data.id;
  const clerkUserId = payload.meta.custom_data?.['clerk_user_id'];

  switch (eventName) {
    case 'subscription_created': {
      if (!clerkUserId) {
        log.error({ lsSubscriptionId }, 'subscription_created: missing clerk_user_id in custom_data');
        return;
      }

      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkUserId),
      });

      if (!user) {
        log.error({ clerkUserId, lsSubscriptionId }, 'subscription_created: user not found, will retry');
        throw new Error(`User not found for clerkUserId: ${clerkUserId}`);
      }

      // 更新用户的 LemonSqueezy customer ID
      await db
        .update(users)
        .set({ stripeCustomerId: String(attrs.customer_id) })
        .where(eq(users.id, user.id));

      await db
        .insert(subscriptions)
        .values({
          userId: user.id,
          stripeSubscriptionId: lsSubscriptionId,
          stripePriceId: String(attrs.variant_id),
          status: mapStatus(attrs.status),
          currentPeriodStart: new Date(attrs.created_at),
          currentPeriodEnd: new Date(attrs.renews_at),
          cancelAtPeriodEnd: attrs.cancelled,
        })
        .onConflictDoNothing({ target: subscriptions.stripeSubscriptionId });

      log.info({ userId: user.id, lsSubscriptionId }, 'Subscription created');
      break;
    }

    case 'subscription_updated':
    case 'subscription_resumed':
    case 'subscription_unpaused': {
      await db
        .update(subscriptions)
        .set({
          status: mapStatus(attrs.status),
          cancelAtPeriodEnd: attrs.cancelled,
          currentPeriodEnd: new Date(attrs.renews_at),
        })
        .where(eq(subscriptions.stripeSubscriptionId, lsSubscriptionId));
      break;
    }

    case 'subscription_cancelled': {
      await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          cancelAtPeriodEnd: true,
          currentPeriodEnd: attrs.ends_at ? new Date(attrs.ends_at) : undefined,
        })
        .where(eq(subscriptions.stripeSubscriptionId, lsSubscriptionId));
      break;
    }

    case 'subscription_expired': {
      await db
        .update(subscriptions)
        .set({ status: 'canceled' })
        .where(eq(subscriptions.stripeSubscriptionId, lsSubscriptionId));
      break;
    }

    case 'subscription_paused': {
      await db
        .update(subscriptions)
        .set({ status: 'paused' as 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing' | 'paused' })
        .where(eq(subscriptions.stripeSubscriptionId, lsSubscriptionId));
      break;
    }

    case 'subscription_payment_failed': {
      await db
        .update(subscriptions)
        .set({ status: 'past_due' })
        .where(eq(subscriptions.stripeSubscriptionId, lsSubscriptionId));
      break;
    }

    case 'subscription_payment_success': {
      await db
        .update(subscriptions)
        .set({
          status: 'active',
          currentPeriodEnd: new Date(attrs.renews_at),
        })
        .where(eq(subscriptions.stripeSubscriptionId, lsSubscriptionId));
      break;
    }

    default:
      // 忽略其他事件
      break;
  }
}

// LemonSqueezy status → DB status 映射
function mapStatus(lsStatus: SubscriptionStatus): 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing' | 'paused' {
  switch (lsStatus) {
    case 'active': return 'active';
    case 'on_trial': return 'trialing';
    case 'paused': return 'paused';
    case 'cancelled': return 'canceled';
    case 'expired': return 'canceled';
    default: return 'incomplete';
  }
}

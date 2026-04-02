// Paddle Billing Webhook — 订阅生命周期管理
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Paddle, EventName } from '@paddle/paddle-node-sdk';
import { subscriptions, users } from '@radar/db';
import type { PoolDatabase } from '@radar/db';
import { eq } from 'drizzle-orm';

export interface PaddleWebhookConfig {
  paddle: Paddle;
  webhookSecret: string;
  db: PoolDatabase;
}

export function registerPaddleWebhookRoutes(
  app: FastifyInstance,
  config: PaddleWebhookConfig,
) {
  // 用 Fastify 插件封装，避免 raw body parser 污染全局
  app.register(async function paddleWebhookPlugin(instance) {
    instance.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_req, body, done) => {
        done(null, body);
      },
    );

    instance.post(
      '/webhooks/paddle',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const signature = request.headers['paddle-signature'] as string | undefined;
        if (!signature) {
          return reply.status(400).send({ error: 'Missing Paddle-Signature header' });
        }

        const rawBody = (request.body as Buffer).toString('utf8');

        let event;
        try {
          event = config.paddle.webhooks.unmarshal(
            rawBody,
            config.webhookSecret,
            signature,
          );
        } catch (err) {
          request.log.error({ err }, 'Paddle webhook signature verification failed');
          return reply.status(401).send({ error: 'Invalid signature' });
        }

        try {
          await handleEvent(event, config.db, request.log);
        } catch (err) {
          request.log.error({ err, eventType: event.eventType }, 'Paddle webhook handler failed');
          return reply.status(500).send({ error: 'Handler failed' });
        }

        return reply.status(200).send({ received: true });
      },
    );
  });
}

// ─── 事件处理 ───

type LogFn = { error: (obj: unknown, msg: string) => void; info: (obj: unknown, msg: string) => void };

async function handleEvent(
  event: { eventType: string; eventId: string; data: Record<string, unknown> },
  db: PoolDatabase,
  log: LogFn,
) {
  const data = event.data as Record<string, unknown>;

  switch (event.eventType) {
    case EventName.SubscriptionCreated:
    case EventName.SubscriptionActivated: {
      const customData = data.customData as Record<string, string> | undefined;
      const clerkUserId = customData?.clerkUserId;
      if (!clerkUserId) {
        log.error({ eventId: event.eventId }, 'subscription event: missing clerkUserId in customData');
        return;
      }

      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkUserId),
      });

      if (!user) {
        log.error({ clerkUserId }, 'subscription event: user not found, will retry');
        throw new Error(`User not found for clerkUserId: ${clerkUserId}`);
      }

      const subId = data.id as string;
      const customerId = data.customerId as string | undefined;
      const status = data.status as string;
      const currentPeriod = data.currentBillingPeriod as { startsAt: string; endsAt: string } | undefined;
      const items = data.items as Array<{ price: { id: string } }> | undefined;

      // 更新 customer ID
      if (customerId && !user.stripeCustomerId) {
        await db.update(users)
          .set({ stripeCustomerId: customerId })
          .where(eq(users.id, user.id));
      }

      await db.insert(subscriptions)
        .values({
          userId: user.id,
          stripeSubscriptionId: subId,
          stripePriceId: items?.[0]?.price.id ?? 'unknown',
          status: mapStatus(status),
          currentPeriodStart: currentPeriod ? new Date(currentPeriod.startsAt) : new Date(),
          currentPeriodEnd: currentPeriod ? new Date(currentPeriod.endsAt) : new Date(Date.now() + 30 * 24 * 3600 * 1000),
          cancelAtPeriodEnd: false,
        })
        .onConflictDoNothing({ target: subscriptions.stripeSubscriptionId });

      log.info({ userId: user.id, subId }, 'Subscription created/activated');
      break;
    }

    case EventName.SubscriptionUpdated: {
      const subId = data.id as string;
      const status = data.status as string;
      const scheduledChange = data.scheduledChange as { action: string; effectiveAt: string } | null;
      const currentPeriod = data.currentBillingPeriod as { endsAt: string } | undefined;

      await db.update(subscriptions)
        .set({
          status: mapStatus(status),
          cancelAtPeriodEnd: scheduledChange?.action === 'cancel',
          currentPeriodEnd: currentPeriod ? new Date(currentPeriod.endsAt) : undefined,
        })
        .where(eq(subscriptions.stripeSubscriptionId, subId));
      break;
    }

    case EventName.SubscriptionCanceled: {
      const subId = data.id as string;
      const scheduledChange = data.scheduledChange as { effectiveAt: string } | null;

      await db.update(subscriptions)
        .set({
          status: 'canceled',
          cancelAtPeriodEnd: true,
          currentPeriodEnd: scheduledChange ? new Date(scheduledChange.effectiveAt) : undefined,
        })
        .where(eq(subscriptions.stripeSubscriptionId, subId));
      break;
    }

    case EventName.SubscriptionPaused: {
      const subId = data.id as string;
      await db.update(subscriptions)
        .set({ status: 'paused' as 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing' | 'paused' })
        .where(eq(subscriptions.stripeSubscriptionId, subId));
      break;
    }

    case EventName.SubscriptionResumed: {
      const subId = data.id as string;
      const currentPeriod = data.currentBillingPeriod as { endsAt: string } | undefined;
      await db.update(subscriptions)
        .set({
          status: 'active',
          cancelAtPeriodEnd: false,
          currentPeriodEnd: currentPeriod ? new Date(currentPeriod.endsAt) : undefined,
        })
        .where(eq(subscriptions.stripeSubscriptionId, subId));
      break;
    }

    case EventName.SubscriptionPastDue: {
      const subId = data.id as string;
      await db.update(subscriptions)
        .set({ status: 'past_due' })
        .where(eq(subscriptions.stripeSubscriptionId, subId));
      break;
    }

    default:
      break;
  }
}

function mapStatus(paddleStatus: string): 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing' | 'paused' {
  switch (paddleStatus) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'paused': return 'paused';
    case 'canceled': return 'canceled';
    case 'past_due': return 'past_due';
    default: return 'incomplete';
  }
}

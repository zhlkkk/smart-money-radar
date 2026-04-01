import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { subscriptions, users } from '@radar/db';
import type { PoolDatabase } from '@radar/db';
import { eq } from 'drizzle-orm';

export interface StripeWebhookConfig {
  stripe: Stripe;
  webhookSecret: string;
  db: PoolDatabase;
}

export function registerStripeWebhookRoutes(
  app: FastifyInstance,
  config: StripeWebhookConfig,
) {
  // Stripe sends raw body — must configure Fastify to preserve it
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    },
  );

  app.post(
    '/webhooks/stripe',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['stripe-signature'];
      if (!signature) {
        return reply.status(400).send({ error: 'Missing stripe-signature header' });
      }

      let event: Stripe.Event;
      try {
        event = config.stripe.webhooks.constructEvent(
          request.body as Buffer,
          signature as string,
          config.webhookSecret,
        );
      } catch (err) {
        request.log.error({ err }, 'Stripe webhook signature verification failed');
        return reply.status(400).send({ error: 'Invalid signature' });
      }

      try {
        await handleStripeEvent(event, config.db, request.log);
      } catch (err) {
        request.log.error({ err, eventType: event.type }, 'Stripe webhook handler failed');
        // Return 500 so Stripe retries
        return reply.status(500).send({ error: 'Handler failed' });
      }

      return reply.status(200).send({ received: true });
    },
  );
}

async function handleStripeEvent(
  event: Stripe.Event,
  db: PoolDatabase,
  log: { error: (obj: unknown, msg: string) => void; info: (obj: unknown, msg: string) => void },
) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session, db, log);
      break;
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaid(invoice, db);
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(invoice, db);
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(subscription, db);
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription, db);
      break;
    }
    default:
      // Ignore unhandled event types
      break;
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  db: PoolDatabase,
  log: { error: (obj: unknown, msg: string) => void; info: (obj: unknown, msg: string) => void },
) {
  const clerkUserId = session.metadata?.['clerkUserId'];
  if (!clerkUserId || !session.subscription) return;

  // Find user by clerkId
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUserId),
  });

  if (!user) {
    // Clerk webhook hasn't created user yet — throw to trigger Stripe retry
    log.error(
      { clerkUserId, sessionId: session.id },
      'Stripe checkout.session.completed: user not found, will retry',
    );
    throw new Error(`User not found for clerkUserId: ${clerkUserId}`);
  }

  // Update user's stripeCustomerId
  if (session.customer && !user.stripeCustomerId) {
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer.id;
    await db
      .update(users)
      .set({ stripeCustomerId: customerId })
      .where(eq(users.id, user.id));
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id;

  // Upsert subscription (idempotent for Stripe retries)
  await db
    .insert(subscriptions)
    .values({
      userId: user.id,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: session.metadata?.['stripePriceId'] ?? 'unknown',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // ~30 days
      cancelAtPeriodEnd: false,
    })
    .onConflictDoNothing({ target: subscriptions.stripeSubscriptionId });

  log.info({ userId: user.id, subscriptionId }, 'Subscription created from checkout');
}

async function handleInvoicePaid(invoice: Stripe.Invoice, db: PoolDatabase) {
  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;
  if (!subscriptionId) return;

  await db
    .update(subscriptions)
    .set({
      status: 'active',
      currentPeriodEnd: invoice.lines.data[0]?.period?.end
        ? new Date(invoice.lines.data[0].period.end * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
}

async function handlePaymentFailed(invoice: Stripe.Invoice, db: PoolDatabase) {
  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;
  if (!subscriptionId) return;

  await db
    .update(subscriptions)
    .set({ status: 'past_due' })
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  db: PoolDatabase,
) {
  await db
    .update(subscriptions)
    .set({
      status: subscription.status as 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing' | 'paused',
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  db: PoolDatabase,
) {
  await db
    .update(subscriptions)
    .set({ status: 'canceled' })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
}

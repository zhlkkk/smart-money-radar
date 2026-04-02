import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerLemonWebhookRoutes } from '../../src/stripe/webhook.js';

vi.mock('@radar/db', () => ({
  subscriptions: { stripeSubscriptionId: 'stripe_subscription_id' },
  users: { clerkId: 'clerk_id', id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

const WEBHOOK_SECRET = 'test_webhook_secret_123';

function signPayload(body: string): string {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

function makePayload(eventName: string, subscriptionId: string, customData?: Record<string, string>, attrs?: Record<string, unknown>) {
  return JSON.stringify({
    meta: {
      event_name: eventName,
      test_mode: true,
      custom_data: customData ?? {},
    },
    data: {
      type: 'subscriptions',
      id: subscriptionId,
      attributes: {
        store_id: 1,
        customer_id: 100,
        order_id: 200,
        variant_id: 300,
        product_name: 'Pro Plan',
        variant_name: 'Monthly',
        user_email: 'test@example.com',
        status: 'active',
        cancelled: false,
        renews_at: '2026-05-01T00:00:00.000000Z',
        ends_at: null,
        created_at: '2026-04-01T00:00:00.000000Z',
        updated_at: '2026-04-01T00:00:00.000000Z',
        ...attrs,
      },
    },
  });
}

describe('LemonSqueezy Webhook Handler', () => {
  let app: FastifyInstance;
  const mockDb = {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
  } as any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    registerLemonWebhookRoutes(app, {
      webhookSecret: WEBHOOK_SECRET,
      db: mockDb,
    });
    await app.ready();
  });

  it('rejects requests without X-Signature header', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/lemonsqueezy',
      payload: '{}',
      headers: { 'content-type': 'application/json' },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'Missing X-Signature header' });
  });

  it('rejects requests with invalid signature', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/lemonsqueezy',
      payload: '{}',
      headers: {
        'content-type': 'application/json',
        'x-signature': 'invalid_sig',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'Invalid signature' });
  });

  it('handles subscription_created — creates subscription in DB', async () => {
    const mockUser = { id: 'user_1', clerkId: 'clerk_1', stripeCustomerId: null };
    mockDb.query.users.findFirst.mockResolvedValueOnce(mockUser);
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const body = makePayload('subscription_created', 'sub_1', { clerk_user_id: 'clerk_1' });
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/lemonsqueezy',
      payload: body,
      headers: {
        'content-type': 'application/json',
        'x-signature': signPayload(body),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockDb.query.users.findFirst).toHaveBeenCalledOnce();
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it('returns 500 when user not found (triggers retry)', async () => {
    mockDb.query.users.findFirst.mockResolvedValueOnce(undefined);

    const body = makePayload('subscription_created', 'sub_2', { clerk_user_id: 'clerk_missing' });
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/lemonsqueezy',
      payload: body,
      headers: {
        'content-type': 'application/json',
        'x-signature': signPayload(body),
      },
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ error: 'Handler failed' });
  });

  it('handles subscription_cancelled — marks canceled', async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const body = makePayload('subscription_cancelled', 'sub_3', {}, {
      status: 'cancelled',
      cancelled: true,
      ends_at: '2026-05-01T00:00:00.000000Z',
    });
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/lemonsqueezy',
      payload: body,
      headers: {
        'content-type': 'application/json',
        'x-signature': signPayload(body),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockDb.update).toHaveBeenCalledOnce();
  });

  it('handles subscription_payment_failed — marks past_due', async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const body = makePayload('subscription_payment_failed', 'sub_4', {}, { status: 'active' });
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/lemonsqueezy',
      payload: body,
      headers: {
        'content-type': 'application/json',
        'x-signature': signPayload(body),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockDb.update).toHaveBeenCalledOnce();
  });

  it('ignores unknown event types gracefully', async () => {
    const body = makePayload('order_created', 'ord_1');
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/lemonsqueezy',
      payload: body,
      headers: {
        'content-type': 'application/json',
        'x-signature': signPayload(body),
      },
    });

    expect(response.statusCode).toBe(200);
  });
});

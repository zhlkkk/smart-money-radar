import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerStripeWebhookRoutes } from '../../src/stripe/webhook.js';

// Mock @radar/db
vi.mock('@radar/db', () => ({
  subscriptions: { stripeSubscriptionId: 'stripe_subscription_id' },
  users: { clerkId: 'clerk_id', id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

describe('Stripe Webhook Handler', () => {
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

  const mockStripe = {
    webhooks: {
      constructEvent: vi.fn(),
    },
  } as any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    registerStripeWebhookRoutes(app, {
      stripe: mockStripe,
      webhookSecret: 'whsec_test',
      db: mockDb,
    });
    await app.ready();
  });

  it('rejects requests without stripe-signature header', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      payload: '{}',
      headers: { 'content-type': 'application/json' },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'Missing stripe-signature header' });
  });

  it('rejects requests with invalid signature', async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      payload: '{}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'invalid_sig',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'Invalid signature' });
  });

  it('handles checkout.session.completed — creates subscription', async () => {
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

    mockStripe.webhooks.constructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          subscription: 'sub_test_1',
          customer: 'cus_test_1',
          metadata: { clerkUserId: 'clerk_1', stripePriceId: 'price_test' },
        },
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      payload: '{}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'valid_sig',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockDb.query.users.findFirst).toHaveBeenCalledOnce();
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it('returns 500 when user not found (triggers Stripe retry)', async () => {
    mockDb.query.users.findFirst.mockResolvedValueOnce(undefined);

    mockStripe.webhooks.constructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_2',
          subscription: 'sub_test_2',
          customer: 'cus_test_2',
          metadata: { clerkUserId: 'clerk_missing' },
        },
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      payload: '{}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'valid_sig',
      },
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ error: 'Handler failed' });
  });

  it('handles customer.subscription.deleted — marks canceled', async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    mockStripe.webhooks.constructEvent.mockReturnValueOnce({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_test_del',
          status: 'canceled',
          cancel_at_period_end: false,
          current_period_end: Math.floor(Date.now() / 1000),
        },
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      payload: '{}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'valid_sig',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockDb.update).toHaveBeenCalledOnce();
  });

  it('handles customer.subscription.updated — syncs status', async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    mockStripe.webhooks.constructEvent.mockReturnValueOnce({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_test_upd',
          status: 'active',
          cancel_at_period_end: true,
          current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
        },
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      payload: '{}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'valid_sig',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockDb.update).toHaveBeenCalledOnce();
  });

  it('ignores unknown event types gracefully', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValueOnce({
      type: 'payment_intent.succeeded',
      data: { object: {} },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      payload: '{}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'valid_sig',
      },
    });

    expect(response.statusCode).toBe(200);
  });
});

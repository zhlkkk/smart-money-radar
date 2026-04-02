import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerPaddleWebhookRoutes } from '../../src/stripe/webhook.js';
import { EventName } from '@paddle/paddle-node-sdk';

vi.mock('@radar/db', () => ({
  subscriptions: { stripeSubscriptionId: 'stripe_subscription_id' },
  users: { clerkId: 'clerk_id', id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

describe('Paddle Webhook Handler', () => {
  let app: FastifyInstance;
  const mockDb = {
    query: { users: { findFirst: vi.fn() } },
    insert: vi.fn(),
    update: vi.fn(),
  } as any;

  const mockPaddle = {
    webhooks: { unmarshal: vi.fn() },
  } as any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    registerPaddleWebhookRoutes(app, {
      paddle: mockPaddle,
      webhookSecret: 'pdlntfy_test',
      db: mockDb,
    });
    await app.ready();
  });

  it('rejects requests without Paddle-Signature header', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/paddle',
      payload: '{}',
      headers: { 'content-type': 'application/json' },
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'Missing Paddle-Signature header' });
  });

  it('rejects requests with invalid signature', async () => {
    mockPaddle.webhooks.unmarshal.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/paddle',
      payload: '{}',
      headers: {
        'content-type': 'application/json',
        'paddle-signature': 'ts=123;h1=invalid',
      },
    });
    expect(response.statusCode).toBe(401);
  });

  it('handles subscription.created — creates subscription', async () => {
    const mockUser = { id: 'user_1', clerkId: 'clerk_1', stripeCustomerId: null };
    mockDb.query.users.findFirst.mockResolvedValueOnce(mockUser);
    mockDb.update.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
    mockDb.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }) });

    mockPaddle.webhooks.unmarshal.mockReturnValueOnce({
      eventType: EventName.SubscriptionCreated,
      eventId: 'evt_1',
      data: {
        id: 'sub_1',
        customerId: 'ctm_1',
        status: 'active',
        customData: { clerkUserId: 'clerk_1' },
        currentBillingPeriod: { startsAt: '2026-04-01T00:00:00Z', endsAt: '2026-05-01T00:00:00Z' },
        items: [{ price: { id: 'pri_test' } }],
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/paddle',
      payload: '{}',
      headers: {
        'content-type': 'application/json',
        'paddle-signature': 'ts=123;h1=valid',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it('handles subscription.canceled — marks canceled', async () => {
    mockDb.update.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });

    mockPaddle.webhooks.unmarshal.mockReturnValueOnce({
      eventType: EventName.SubscriptionCanceled,
      eventId: 'evt_2',
      data: {
        id: 'sub_2',
        status: 'canceled',
        scheduledChange: { action: 'cancel', effectiveAt: '2026-05-01T00:00:00Z' },
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/paddle',
      payload: '{}',
      headers: {
        'content-type': 'application/json',
        'paddle-signature': 'ts=123;h1=valid',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockDb.update).toHaveBeenCalledOnce();
  });

  it('ignores unknown event types gracefully', async () => {
    mockPaddle.webhooks.unmarshal.mockReturnValueOnce({
      eventType: 'address.created',
      eventId: 'evt_3',
      data: {},
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/paddle',
      payload: '{}',
      headers: {
        'content-type': 'application/json',
        'paddle-signature': 'ts=123;h1=valid',
      },
    });

    expect(response.statusCode).toBe(200);
  });
});

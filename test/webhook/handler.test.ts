import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { registerWebhookRoutes } from '../../src/webhook/handler.js';
import swapFixture from '../fixtures/swap-event.json' with { type: 'json' };

describe('POST /webhook', () => {
  const mockProcess = vi.fn().mockResolvedValue(undefined);
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    registerWebhookRoutes(app, {
      authToken: 'Bearer test-secret',
      processTransaction: mockProcess,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 and dispatches on valid auth', async () => {
    const res = await app.inject({
      method: 'POST', url: '/webhook',
      headers: { authorization: 'Bearer test-secret' },
      payload: [swapFixture],
    });
    expect(res.statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockProcess).toHaveBeenCalledOnce();
  });

  it('returns 401 on invalid auth', async () => {
    const res = await app.inject({
      method: 'POST', url: '/webhook',
      headers: { authorization: 'Bearer wrong' },
      payload: [swapFixture],
    });
    expect(res.statusCode).toBe(401);
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it('returns 401 on missing auth', async () => {
    const res = await app.inject({
      method: 'POST', url: '/webhook',
      payload: [swapFixture],
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 on empty array without processing', async () => {
    const res = await app.inject({
      method: 'POST', url: '/webhook',
      headers: { authorization: 'Bearer test-secret' },
      payload: [],
    });
    expect(res.statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it('dispatches multiple transactions', async () => {
    const res = await app.inject({
      method: 'POST', url: '/webhook',
      headers: { authorization: 'Bearer test-secret' },
      payload: [swapFixture, { ...swapFixture, signature: 'other-sig' }],
    });
    expect(res.statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockProcess).toHaveBeenCalledTimes(2);
  });
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const app = Fastify();
    registerWebhookRoutes(app, { authToken: 'Bearer test', processTransaction: vi.fn() });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });
});

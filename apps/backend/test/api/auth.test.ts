import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerApiAuthPlugin } from '../../src/api/auth.js';

describe('API Auth Plugin', () => {
  let app: FastifyInstance;
  const API_KEY = 'test-secret-api-key-123';

  beforeEach(async () => {
    app = Fastify();
    await registerApiAuthPlugin(app, { apiKey: API_KEY });

    // Add a test route under /api/v1 to verify auth
    app.get('/api/v1/test', async () => ({ ok: true }));

    // Add a route outside /api/v1 to verify it's NOT protected
    app.get('/health', async () => ({ status: 'ok' }));

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects requests without X-API-Key header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/test' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Missing or invalid API key' });
  });

  it('rejects requests with wrong API key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/test',
      headers: { 'x-api-key': 'wrong-key' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Missing or invalid API key' });
  });

  it('allows requests with correct API key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/test',
      headers: { 'x-api-key': API_KEY },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('does NOT protect routes outside /api/v1', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerHealthRoutes } from '../../src/api/health.js';

describe('GET /health (enhanced)', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('returns ok with db connected when query succeeds', async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([{ now: new Date() }]),
    };

    app = Fastify();
    registerHealthRoutes(app, { db: db as any });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('connected');
  });

  it('returns degraded when db query fails', async () => {
    const db = {
      execute: vi.fn().mockRejectedValue(new Error('connection refused')),
    };

    app = Fastify();
    registerHealthRoutes(app, { db: db as any });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('degraded');
    expect(body.db).toBe('disconnected');
  });

  it('returns ok without db when db is null', async () => {
    app = Fastify();
    registerHealthRoutes(app, { db: null });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('not_configured');
  });
});

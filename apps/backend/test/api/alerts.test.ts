import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerApiAuthPlugin } from '../../src/api/auth.js';
import { registerAlertsRoutes } from '../../src/api/alerts.js';

// Mock the drizzle query results
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

// Build a chainable mock for drizzle select builder
function createMockDb(rows: unknown[] = []) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return chain as unknown;
}

const API_KEY = 'test-key';

describe('GET /api/v1/alerts', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('returns paginated alerts ordered by createdAt DESC', async () => {
    // Return limit+1 (3) items to trigger hasMore=true
    const mockAlerts = [
      { id: 'alert1', signature: 'sig1', walletAddress: 'wallet1', walletLabel: 'Whale', tokenMint: 'mint1', tokenSymbol: 'BONK', dexSource: 'JUPITER', amountRaw: '1000', liquidity: 500000, fdv: 1000000, marketCap: 800000, mintAuthority: null, freezeAuthority: null, aiSummary: 'Smart money buy', telegramSent: true, createdAt: new Date('2026-04-01T00:00:00Z') },
      { id: 'alert2', signature: 'sig2', walletAddress: 'wallet2', walletLabel: null, tokenMint: 'mint2', tokenSymbol: 'WIF', dexSource: 'RAYDIUM', amountRaw: null, liquidity: null, fdv: null, marketCap: null, mintAuthority: null, freezeAuthority: null, aiSummary: null, telegramSent: true, createdAt: new Date('2026-03-31T00:00:00Z') },
      { id: 'alert3', signature: 'sig3', walletAddress: 'wallet3', walletLabel: null, tokenMint: 'mint3', tokenSymbol: 'SOL', dexSource: 'ORCA', amountRaw: null, liquidity: null, fdv: null, marketCap: null, mintAuthority: null, freezeAuthority: null, aiSummary: null, telegramSent: true, createdAt: new Date('2026-03-30T00:00:00Z') },
    ];

    const db = createMockDb(mockAlerts);

    app = Fastify();
    await registerApiAuthPlugin(app, { apiKey: API_KEY });
    registerAlertsRoutes(app, { db: db as any });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/alerts?limit=2',
      headers: { 'x-api-key': API_KEY },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe('alert1');
    expect(body.hasMore).toBe(true);
    expect(body.cursor).toBe('alert2');
  });

  it('uses cursor for pagination', async () => {
    const db = createMockDb([]);

    app = Fastify();
    await registerApiAuthPlugin(app, { apiKey: API_KEY });
    registerAlertsRoutes(app, { db: db as any });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/alerts?cursor=prev-last-id&limit=10',
      headers: { 'x-api-key': API_KEY },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toEqual([]);
    expect(body.hasMore).toBe(false);
    expect(body.cursor).toBeNull();
  });

  it('clamps limit to max 100', async () => {
    const db = createMockDb([]);

    app = Fastify();
    await registerApiAuthPlugin(app, { apiKey: API_KEY });
    registerAlertsRoutes(app, { db: db as any });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/alerts?limit=500',
      headers: { 'x-api-key': API_KEY },
    });

    expect(res.statusCode).toBe(200);
    // The limit call should have been called with 101 (max 100 + 1 to detect hasMore)
    expect((db as any).limit).toHaveBeenCalledWith(101);
  });

  it('defaults limit to 20', async () => {
    const db = createMockDb([]);

    app = Fastify();
    await registerApiAuthPlugin(app, { apiKey: API_KEY });
    registerAlertsRoutes(app, { db: db as any });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/alerts',
      headers: { 'x-api-key': API_KEY },
    });

    expect(res.statusCode).toBe(200);
    expect((db as any).limit).toHaveBeenCalledWith(21); // 20 + 1
  });

  it('requires auth', async () => {
    const db = createMockDb([]);

    app = Fastify();
    await registerApiAuthPlugin(app, { apiKey: API_KEY });
    registerAlertsRoutes(app, { db: db as any });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/alerts',
    });

    expect(res.statusCode).toBe(401);
  });
});

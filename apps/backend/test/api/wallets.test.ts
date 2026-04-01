import { describe, it, expect, vi, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerApiAuthPlugin } from '../../src/api/auth.js';
import { registerWalletsRoutes } from '../../src/api/wallets.js';

// Creates a chainable mock where every method returns `this`, and the chain
// resolves to `rows` when awaited (via .then). This handles variable-length
// chains like select().from().where() or select().from().where().orderBy().limit().
function createMockDb(rows: unknown[] = []) {
  const chain: Record<string, unknown> = {};
  const self = new Proxy(chain, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve(rows);
      }
      return vi.fn().mockReturnValue(self);
    },
  });
  return self as unknown;
}

const API_KEY = 'test-key';

describe('GET /api/v1/wallets', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('returns active wallets with scoring fields', async () => {
    const mockWallets = [
      {
        id: 'w1',
        address: 'wallet111',
        label: 'GMGN #1',
        category: 'DEX Whale',
        source: 'pinned',
        compositeScore: 85.5,
        winRate: 0.72,
        pnl: 150000,
        tradeCount: 200,
        isActive: true,
        lastDiscoveredAt: null,
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-04-01'),
      },
    ];

    const db = createMockDb(mockWallets);

    app = Fastify();
    await registerApiAuthPlugin(app, { apiKey: API_KEY });
    registerWalletsRoutes(app, { db: db as any });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/wallets',
      headers: { 'x-api-key': API_KEY },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].address).toBe('wallet111');
    expect(body.data[0].compositeScore).toBe(85.5);
  });

  it('requires auth', async () => {
    const db = createMockDb();
    app = Fastify();
    await registerApiAuthPlugin(app, { apiKey: API_KEY });
    registerWalletsRoutes(app, { db: db as any });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/v1/wallets' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/v1/wallets/:address', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('returns wallet detail with recent alerts', async () => {
    const walletRow = {
      id: 'w1',
      address: 'wallet111',
      label: 'Whale',
      category: 'DEX',
      source: 'pinned',
      compositeScore: 90,
      winRate: 0.8,
      pnl: 200000,
      tradeCount: 150,
      isActive: true,
      lastDiscoveredAt: null,
      createdAt: new Date('2026-03-01'),
      updatedAt: new Date('2026-04-01'),
    };

    const alertRows = [
      { id: 'a1', signature: 'sig1', walletAddress: 'wallet111', tokenSymbol: 'BONK', createdAt: new Date() },
    ];

    // Mock for wallet query (first chain) and alerts query (second chain)
    const walletChain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([walletRow]),
    };

    const alertChain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(alertRows),
    };

    let callCount = 0;
    const db = {
      select: vi.fn(() => {
        callCount++;
        return callCount === 1 ? walletChain : alertChain;
      }),
    };

    app = Fastify();
    await registerApiAuthPlugin(app, { apiKey: API_KEY });
    registerWalletsRoutes(app, { db: db as any });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/wallets/wallet111',
      headers: { 'x-api-key': API_KEY },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.wallet.address).toBe('wallet111');
    expect(body.recentAlerts).toHaveLength(1);
  });

  it('returns 404 for unknown wallet', async () => {
    const walletChain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    const db = { select: vi.fn(() => walletChain) };

    app = Fastify();
    await registerApiAuthPlugin(app, { apiKey: API_KEY });
    registerWalletsRoutes(app, { db: db as any });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/wallets/unknown-address',
      headers: { 'x-api-key': API_KEY },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Wallet not found' });
  });
});

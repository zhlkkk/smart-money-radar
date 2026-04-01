import type { FastifyInstance } from 'fastify';
import { alertsHistory, trackedWallets } from '@radar/db';
import type { PoolDatabase } from '@radar/db';
import { eq, desc } from 'drizzle-orm';

export interface WalletsRouteConfig {
  db: PoolDatabase;
}

export function registerWalletsRoutes(
  app: FastifyInstance,
  config: WalletsRouteConfig,
) {
  // GET /api/v1/wallets — list active wallets
  app.get('/api/v1/wallets', async (_request, reply) => {
    const rows = await config.db
      .select()
      .from(trackedWallets)
      .where(eq(trackedWallets.isActive, true))
      .orderBy(desc(trackedWallets.compositeScore));

    return reply.send({ data: rows });
  });

  // GET /api/v1/wallets/:address — wallet detail + recent alerts
  app.get('/api/v1/wallets/:address', async (request, reply) => {
    const { address } = request.params as { address: string };

    const walletRows = await config.db
      .select()
      .from(trackedWallets)
      .where(eq(trackedWallets.address, address));

    if (walletRows.length === 0) {
      return reply.status(404).send({ error: 'Wallet not found' });
    }

    const recentAlerts = await config.db
      .select()
      .from(alertsHistory)
      .where(eq(alertsHistory.walletAddress, address))
      .orderBy(desc(alertsHistory.createdAt))
      .limit(20);

    return reply.send({
      wallet: walletRows[0],
      recentAlerts,
    });
  });
}

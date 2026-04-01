import type { FastifyInstance } from 'fastify';
import type { PoolDatabase } from '@radar/db';
import { sql } from 'drizzle-orm';

export interface HealthRouteConfig {
  db: PoolDatabase | null;
}

export function registerHealthRoutes(
  app: FastifyInstance,
  config: HealthRouteConfig,
) {
  app.get('/health', async (_request, reply) => {
    if (!config.db) {
      return reply.send({ status: 'ok', db: 'not_configured' });
    }

    try {
      await config.db.execute(sql`SELECT 1`);
      return reply.send({ status: 'ok', db: 'connected' });
    } catch {
      return reply.send({ status: 'degraded', db: 'disconnected' });
    }
  });
}

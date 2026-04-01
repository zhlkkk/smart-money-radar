import type { FastifyInstance } from 'fastify';
import { alertsHistory } from '@radar/db';
import type { PoolDatabase } from '@radar/db';
import { desc, lt } from 'drizzle-orm';
import type { PaginatedResponse } from '@radar/shared';

export interface AlertsRouteConfig {
  db: PoolDatabase;
}

export function registerAlertsRoutes(
  app: FastifyInstance,
  config: AlertsRouteConfig,
) {
  app.get('/api/v1/alerts', async (request, reply) => {
    const query = request.query as { cursor?: string; limit?: string };
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);

    const conditions = [];
    if (query.cursor) {
      conditions.push(lt(alertsHistory.id, query.cursor));
    }

    const rows = await config.db
      .select()
      .from(alertsHistory)
      .where(conditions.length > 0 ? conditions[0] : undefined)
      .orderBy(desc(alertsHistory.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const cursor = data.length > 0 ? data[data.length - 1]!.id : null;

    const response: PaginatedResponse<(typeof rows)[0]> = {
      data,
      cursor: hasMore ? cursor : null,
      hasMore,
    };

    return reply.send(response);
  });
}

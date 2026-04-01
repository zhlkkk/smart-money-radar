import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import * as schema from './schema/index';

/**
 * Pool client for Railway long-running service.
 * Uses Neon's WebSocket-based Pool driver for persistent connections.
 * Reads DATABASE_POOL_URL environment variable.
 */
export function createPoolClient(databasePoolUrl: string) {
  const pool = new Pool({ connectionString: databasePoolUrl });
  return drizzle({ client: pool, schema });
}

export type PoolDatabase = ReturnType<typeof createPoolClient>;

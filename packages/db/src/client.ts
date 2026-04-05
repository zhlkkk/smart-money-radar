import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema/index';

/**
 * HTTP client for Vercel serverless environment.
 * Uses Neon's HTTP driver — stateless, no connection pool overhead.
 * Reads DATABASE_URL environment variable.
 */
export function createHttpClient(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle({ client: sql, schema });
}

export type HttpDatabase = ReturnType<typeof createHttpClient>;

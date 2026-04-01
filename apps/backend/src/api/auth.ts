import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export interface ApiAuthConfig {
  apiKey: string;
}

export async function registerApiAuthPlugin(
  app: FastifyInstance,
  config: ApiAuthConfig,
) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only protect /api/v1/* routes
    if (!request.url.startsWith('/api/v1')) return;

    const key = request.headers['x-api-key'];
    if (key !== config.apiKey) {
      return reply.status(401).send({ error: 'Missing or invalid API key' });
    }
  });
}

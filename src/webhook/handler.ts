import type { FastifyInstance } from 'fastify';
import type { HeliusEnhancedTransaction } from '../types.js';

export interface WebhookHandlerConfig {
  authToken: string;
  processTransaction: (tx: HeliusEnhancedTransaction) => Promise<void>;
}

export function registerWebhookRoutes(
  app: FastifyInstance,
  config: WebhookHandlerConfig,
): void {
  app.post('/webhook', async (request, reply) => {
    if (request.headers.authorization !== config.authToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    reply.status(200).send({ ok: true });

    const transactions = request.body as HeliusEnhancedTransaction[];
    for (const tx of transactions) {
      config.processTransaction(tx).catch((err) => {
        request.log.error({ err, signature: tx.signature }, 'Pipeline processing failed');
      });
    }
  });

  app.get('/health', async (_request, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });
}

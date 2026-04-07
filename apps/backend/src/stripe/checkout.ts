// Paddle Billing Checkout — 创建订阅交易
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Paddle, Environment } from '@paddle/paddle-node-sdk';

export interface CheckoutConfig {
  paddle: Paddle;
  priceId: string;
  appUrl: string;
}

export function registerCheckoutRoutes(
  app: FastifyInstance,
  config: CheckoutConfig,
) {
  app.post(
    '/api/v1/checkout',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { clerkUserId?: string; email?: string } | null;

      if (!body?.clerkUserId || !body?.email) {
        return reply.status(400).send({ error: 'clerkUserId and email are required' });
      }

      try {
        const transaction = await config.paddle.transactions.create({
          items: [{ priceId: config.priceId, quantity: 1 }],
          customData: {
            clerkUserId: body.clerkUserId,
          },
        });

        request.log.info({ id: transaction.id, checkout: transaction.checkout }, 'Paddle transaction created');
        const url = transaction.checkout?.url ?? (transaction as unknown as Record<string, unknown>).checkoutUrl as string | undefined;
        if (!url) {
          request.log.error({ checkout: transaction.checkout, id: transaction.id }, 'Paddle transaction created but no checkout URL');
          return reply.status(500).send({ error: 'Failed to create checkout URL' });
        }

        return reply.send({ url });
      } catch (err) {
        request.log.error({ err }, 'Paddle checkout creation failed');
        return reply.status(500).send({ error: 'Checkout creation failed' });
      }
    },
  );
}

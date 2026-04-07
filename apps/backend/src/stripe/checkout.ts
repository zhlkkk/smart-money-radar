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

        const url = transaction.checkout?.url;
        if (!url) {
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

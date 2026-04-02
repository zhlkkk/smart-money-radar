// LemonSqueezy Checkout — 创建订阅结账会话
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createCheckout, lemonSqueezySetup } from '@lemonsqueezy/lemonsqueezy.js';

export interface CheckoutConfig {
  apiKey: string;
  storeId: string;
  variantId: string;
  appUrl: string;
}

export function registerCheckoutRoutes(
  app: FastifyInstance,
  config: CheckoutConfig,
) {
  lemonSqueezySetup({ apiKey: config.apiKey });

  app.post(
    '/api/v1/checkout',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { clerkUserId?: string; email?: string } | null;

      if (!body?.clerkUserId || !body?.email) {
        return reply.status(400).send({ error: 'clerkUserId and email are required' });
      }

      try {
        const checkout = await createCheckout(
          config.storeId,
          config.variantId,
          {
            checkoutData: {
              email: body.email,
              custom: {
                clerk_user_id: body.clerkUserId,
              },
            },
            productOptions: {
              redirectUrl: `${config.appUrl}/dashboard?checkout=success`,
            },
          },
        );

        const url = checkout.data?.data.attributes.url;
        if (!url) {
          return reply.status(500).send({ error: 'Failed to create checkout URL' });
        }

        return reply.send({ url });
      } catch (err) {
        request.log.error({ err }, 'LemonSqueezy checkout creation failed');
        return reply.status(500).send({ error: 'Checkout creation failed' });
      }
    },
  );
}

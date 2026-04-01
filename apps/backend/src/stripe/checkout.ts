import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type Stripe from 'stripe';

export interface CheckoutConfig {
  stripe: Stripe;
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

      const session = await config.stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: body.email,
        line_items: [{ price: config.priceId, quantity: 1 }],
        success_url: `${config.appUrl}/dashboard?checkout=success`,
        cancel_url: `${config.appUrl}/pricing`,
        metadata: {
          clerkUserId: body.clerkUserId,
          stripePriceId: config.priceId,
        },
      });

      return reply.send({ url: session.url });
    },
  );
}

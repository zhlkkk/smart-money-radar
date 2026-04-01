import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  // Webhook pipeline (Phase 1)
  HELIUS_AUTH_TOKEN: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHANNEL_ID: z.string().min(1),
  SOLANA_RPC_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  SENTRY_DSN: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Wallet discovery (Phase 2)
  // HELIUS_API_KEY is for the webhook management REST API (PUT /v0/webhooks/<id>)
  // Different from HELIUS_AUTH_TOKEN which is the secret echoed in incoming webhook headers
  HELIUS_API_KEY: z.string().min(1).optional().or(z.literal('')).transform((v) => v || undefined),
  HELIUS_WEBHOOK_ID: z.string().optional().or(z.literal('')).transform((v) => v || undefined),
  BIRDEYE_API_KEY: z.string().min(1).optional().or(z.literal('')).transform((v) => v || undefined),
  DISCOVERY_INTERVAL_MS: z.coerce.number().default(21_600_000), // 6 hours
  DISCOVERY_WALLET_CAP: z.coerce.number().default(30),

  // Database (Phase 2) — optional so Phase 1 deployments continue working without DB
  DATABASE_POOL_URL: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${formatted}`);
  }
  return result.data;
}

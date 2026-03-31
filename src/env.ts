import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  HELIUS_AUTH_TOKEN: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHANNEL_ID: z.string().min(1),
  SOLANA_RPC_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  SENTRY_DSN: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
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

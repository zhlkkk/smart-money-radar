import { pgTable, text, timestamp, boolean, real } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';

export const alertsHistory = pgTable('alerts_history', {
  id: text('id')
    .$defaultFn(() => createId())
    .primaryKey(),
  signature: text('signature').notNull().unique(),
  userId: text('user_id').references(() => users.id),
  walletAddress: text('wallet_address').notNull(),
  walletLabel: text('wallet_label'),
  tokenMint: text('token_mint').notNull(),
  tokenSymbol: text('token_symbol'),
  dexSource: text('dex_source'),
  amountRaw: text('amount_raw'),
  liquidity: real('liquidity'),
  fdv: real('fdv'),
  marketCap: real('market_cap'),
  mintAuthority: text('mint_authority'),
  freezeAuthority: text('freeze_authority'),
  aiSummary: text('ai_summary'),
  telegramSent: boolean('telegram_sent').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

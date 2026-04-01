import { pgTable, text, timestamp, boolean, real, integer } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const walletSourceEnum = ['pinned', 'discovered'] as const;

export type WalletSource = (typeof walletSourceEnum)[number];

export const trackedWallets = pgTable('tracked_wallets', {
  id: text('id')
    .$defaultFn(() => createId())
    .primaryKey(),
  address: text('address').notNull().unique(),
  label: text('label'),
  category: text('category'),
  source: text('source', { enum: walletSourceEnum }).notNull(),
  compositeScore: real('composite_score'),
  winRate: real('win_rate'),
  pnl: real('pnl'),
  tradeCount: integer('trade_count'),
  isActive: boolean('is_active').default(true).notNull(),
  lastDiscoveredAt: timestamp('last_discovered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

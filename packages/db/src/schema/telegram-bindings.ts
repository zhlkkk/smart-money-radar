import { pgTable, text, timestamp, bigint } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';

export const telegramBindings = pgTable('telegram_bindings', {
  id: text('id')
    .$defaultFn(() => createId())
    .primaryKey(),
  clerkUserId: text('clerk_user_id')
    .notNull()
    .references(() => users.clerkId)
    .unique(),
  telegramId: bigint('telegram_id', { mode: 'bigint' }).notNull().unique(),
  telegramUsername: text('telegram_username'),
  boundAt: timestamp('bound_at', { withTimezone: true }).defaultNow().notNull(),
  unboundAt: timestamp('unbound_at', { withTimezone: true }),
});

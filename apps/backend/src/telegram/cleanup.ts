// ─── 订阅过期自动清理：定时从 Telegram 频道移除过期用户 ───

import type { PoolDatabase } from '@radar/db';
import { telegramBindings, users, subscriptions } from '@radar/db';
import { eq, isNull, and, ne, or } from 'drizzle-orm';
import { kickChatMember, sendMessage } from './bot.js';

/** 延迟指定毫秒 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 清理过期订阅的频道成员：
 * 1. 查询仍然绑定（unboundAt IS NULL）但订阅非 active 的用户
 * 2. 逐个 kick + 发送通知
 * 3. 返回统计 { removed, errors }
 */
export async function cleanupExpiredMembers(
  db: PoolDatabase,
  botToken: string,
  channelId: string,
  logger?: { warn: (...args: unknown[]) => void },
): Promise<{ removed: number; errors: number }> {
  // 查询所有绑定中（unboundAt IS NULL）且订阅非 active 的用户
  // LEFT JOIN subscriptions：没有订阅记录的用户也算过期
  const rows = await db
    .select({
      telegram_bindings: {
        telegramId: telegramBindings.telegramId,
        clerkUserId: telegramBindings.clerkUserId,
      },
    })
    .from(telegramBindings)
    .innerJoin(users, eq(telegramBindings.clerkUserId, users.clerkId))
    .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
    .where(
      and(
        isNull(telegramBindings.unboundAt),
        // 订阅不是 active（包括 NULL，即没有订阅记录）
        or(ne(subscriptions.status, 'active'), isNull(subscriptions.status)),
      ),
    );

  if (rows.length === 0) {
    return { removed: 0, errors: 0 };
  }

  let removed = 0;
  let errors = 0;

  for (const row of rows) {
    const telegramId = Number(row.telegram_bindings.telegramId);

    try {
      await kickChatMember(channelId, telegramId, botToken);
      await sendMessage(
        telegramId,
        '您的订阅已过期，已从告警频道移出。重新订阅后可再次加入: https://smartmoneyradar.com/pricing',
        botToken,
      );
      removed++;
    } catch (err) {
      errors++;
      logger?.warn('cleanup failed for user', {
        telegramId,
        clerkUserId: row.telegram_bindings.clerkUserId,
        error: String(err),
      });
    }

    // 避免 Telegram API 限流
    await delay(100);
  }

  return { removed, errors };
}

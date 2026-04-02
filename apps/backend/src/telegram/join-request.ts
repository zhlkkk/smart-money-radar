// ─── chat_join_request 自动审批：验证绑定 + 订阅状态 → approve/decline ───

import { eq, and, isNull } from 'drizzle-orm';
import { telegramBindings, users, subscriptions } from '@radar/db';
import type { PoolDatabase } from '@radar/db';
import type { TelegramUpdate } from './webhook.js';
import { approveChatJoinRequest, declineChatJoinRequest, sendMessage } from './bot.js';

const logger = {
  info(msg: string, ctx?: Record<string, unknown>) {
    console.info(`[join-request] ${msg}`, ctx ?? '');
  },
  warn(msg: string, ctx?: Record<string, unknown>) {
    console.warn(`[join-request] ${msg}`, ctx ?? '');
  },
};

/**
 * 处理频道加入请求
 *
 * 流程：
 * 1. 从 update.chat_join_request 获取 telegramId 和 user_chat_id
 * 2. 查 telegram_bindings 表找 clerkUserId（未解绑的绑定记录）
 * 3. 未绑定 → decline + 提示绑定
 * 4. 已绑定 → 通过 clerkUserId 查 users 表获取 userId → 查 subscriptions 表确认 active
 * 5. 订阅 active → approve + 欢迎消息
 * 6. 订阅非 active → decline + 提示订阅
 *
 * 安全原则：所有 Telegram API 调用 fire-and-forget，数据库失败降级为 decline
 */
export async function handleJoinRequest(
  update: TelegramUpdate,
  db: PoolDatabase,
  botToken: string,
  channelId: string,
): Promise<void> {
  const joinRequest = update.chat_join_request;
  if (!joinRequest) return;

  const telegramId = joinRequest.from.id;
  const userChatId = joinRequest.user_chat_id;

  try {
    // 步骤 1：查绑定关系
    const bindings = await db
      .select()
      .from(telegramBindings)
      .where(
        and(
          eq(telegramBindings.telegramId, BigInt(telegramId)),
          isNull(telegramBindings.unboundAt),
        ),
      );

    if (bindings.length === 0) {
      // 未绑定 → decline + 提示
      logger.info('未绑定用户申请加入', { telegramId });
      await Promise.allSettled([
        declineChatJoinRequest(channelId, telegramId, botToken),
        sendMessage(
          userChatId,
          '请先在 Dashboard 绑定 Telegram 账号: https://smartmoneyradar.com/dashboard',
          botToken,
        ),
      ]);
      return;
    }

    const clerkUserId = bindings[0]!.clerkUserId;

    // 步骤 2：通过 clerkUserId 查 users 表获取内部 userId
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId));

    if (userRows.length === 0) {
      // 用户表中找不到 → decline + 提示订阅
      logger.warn('绑定记录存在但 users 表无对应记录', { clerkUserId, telegramId });
      await Promise.allSettled([
        declineChatJoinRequest(channelId, telegramId, botToken),
        sendMessage(
          userChatId,
          '您的订阅未激活，请先订阅 Pro 计划: https://smartmoneyradar.com/pricing',
          botToken,
        ),
      ]);
      return;
    }

    const userId = userRows[0]!.id;

    // 步骤 3：查订阅状态
    const subs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    const hasActiveSub = subs.some((s) => s.status === 'active');

    if (hasActiveSub) {
      // 订阅 active → approve + 欢迎消息
      logger.info('审批通过', { telegramId, userId });
      await Promise.allSettled([
        approveChatJoinRequest(channelId, telegramId, botToken),
        sendMessage(
          userChatId,
          '🎉 欢迎加入 Smart Money Radar 告警频道！',
          botToken,
        ),
      ]);
    } else {
      // 订阅非 active → decline + 提示订阅
      logger.info('订阅未激活，拒绝加入', { telegramId, userId });
      await Promise.allSettled([
        declineChatJoinRequest(channelId, telegramId, botToken),
        sendMessage(
          userChatId,
          '您的订阅未激活，请先订阅 Pro 计划: https://smartmoneyradar.com/pricing',
          botToken,
        ),
      ]);
    }
  } catch (err) {
    // 数据库查询失败 → 降级为 decline（安全侧）
    logger.warn('处理加入请求时出错，降级拒绝', { telegramId, error: String(err) });
    await Promise.allSettled([
      declineChatJoinRequest(channelId, telegramId, botToken),
    ]);
  }
}

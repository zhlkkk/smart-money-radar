// ─── /bind 命令处理：验证码验证 → 写入绑定关系 ───

import { eq } from 'drizzle-orm';
import { telegramBindings } from '@radar/db';
import type { PoolDatabase } from '@radar/db';
import type { TelegramUpdate } from './webhook.js';
import { consumeBindCode } from './bind-codes.js';
import { sendMessage } from './bot.js';

/**
 * 处理 /bind XXXXXXXX 命令
 *
 * 流程：
 * 1. 解析命令和验证码参数
 * 2. 检查 Telegram ID 是否已绑定
 * 3. 验证码有效 → 写入 telegram_bindings
 * 4. 回复绑定结果
 */
export async function handleBindCommand(
  update: TelegramUpdate,
  db: PoolDatabase,
  botToken: string,
  inviteLink: string,
): Promise<void> {
  const message = update.message;
  if (!message?.text) return;

  const text = message.text.trim();

  // 只处理 /bind 命令
  if (!text.startsWith('/bind')) return;

  const chatId = message.chat.id;
  const telegramId = message.from.id;
  const telegramUsername = message.from.username ?? null;

  // 解析验证码参数
  const parts = text.split(/\s+/);
  const code = parts[1]?.trim();

  if (!code) {
    await sendMessage(
      chatId,
      '使用方式：/bind <验证码>\n请在 Dashboard 获取绑定验证码后发送给我。',
      botToken,
    );
    return;
  }

  // 检查此 Telegram ID 是否已绑定
  const existing = await db
    .select()
    .from(telegramBindings)
    .where(eq(telegramBindings.telegramId, BigInt(telegramId)));

  if (existing.length > 0) {
    await sendMessage(chatId, '您的 Telegram 已绑定，无需重复操作。', botToken);
    return;
  }

  // 验证并消费验证码
  const clerkUserId = consumeBindCode(code);
  if (!clerkUserId) {
    await sendMessage(chatId, '验证码无效或已过期，请在 Dashboard 重新获取。', botToken);
    return;
  }

  // 写入绑定关系
  try {
    await db.insert(telegramBindings).values({
      clerkUserId,
      telegramId: BigInt(telegramId),
      telegramUsername,
    });
  } catch (err: unknown) {
    // 唯一约束冲突（clerkUserId 或 telegramId 已存在）
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23505') {
      await sendMessage(chatId, '此 Telegram 账号已绑定其他用户。', botToken);
      return;
    }
    throw err;
  }

  await sendMessage(
    chatId,
    `绑定成功！点击链接加入频道: ${inviteLink}`,
    botToken,
  );
}

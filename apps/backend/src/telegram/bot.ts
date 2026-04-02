// ─── 通用 Telegram Bot API 调用 ───

const logger = {
  warn(msg: string, ctx?: Record<string, unknown>) {
    console.warn(`[telegram] ${msg}`, ctx ?? '');
  },
};

/**
 * 通用 Telegram API 调用（fire-and-forget 安全：不抛出异常）
 */
async function callTelegramApi(
  method: string,
  body: Record<string, unknown>,
  botToken: string,
): Promise<unknown> {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`Telegram ${method} failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

// ─── 原有的 sendAlert（保留向后兼容） ───

export async function sendAlert(
  html: string,
  botToken: string,
  channelId: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = JSON.stringify({
    chat_id: channelId,
    text: html,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
  const headers = { 'Content-Type': 'application/json' };

  const response = await fetch(url, { method: 'POST', headers, body: payload });

  if (!response.ok) {
    const body = await response.text();
    await new Promise((r) => setTimeout(r, 2000));
    const retry = await fetch(url, { method: 'POST', headers, body: payload });
    if (!retry.ok) {
      throw new Error(`Telegram send failed after retry: ${retry.status} ${body}`);
    }
  }
}

// ─── 新增 Bot API 方法（fire-and-forget，不抛异常） ───

/** 批准频道/群组的加入请求 */
export async function approveChatJoinRequest(
  chatId: string,
  userId: number,
  botToken: string,
): Promise<void> {
  try {
    await callTelegramApi('approveChatJoinRequest', { chat_id: chatId, user_id: userId }, botToken);
  } catch (err) {
    logger.warn('approveChatJoinRequest failed', { chatId, userId, error: String(err) });
  }
}

/** 拒绝频道/群组的加入请求 */
export async function declineChatJoinRequest(
  chatId: string,
  userId: number,
  botToken: string,
): Promise<void> {
  try {
    await callTelegramApi('declineChatJoinRequest', { chat_id: chatId, user_id: userId }, botToken);
  } catch (err) {
    logger.warn('declineChatJoinRequest failed', { chatId, userId, error: String(err) });
  }
}

/** 发送消息（通用版，支持向任意 chat_id 发消息） */
export async function sendMessage(
  chatId: number | string,
  text: string,
  botToken: string,
): Promise<void> {
  try {
    await callTelegramApi('sendMessage', { chat_id: chatId, text }, botToken);
  } catch (err) {
    logger.warn('sendMessage failed', { chatId, error: String(err) });
  }
}

/** 踢出成员（ban 然后 unban，实现真正的踢出而非永久封禁） */
export async function kickChatMember(
  chatId: string,
  userId: number,
  botToken: string,
): Promise<void> {
  await callTelegramApi('banChatMember', { chat_id: chatId, user_id: userId }, botToken);
  // unban 必须成功，否则用户被永久封禁。失败时重试一次。
  try {
    await callTelegramApi('unbanChatMember', { chat_id: chatId, user_id: userId, only_if_banned: true }, botToken);
  } catch {
    // 等待 500ms 后重试
    await new Promise((r) => setTimeout(r, 500));
    await callTelegramApi('unbanChatMember', { chat_id: chatId, user_id: userId, only_if_banned: true }, botToken);
  }
}

// Telegram Bot Webhook — 接收 Telegram Bot API 的 Update 推送
import type { FastifyInstance } from 'fastify';

export interface TelegramWebhookConfig {
  secretToken: string;
  onMessage: (update: TelegramUpdate) => Promise<void>;
  onChatJoinRequest: (update: TelegramUpdate) => Promise<void>;
}

/** Telegram Update 类型（最小化定义，只包含我们需要的字段） */
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; username?: string; first_name: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
  chat_join_request?: {
    chat: { id: number; title?: string };
    from: { id: number; username?: string; first_name: string };
    user_chat_id: number;
    date: number;
    invite_link?: { invite_link: string; name?: string };
  };
}

/**
 * Fastify 插件：Telegram Webhook 接收端
 *
 * 验证 X-Telegram-Bot-Api-Secret-Token 后，fire-and-forget 分发到对应 handler。
 */
export function telegramWebhookPlugin(config: TelegramWebhookConfig) {
  return async function (app: FastifyInstance) {
    app.post('/webhooks/telegram', async (request, reply) => {
      // 验证 secret token
      const secretToken = request.headers['x-telegram-bot-api-secret-token'];
      if (secretToken !== config.secretToken) {
        return reply.code(401).send({ error: 'Invalid secret token' });
      }

      const update = request.body as TelegramUpdate;

      // Fire-and-forget：立即返回 200，后台处理
      reply.code(200).send({ ok: true });

      // 异步分发（错误静默吞掉，避免影响响应）
      if (update.chat_join_request) {
        config.onChatJoinRequest(update).catch(() => {});
      } else if (update.message?.text) {
        config.onMessage(update).catch(() => {});
      }
    });
  };
}

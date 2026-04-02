import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { telegramWebhookPlugin, type TelegramUpdate } from '../../src/telegram/webhook.js';

describe('POST /webhooks/telegram', () => {
  const SECRET = 'test-tg-secret';
  const onMessage = vi.fn().mockResolvedValue(undefined);
  const onChatJoinRequest = vi.fn().mockResolvedValue(undefined);
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.register(telegramWebhookPlugin({
      secretToken: SECRET,
      onMessage,
      onChatJoinRequest,
    }));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 with valid secret token', async () => {
    const update: TelegramUpdate = { update_id: 1 };
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/telegram',
      headers: { 'x-telegram-bot-api-secret-token': SECRET },
      payload: update,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('returns 401 with invalid secret token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/telegram',
      headers: { 'x-telegram-bot-api-secret-token': 'wrong-token' },
      payload: { update_id: 1 },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Invalid secret token' });
  });

  it('returns 401 with missing secret token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/telegram',
      payload: { update_id: 1 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('routes chat_join_request to onChatJoinRequest handler', async () => {
    const update: TelegramUpdate = {
      update_id: 2,
      chat_join_request: {
        chat: { id: -100123, title: 'Test Channel' },
        from: { id: 999, username: 'testuser', first_name: 'Test' },
        user_chat_id: 999,
        date: 1700000000,
      },
    };

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/telegram',
      headers: { 'x-telegram-bot-api-secret-token': SECRET },
      payload: update,
    });
    expect(res.statusCode).toBe(200);

    // 等待异步处理
    await new Promise((r) => setTimeout(r, 50));
    expect(onChatJoinRequest).toHaveBeenCalledWith(update);
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('routes message with text to onMessage handler', async () => {
    const update: TelegramUpdate = {
      update_id: 3,
      message: {
        message_id: 42,
        from: { id: 111, username: 'sender', first_name: 'Sender' },
        chat: { id: 111, type: 'private' },
        text: '/start',
        date: 1700000000,
      },
    };

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/telegram',
      headers: { 'x-telegram-bot-api-secret-token': SECRET },
      payload: update,
    });
    expect(res.statusCode).toBe(200);

    await new Promise((r) => setTimeout(r, 50));
    expect(onMessage).toHaveBeenCalledWith(update);
    expect(onChatJoinRequest).not.toHaveBeenCalled();
  });

  it('returns 200 and silently ignores unknown update types', async () => {
    const update = { update_id: 4, edited_message: { text: 'edited' } };

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/telegram',
      headers: { 'x-telegram-bot-api-secret-token': SECRET },
      payload: update,
    });
    expect(res.statusCode).toBe(200);

    await new Promise((r) => setTimeout(r, 50));
    expect(onMessage).not.toHaveBeenCalled();
    expect(onChatJoinRequest).not.toHaveBeenCalled();
  });
});

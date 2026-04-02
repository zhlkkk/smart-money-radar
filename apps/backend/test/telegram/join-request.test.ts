import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleJoinRequest } from '../../src/telegram/join-request.js';
import type { TelegramUpdate } from '../../src/telegram/webhook.js';
import * as bot from '../../src/telegram/bot.js';

// Mock Telegram Bot API 方法
vi.mock('../../src/telegram/bot.js', () => ({
  approveChatJoinRequest: vi.fn(),
  declineChatJoinRequest: vi.fn(),
  sendMessage: vi.fn(),
}));

const BOT_TOKEN = 'test-bot-token';
const CHANNEL_ID = '@test_channel';

// ─── Mock 数据库 ───

function createMockDb(options?: {
  bindingRows?: Array<{ clerkUserId: string }>;
  userRows?: Array<{ id: string }>;
  subscriptionRows?: Array<{ status: string }>;
  throwOnBinding?: boolean;
  throwOnUser?: boolean;
  throwOnSubscription?: boolean;
}) {
  const opts = options ?? {};

  // 链式 mock：db.select().from(table).where(condition) → rows
  // 需要根据 from() 传入的 table 返回不同结果
  let callIndex = 0;
  const results = [
    opts.bindingRows ?? [],
    opts.userRows ?? [],
    opts.subscriptionRows ?? [],
  ];
  const throwFlags = [
    opts.throwOnBinding ?? false,
    opts.throwOnUser ?? false,
    opts.throwOnSubscription ?? false,
  ];

  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          const idx = callIndex++;
          if (throwFlags[idx]) {
            return Promise.reject(new Error('Database connection error'));
          }
          return Promise.resolve(results[idx] ?? []);
        }),
      })),
    })),
  };

  return mockDb as unknown;
}

// ─── 构造 TelegramUpdate（chat_join_request） ───

function makeJoinRequestUpdate(
  telegramId = 12345,
  userChatId = 99999,
): TelegramUpdate {
  return {
    update_id: 1,
    chat_join_request: {
      chat: { id: -1001234567890, title: 'Smart Money Alerts' },
      from: { id: telegramId, username: 'testuser', first_name: 'Test' },
      user_chat_id: userChatId,
      date: Math.floor(Date.now() / 1000),
    },
  };
}

describe('handleJoinRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: 已绑定 + 订阅 active → approve + 欢迎消息', async () => {
    const db = createMockDb({
      bindingRows: [{ clerkUserId: 'clerk_abc123' }],
      userRows: [{ id: 'user_001' }],
      subscriptionRows: [{ status: 'active' }],
    });

    const update = makeJoinRequestUpdate(12345, 99999);
    await handleJoinRequest(update, db, BOT_TOKEN, CHANNEL_ID);

    expect(bot.approveChatJoinRequest).toHaveBeenCalledWith(CHANNEL_ID, 12345, BOT_TOKEN);
    expect(bot.sendMessage).toHaveBeenCalledWith(
      99999,
      expect.stringContaining('欢迎加入'),
      BOT_TOKEN,
    );
    expect(bot.declineChatJoinRequest).not.toHaveBeenCalled();
  });

  it('未绑定用户 → decline + "请先绑定"提示', async () => {
    const db = createMockDb({
      bindingRows: [], // 没有绑定记录
    });

    const update = makeJoinRequestUpdate(12345, 99999);
    await handleJoinRequest(update, db, BOT_TOKEN, CHANNEL_ID);

    expect(bot.declineChatJoinRequest).toHaveBeenCalledWith(CHANNEL_ID, 12345, BOT_TOKEN);
    expect(bot.sendMessage).toHaveBeenCalledWith(
      99999,
      expect.stringContaining('绑定'),
      BOT_TOKEN,
    );
    expect(bot.approveChatJoinRequest).not.toHaveBeenCalled();
  });

  it('已绑定但订阅非 active → decline + "请先订阅"提示', async () => {
    const db = createMockDb({
      bindingRows: [{ clerkUserId: 'clerk_abc123' }],
      userRows: [{ id: 'user_001' }],
      subscriptionRows: [{ status: 'canceled' }],
    });

    const update = makeJoinRequestUpdate(12345, 99999);
    await handleJoinRequest(update, db, BOT_TOKEN, CHANNEL_ID);

    expect(bot.declineChatJoinRequest).toHaveBeenCalledWith(CHANNEL_ID, 12345, BOT_TOKEN);
    expect(bot.sendMessage).toHaveBeenCalledWith(
      99999,
      expect.stringContaining('订阅'),
      BOT_TOKEN,
    );
    expect(bot.approveChatJoinRequest).not.toHaveBeenCalled();
  });

  it('已绑定但无 users 记录 → decline + "请先订阅"提示', async () => {
    const db = createMockDb({
      bindingRows: [{ clerkUserId: 'clerk_abc123' }],
      userRows: [], // 用户表中找不到对应记录
      subscriptionRows: [],
    });

    const update = makeJoinRequestUpdate(12345, 99999);
    await handleJoinRequest(update, db, BOT_TOKEN, CHANNEL_ID);

    expect(bot.declineChatJoinRequest).toHaveBeenCalledWith(CHANNEL_ID, 12345, BOT_TOKEN);
    expect(bot.sendMessage).toHaveBeenCalledWith(
      99999,
      expect.stringContaining('订阅'),
      BOT_TOKEN,
    );
  });

  it('已绑定但无订阅记录 → decline + "请先订阅"提示', async () => {
    const db = createMockDb({
      bindingRows: [{ clerkUserId: 'clerk_abc123' }],
      userRows: [{ id: 'user_001' }],
      subscriptionRows: [], // 没有订阅记录
    });

    const update = makeJoinRequestUpdate(12345, 99999);
    await handleJoinRequest(update, db, BOT_TOKEN, CHANNEL_ID);

    expect(bot.declineChatJoinRequest).toHaveBeenCalledWith(CHANNEL_ID, 12345, BOT_TOKEN);
    expect(bot.sendMessage).toHaveBeenCalledWith(
      99999,
      expect.stringContaining('订阅'),
      BOT_TOKEN,
    );
  });

  it('Telegram API 调用失败 → 不抛异常', async () => {
    // 即使 approve/sendMessage 抛异常也不应传播
    vi.mocked(bot.approveChatJoinRequest).mockRejectedValue(new Error('Telegram API error'));
    vi.mocked(bot.sendMessage).mockRejectedValue(new Error('Telegram API error'));

    const db = createMockDb({
      bindingRows: [{ clerkUserId: 'clerk_abc123' }],
      userRows: [{ id: 'user_001' }],
      subscriptionRows: [{ status: 'active' }],
    });

    const update = makeJoinRequestUpdate(12345, 99999);
    // 不应抛出异常
    await expect(handleJoinRequest(update, db, BOT_TOKEN, CHANNEL_ID)).resolves.toBeUndefined();
  });

  it('数据库查询失败 → 降级 decline（安全侧）', async () => {
    const db = createMockDb({
      throwOnBinding: true, // 第一个查询就失败
    });

    const update = makeJoinRequestUpdate(12345, 99999);
    await handleJoinRequest(update, db, BOT_TOKEN, CHANNEL_ID);

    // 降级为 decline
    expect(bot.declineChatJoinRequest).toHaveBeenCalledWith(CHANNEL_ID, 12345, BOT_TOKEN);
    expect(bot.approveChatJoinRequest).not.toHaveBeenCalled();
  });

  it('无 chat_join_request 字段的 update → 直接返回', async () => {
    const db = createMockDb();
    const update: TelegramUpdate = { update_id: 1 };

    await handleJoinRequest(update, db, BOT_TOKEN, CHANNEL_ID);

    expect(bot.approveChatJoinRequest).not.toHaveBeenCalled();
    expect(bot.declineChatJoinRequest).not.toHaveBeenCalled();
    expect(bot.sendMessage).not.toHaveBeenCalled();
  });
});

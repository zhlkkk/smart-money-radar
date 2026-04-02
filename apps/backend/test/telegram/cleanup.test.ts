import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanupExpiredMembers } from '../../src/telegram/cleanup.js';
import * as bot from '../../src/telegram/bot.js';

// Mock Telegram Bot API 方法
vi.mock('../../src/telegram/bot.js', () => ({
  kickChatMember: vi.fn(),
  sendMessage: vi.fn(),
}));

// Mock 延迟函数避免测试等待
vi.mock('../../src/telegram/cleanup.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/telegram/cleanup.js')>();
  return {
    ...mod,
  };
});

const BOT_TOKEN = 'test-bot-token';
const CHANNEL_ID = '@test_channel';

// ─── Mock 数据库：返回过期成员列表 ───

interface ExpiredMember {
  telegramId: bigint;
  clerkUserId: string;
}

function createMockDb(options?: {
  expiredMembers?: ExpiredMember[];
  throwOnQuery?: boolean;
}) {
  const opts = options ?? {};

  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => {
              if (opts.throwOnQuery) {
                return Promise.reject(new Error('Database connection error'));
              }
              // 返回 JOIN 后的行数据
              return Promise.resolve(
                (opts.expiredMembers ?? []).map((m) => ({
                  telegram_bindings: {
                    telegramId: m.telegramId,
                    clerkUserId: m.clerkUserId,
                  },
                })),
              );
            }),
          })),
        })),
      })),
    })),
  };

  return mockDb as unknown;
}

// ─── Mock logger ───

function createMockLogger() {
  return {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  };
}

describe('cleanupExpiredMembers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // 重新设置 mock（restoreAllMocks 会清除 mock 实现）
    vi.mocked(bot.kickChatMember).mockResolvedValue(undefined);
    vi.mocked(bot.sendMessage).mockResolvedValue(undefined);
    // 加速测试：mock setTimeout/延迟
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('happy path: 1 个过期用户 → kick + 通知 → { removed: 1, errors: 0 }', async () => {
    const db = createMockDb({
      expiredMembers: [{ telegramId: 12345n, clerkUserId: 'clerk_abc' }],
    });
    const logger = createMockLogger();

    const promise = cleanupExpiredMembers(db, BOT_TOKEN, CHANNEL_ID, logger);
    // 推进定时器以跳过 100ms 延迟
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result).toEqual({ removed: 1, errors: 0 });
    expect(bot.kickChatMember).toHaveBeenCalledWith(CHANNEL_ID, 12345, BOT_TOKEN);
    expect(bot.sendMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining('订阅已过期'),
      BOT_TOKEN,
    );
  });

  it('没有过期用户 → 快速返回 { removed: 0, errors: 0 }', async () => {
    const db = createMockDb({ expiredMembers: [] });
    const logger = createMockLogger();

    const result = await cleanupExpiredMembers(db, BOT_TOKEN, CHANNEL_ID, logger);

    expect(result).toEqual({ removed: 0, errors: 0 });
    expect(bot.kickChatMember).not.toHaveBeenCalled();
    expect(bot.sendMessage).not.toHaveBeenCalled();
  });

  it('kickChatMember 抛异常 → 记录日志，返回 { removed: 0, errors: 1 }', async () => {
    vi.mocked(bot.kickChatMember).mockRejectedValue(new Error('Telegram API error'));

    const db = createMockDb({
      expiredMembers: [{ telegramId: 12345n, clerkUserId: 'clerk_abc' }],
    });
    const logger = createMockLogger();

    const promise = cleanupExpiredMembers(db, BOT_TOKEN, CHANNEL_ID, logger);
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result).toEqual({ removed: 0, errors: 1 });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('cleanup failed'),
      expect.any(Object),
    );
  });

  it('多个过期用户 → 按序处理每个', async () => {
    const db = createMockDb({
      expiredMembers: [
        { telegramId: 111n, clerkUserId: 'clerk_a' },
        { telegramId: 222n, clerkUserId: 'clerk_b' },
        { telegramId: 333n, clerkUserId: 'clerk_c' },
      ],
    });
    const logger = createMockLogger();

    const promise = cleanupExpiredMembers(db, BOT_TOKEN, CHANNEL_ID, logger);
    // 推进足够时间以覆盖所有延迟
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(result).toEqual({ removed: 3, errors: 0 });
    expect(bot.kickChatMember).toHaveBeenCalledTimes(3);
    expect(bot.sendMessage).toHaveBeenCalledTimes(3);

    // 验证每个用户都被处理
    expect(bot.kickChatMember).toHaveBeenCalledWith(CHANNEL_ID, 111, BOT_TOKEN);
    expect(bot.kickChatMember).toHaveBeenCalledWith(CHANNEL_ID, 222, BOT_TOKEN);
    expect(bot.kickChatMember).toHaveBeenCalledWith(CHANNEL_ID, 333, BOT_TOKEN);
  });

  it('部分用户失败 → 继续处理其他用户', async () => {
    // 第二个用户 kick 失败
    vi.mocked(bot.kickChatMember)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValueOnce(undefined);

    const db = createMockDb({
      expiredMembers: [
        { telegramId: 111n, clerkUserId: 'clerk_a' },
        { telegramId: 222n, clerkUserId: 'clerk_b' },
        { telegramId: 333n, clerkUserId: 'clerk_c' },
      ],
    });
    const logger = createMockLogger();

    const promise = cleanupExpiredMembers(db, BOT_TOKEN, CHANNEL_ID, logger);
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(result).toEqual({ removed: 2, errors: 1 });
    // 所有 3 个用户都应被尝试
    expect(bot.kickChatMember).toHaveBeenCalledTimes(3);
  });

  it('无 logger → 不抛异常', async () => {
    vi.mocked(bot.kickChatMember).mockRejectedValue(new Error('fail'));

    const db = createMockDb({
      expiredMembers: [{ telegramId: 12345n, clerkUserId: 'clerk_abc' }],
    });

    const promise = cleanupExpiredMembers(db, BOT_TOKEN, CHANNEL_ID);
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result).toEqual({ removed: 0, errors: 1 });
  });
});

// 需要 afterEach 放在 describe 外面也可以，但 vitest 支持在 describe 内
import { afterEach } from 'vitest';

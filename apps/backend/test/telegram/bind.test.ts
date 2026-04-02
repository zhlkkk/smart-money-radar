import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleBindCommand } from '../../src/telegram/bind.js';
import type { TelegramUpdate } from '../../src/telegram/webhook.js';
import * as bindCodes from '../../src/telegram/bind-codes.js';
import * as bot from '../../src/telegram/bot.js';

// Mock 外部依赖
vi.mock('../../src/telegram/bind-codes.js', () => ({
  consumeBindCode: vi.fn(),
}));

vi.mock('../../src/telegram/bot.js', () => ({
  sendMessage: vi.fn(),
}));

const BOT_TOKEN = 'test-bot-token';
const INVITE_LINK = 'https://t.me/+invite123';

function makeUpdate(text: string, userId = 12345, username = 'testuser'): TelegramUpdate {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      from: { id: userId, username, first_name: 'Test' },
      chat: { id: userId, type: 'private' },
      text,
      date: Math.floor(Date.now() / 1000),
    },
  };
}

// 模拟 db 对象
function makeMockDb() {
  const insertValues = vi.fn().mockReturnThis();
  const insertResult = { values: insertValues };
  const insert = vi.fn().mockReturnValue(insertResult);

  const selectFrom = vi.fn().mockReturnThis();
  const where = vi.fn().mockReturnValue([]);
  const selectResult = { from: selectFrom, where };
  const select = vi.fn().mockReturnValue(selectResult);

  return { insert, select, _insertValues: insertValues, _where: where };
}

describe('handleBindCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replies with usage when no code is provided', async () => {
    const db = makeMockDb();
    const update = makeUpdate('/bind');

    await handleBindCommand(update, db as never, BOT_TOKEN, INVITE_LINK);

    expect(bot.sendMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining('使用方式'),
      BOT_TOKEN,
    );
  });

  it('replies with usage when /bind has no argument after space', async () => {
    const db = makeMockDb();
    const update = makeUpdate('/bind ');

    await handleBindCommand(update, db as never, BOT_TOKEN, INVITE_LINK);

    expect(bot.sendMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining('使用方式'),
      BOT_TOKEN,
    );
  });

  it('replies "already bound" when telegram is already bound', async () => {
    const db = makeMockDb();
    // 模拟查询返回已有绑定
    db._where.mockReturnValueOnce([{ telegramId: BigInt(12345), clerkUserId: 'user_existing' }]);

    const update = makeUpdate('/bind ABC12345');
    await handleBindCommand(update, db as never, BOT_TOKEN, INVITE_LINK);

    expect(bot.sendMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining('已绑定'),
      BOT_TOKEN,
    );
    // 不应消费验证码
    expect(bindCodes.consumeBindCode).not.toHaveBeenCalled();
  });

  it('replies "invalid code" when code is invalid', async () => {
    const db = makeMockDb();
    db._where.mockReturnValueOnce([]); // 未绑定
    vi.mocked(bindCodes.consumeBindCode).mockReturnValue(null);

    const update = makeUpdate('/bind BADCODE1');
    await handleBindCommand(update, db as never, BOT_TOKEN, INVITE_LINK);

    expect(bot.sendMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining('验证码无效或已过期'),
      BOT_TOKEN,
    );
  });

  it('binds successfully with valid code', async () => {
    const db = makeMockDb();
    db._where.mockReturnValueOnce([]); // 未绑定
    vi.mocked(bindCodes.consumeBindCode).mockReturnValue('user_abc');

    const update = makeUpdate('/bind VALIDC01', 99999, 'alice');
    await handleBindCommand(update, db as never, BOT_TOKEN, INVITE_LINK);

    expect(db.insert).toHaveBeenCalled();
    expect(db._insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkUserId: 'user_abc',
        telegramId: BigInt(99999),
        telegramUsername: 'alice',
      }),
    );
    expect(bot.sendMessage).toHaveBeenCalledWith(
      99999,
      expect.stringContaining('绑定成功'),
      BOT_TOKEN,
    );
    expect(bot.sendMessage).toHaveBeenCalledWith(
      99999,
      expect.stringContaining(INVITE_LINK),
      BOT_TOKEN,
    );
  });

  it('replies "already bound to other user" on unique constraint violation', async () => {
    const db = makeMockDb();
    db._where.mockReturnValueOnce([]); // 未绑定
    vi.mocked(bindCodes.consumeBindCode).mockReturnValue('user_new');
    // 模拟唯一约束冲突
    db._insertValues.mockRejectedValueOnce(
      Object.assign(new Error('unique constraint'), { code: '23505' }),
    );

    const update = makeUpdate('/bind VALIDC02', 88888);
    await handleBindCommand(update, db as never, BOT_TOKEN, INVITE_LINK);

    expect(bot.sendMessage).toHaveBeenCalledWith(
      88888,
      expect.stringContaining('已绑定其他用户'),
      BOT_TOKEN,
    );
  });

  it('ignores non-/bind messages', async () => {
    const db = makeMockDb();
    const update = makeUpdate('hello world');

    await handleBindCommand(update, db as never, BOT_TOKEN, INVITE_LINK);

    expect(bot.sendMessage).not.toHaveBeenCalled();
  });
});

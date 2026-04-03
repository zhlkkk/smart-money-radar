import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { collectWalletTrades, collectAllWallets } from '../../../src/scripts/backtest/collect.js';
import type { RateLimiter } from '../../../src/discovery/rate-limiter.js';
import type { WalletTradeData } from '../../../src/scripts/backtest/types.js';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn<(typeof import('node:fs/promises'))['mkdir']>().mockResolvedValue(undefined),
  readFile: vi.fn<(typeof import('node:fs/promises'))['readFile']>(),
  writeFile: vi.fn<(typeof import('node:fs/promises'))['writeFile']>().mockResolvedValue(undefined),
  readdir: vi.fn<(typeof import('node:fs/promises'))['readdir']>(),
}));

const API_KEY = 'test-birdeye-key';

function mockRateLimiter(): RateLimiter {
  return { acquire: vi.fn<RateLimiter['acquire']>().mockResolvedValue(undefined) };
}

function birdeyeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const SAMPLE_TX_LIST_RESPONSE = {
  success: true,
  data: {
    items: [
      {
        txHash: 'sig111',
        blockTime: 1711843200,
        from: {
          address: 'WalletA',
          amount: 1.5,
        },
        to: {
          address: 'TokenMint1',
          amount: 100,
        },
        side: 'buy',
        tokenAddress: 'TokenMint1',
      },
      {
        txHash: 'sig222',
        blockTime: 1711846800,
        from: {
          address: 'WalletA',
          amount: 200,
        },
        to: {
          address: 'TokenMint2',
          amount: 3.0,
        },
        side: 'sell',
        tokenAddress: 'TokenMint2',
      },
    ],
  },
};

describe('collectWalletTrades', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('正确解析交易列表并返回标准化格式', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(birdeyeResponse(SAMPLE_TX_LIST_RESPONSE));
    const limiter = mockRateLimiter();

    const result = await collectWalletTrades(API_KEY, 'WalletA', limiter);

    expect(result).not.toBeNull();
    expect(result!.trades).toHaveLength(2);
    expect(result!.trades[0]).toEqual({
      address: 'WalletA',
      signature: 'sig111',
      tokenMint: 'TokenMint1',
      type: 'buy',
      timestamp: 1711843200,
      amount: 1.5,
    });
    expect(result!.trades[1]).toEqual({
      address: 'WalletA',
      signature: 'sig222',
      tokenMint: 'TokenMint2',
      type: 'sell',
      timestamp: 1711846800,
      amount: 3.0,
    });
    expect(result!.address).toBe('WalletA');
    expect(result!.collectedAt).toBeTruthy();
    expect(limiter.acquire).toHaveBeenCalledOnce();
  });

  it('API 返回空交易列表时返回空数组', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      birdeyeResponse({ success: true, data: { items: [] } }),
    );
    const limiter = mockRateLimiter();

    const result = await collectWalletTrades(API_KEY, 'WalletB', limiter);

    expect(result).not.toBeNull();
    expect(result!.trades).toEqual([]);
    expect(result!.address).toBe('WalletB');
  });

  it('API 返回无 items 字段时返回空数组', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      birdeyeResponse({ success: true, data: {} }),
    );
    const limiter = mockRateLimiter();

    const result = await collectWalletTrades(API_KEY, 'WalletC', limiter);

    expect(result).not.toBeNull();
    expect(result!.trades).toEqual([]);
  });

  it('API 429 限流时抛出限流错误', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Rate limited', { status: 429 }),
    );
    const limiter = mockRateLimiter();

    await expect(
      collectWalletTrades(API_KEY, 'WalletA', limiter),
    ).rejects.toThrow('rate limit');
  });

  it('API 401 认证失败时抛出认证错误', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );
    const limiter = mockRateLimiter();

    await expect(
      collectWalletTrades(API_KEY, 'WalletA', limiter),
    ).rejects.toThrow('authentication failed');
  });

  it('API 403 认证失败时抛出认证错误', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );
    const limiter = mockRateLimiter();

    await expect(
      collectWalletTrades(API_KEY, 'WalletA', limiter),
    ).rejects.toThrow('authentication failed');
  });

  it('网络超时时返回 null', async () => {
    const timeoutError = new DOMException('The operation was aborted', 'AbortError');
    vi.mocked(fetch).mockRejectedValueOnce(timeoutError);
    const limiter = mockRateLimiter();

    const result = await collectWalletTrades(API_KEY, 'WalletA', limiter);

    expect(result).toBeNull();
  });

  it('网络错误时返回 null', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));
    const limiter = mockRateLimiter();

    const result = await collectWalletTrades(API_KEY, 'WalletA', limiter);

    expect(result).toBeNull();
  });

  it('应调用 rate limiter 的 acquire', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      birdeyeResponse({ success: true, data: { items: [] } }),
    );
    const limiter = mockRateLimiter();

    await collectWalletTrades(API_KEY, 'WalletA', limiter);

    expect(limiter.acquire).toHaveBeenCalledOnce();
  });
});

describe('collectAllWallets', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(readdir).mockResolvedValue([] as unknown as Awaited<ReturnType<typeof readdir>>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('批量采集多个钱包并持久化结果', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(birdeyeResponse(SAMPLE_TX_LIST_RESPONSE))
      .mockResolvedValueOnce(
        birdeyeResponse({ success: true, data: { items: [] } }),
      );

    const limiter = mockRateLimiter();
    const progress = await collectAllWallets(API_KEY, ['WalletA', 'WalletB'], {
      outputDir: '/tmp/backtest-output',
      rateLimiter: limiter,
    });

    expect(progress.totalWallets).toBe(2);
    expect(progress.completed).toBe(2);
    expect(progress.failed).toBe(0);
    expect(progress.skipped).toBe(0);
    expect(mkdir).toHaveBeenCalledWith('/tmp/backtest-output', { recursive: true });
    expect(writeFile).toHaveBeenCalledTimes(2);
  });

  it('已有持久化文件的钱包被跳过（断点续跑）', async () => {
    // 模拟已有 WalletA.json
    vi.mocked(readdir).mockResolvedValueOnce(
      ['WalletA.json'] as unknown as Awaited<ReturnType<typeof readdir>>,
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      birdeyeResponse({ success: true, data: { items: [] } }),
    );

    const limiter = mockRateLimiter();
    const progress = await collectAllWallets(API_KEY, ['WalletA', 'WalletB'], {
      outputDir: '/tmp/backtest-output',
      rateLimiter: limiter,
    });

    expect(progress.skipped).toBe(1);
    expect(progress.completed).toBe(1);
    // fetch 只调用了一次（WalletB），WalletA 被跳过
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('采集失败的钱包计入 failed 且不中断整体流程', async () => {
    // WalletA 网络超时，WalletB 正常
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce(
        birdeyeResponse({ success: true, data: { items: [] } }),
      );

    const limiter = mockRateLimiter();
    const progress = await collectAllWallets(API_KEY, ['WalletA', 'WalletB'], {
      outputDir: '/tmp/backtest-output',
      rateLimiter: limiter,
    });

    expect(progress.failed).toBe(1);
    expect(progress.completed).toBe(1);
    expect(progress.totalWallets).toBe(2);
  });

  it('触发 onProgress 回调', async () => {
    vi.mocked(fetch).mockResolvedValue(
      birdeyeResponse({ success: true, data: { items: [] } }),
    );

    const limiter = mockRateLimiter();
    const onProgress = vi.fn();
    await collectAllWallets(API_KEY, ['WalletA', 'WalletB'], {
      outputDir: '/tmp/backtest-output',
      rateLimiter: limiter,
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledTimes(2);
  });

  it('API 认证错误时终止整体采集', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    const limiter = mockRateLimiter();

    await expect(
      collectAllWallets(API_KEY, ['WalletA', 'WalletB'], {
        outputDir: '/tmp/backtest-output',
        rateLimiter: limiter,
      }),
    ).rejects.toThrow('authentication failed');
  });

  it('API 限流错误时终止整体采集', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Rate limited', { status: 429 }),
    );

    const limiter = mockRateLimiter();

    await expect(
      collectAllWallets(API_KEY, ['WalletA', 'WalletB'], {
        outputDir: '/tmp/backtest-output',
        rateLimiter: limiter,
      }),
    ).rejects.toThrow('rate limit');
  });
});

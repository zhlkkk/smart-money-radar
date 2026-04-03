import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { collectWalletTrades, collectAllWallets } from '../../../src/scripts/backtest/collect.js';
import type { RateLimiter } from '../../../src/discovery/rate-limiter.js';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn<(typeof import('node:fs/promises'))['mkdir']>().mockResolvedValue(undefined),
  readFile: vi.fn<(typeof import('node:fs/promises'))['readFile']>(),
  writeFile: vi.fn<(typeof import('node:fs/promises'))['writeFile']>().mockResolvedValue(undefined),
  readdir: vi.fn<(typeof import('node:fs/promises'))['readdir']>(),
}));

const API_KEY = 'test-helius-key';

function mockRateLimiter(): RateLimiter {
  return { acquire: vi.fn<RateLimiter['acquire']>().mockResolvedValue(undefined) };
}

function heliusResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Helius Enhanced Transaction format for SWAP trades */
const SAMPLE_HELIUS_RESPONSE = [
  {
    signature: 'sig111',
    timestamp: 1711843200,
    type: 'SWAP',
    tokenTransfers: [
      {
        mint: 'TokenMint1',
        tokenAmount: 100,
        fromUserAccount: 'SomePool',
        toUserAccount: 'WalletA',
      },
    ],
    nativeTransfers: [],
  },
  {
    signature: 'sig222',
    timestamp: 1711846800,
    type: 'SWAP',
    tokenTransfers: [
      {
        mint: 'TokenMint2',
        tokenAmount: 200,
        fromUserAccount: 'WalletA',
        toUserAccount: 'SomePool',
      },
    ],
    nativeTransfers: [],
  },
];

describe('collectWalletTrades', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly parses Helius SWAP transactions into buy/sell trades', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(heliusResponse(SAMPLE_HELIUS_RESPONSE));
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
      amount: 100,
    });
    expect(result!.trades[1]).toEqual({
      address: 'WalletA',
      signature: 'sig222',
      tokenMint: 'TokenMint2',
      type: 'sell',
      timestamp: 1711846800,
      amount: 200,
    });
    expect(result!.address).toBe('WalletA');
    expect(result!.collectedAt).toBeTruthy();
    expect(limiter.acquire).toHaveBeenCalledOnce();
  });

  it('API returns empty array -> empty trades', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(heliusResponse([]));
    const limiter = mockRateLimiter();

    const result = await collectWalletTrades(API_KEY, 'WalletB', limiter);

    expect(result).not.toBeNull();
    expect(result!.trades).toEqual([]);
    expect(result!.address).toBe('WalletB');
  });

  it('Birdeye fallback: requests tx_type=swap and limit=50 in URL', async () => {
    const birdeyeItems = [
      { txHash: 'bsig1', blockTime: 1711843200, side: 'buy', tokenAddress: 'TokenA', from: { amount: 50 } },
    ];
    // Helius returns empty, triggering Birdeye fallback
    vi.mocked(fetch)
      .mockResolvedValueOnce(heliusResponse([]))
      .mockResolvedValueOnce(heliusResponse({ success: true, data: { items: birdeyeItems } }));
    const limiter = mockRateLimiter();

    const result = await collectWalletTrades(API_KEY, 'WalletC', limiter, 'birdeye-test-key');

    expect(result).not.toBeNull();
    expect(result!.trades).toHaveLength(1);

    // Assert Birdeye fallback URL contains required filter params
    const birdeyeCallUrl = vi.mocked(fetch).mock.calls[1][0] as string;
    expect(birdeyeCallUrl).toContain('tx_type=swap');
    expect(birdeyeCallUrl).toContain('limit=50');
  });

  it('Birdeye fallback: side=null defaults to buy with stderr warning', async () => {
    const birdeyeItems = [
      // No side field — should default to 'buy' and emit a warning
      { txHash: 'bsig2', blockTime: 1711843200, tokenAddress: 'TokenB', from: { amount: 30 } },
    ];
    vi.mocked(fetch)
      .mockResolvedValueOnce(heliusResponse([]))
      .mockResolvedValueOnce(heliusResponse({ success: true, data: { items: birdeyeItems } }));
    const limiter = mockRateLimiter();
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await collectWalletTrades(API_KEY, 'WalletD', limiter, 'birdeye-test-key');

    expect(result).not.toBeNull();
    expect(result!.trades[0].type).toBe('buy');
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("missing 'side' field"));
    stderrSpy.mockRestore();
  });

  it('Birdeye fallback: 401 auth error throws authentication failed', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(heliusResponse([]))
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    const limiter = mockRateLimiter();

    await expect(collectWalletTrades(API_KEY, 'WalletE', limiter, 'birdeye-test-key')).rejects.toThrow(
      'authentication failed',
    );
  });

  it('Birdeye fallback: 429 rate limit throws', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(heliusResponse([]))
      .mockResolvedValueOnce(new Response('Rate limited', { status: 429 }));
    const limiter = mockRateLimiter();

    await expect(collectWalletTrades(API_KEY, 'WalletF', limiter, 'birdeye-test-key')).rejects.toThrow(
      'rate limit',
    );
  });

  it('skips non-SWAP transactions', async () => {
    const txns = [
      { signature: 'sig-transfer', timestamp: 100, type: 'TRANSFER', tokenTransfers: [{ mint: 'M1', tokenAmount: 10, toUserAccount: 'WalletA' }] },
      { signature: 'sig-unknown', timestamp: 200, type: 'UNKNOWN' },
    ];
    vi.mocked(fetch).mockResolvedValueOnce(heliusResponse(txns));
    const limiter = mockRateLimiter();

    const result = await collectWalletTrades(API_KEY, 'WalletA', limiter);

    // TRANSFER is included, UNKNOWN is skipped (no tokenTransfers)
    expect(result).not.toBeNull();
    expect(result!.trades).toHaveLength(1);
    expect(result!.trades[0].type).toBe('buy');
  });

  it('HTTP 429 rate limit throws', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Rate limited', { status: 429 }));
    const limiter = mockRateLimiter();

    await expect(collectWalletTrades(API_KEY, 'WalletA', limiter)).rejects.toThrow('rate limit');
  });

  it('HTTP 401 auth error throws', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    const limiter = mockRateLimiter();

    await expect(collectWalletTrades(API_KEY, 'WalletA', limiter)).rejects.toThrow('authentication failed');
  });

  it('HTTP 403 auth error throws', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));
    const limiter = mockRateLimiter();

    await expect(collectWalletTrades(API_KEY, 'WalletA', limiter)).rejects.toThrow('authentication failed');
  });

  it('network timeout returns null', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'));
    const limiter = mockRateLimiter();

    const result = await collectWalletTrades(API_KEY, 'WalletA', limiter);
    expect(result).toBeNull();
  });

  it('network error returns null', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));
    const limiter = mockRateLimiter();

    const result = await collectWalletTrades(API_KEY, 'WalletA', limiter);
    expect(result).toBeNull();
  });

  it('calls rate limiter acquire', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(heliusResponse([]));
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

  it('batch collects multiple wallets and persists results', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(heliusResponse(SAMPLE_HELIUS_RESPONSE))
      .mockResolvedValueOnce(heliusResponse([]));

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

  it('skips wallets with existing files (resume support)', async () => {
    vi.mocked(readdir).mockResolvedValueOnce(
      ['WalletA.json'] as unknown as Awaited<ReturnType<typeof readdir>>,
    );
    vi.mocked(fetch).mockResolvedValueOnce(heliusResponse([]));

    const limiter = mockRateLimiter();
    const progress = await collectAllWallets(API_KEY, ['WalletA', 'WalletB'], {
      outputDir: '/tmp/backtest-output',
      rateLimiter: limiter,
    });

    expect(progress.skipped).toBe(1);
    expect(progress.completed).toBe(1);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('failed wallets count as failed without stopping', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce(heliusResponse([]));

    const limiter = mockRateLimiter();
    const progress = await collectAllWallets(API_KEY, ['WalletA', 'WalletB'], {
      outputDir: '/tmp/backtest-output',
      rateLimiter: limiter,
    });

    expect(progress.failed).toBe(1);
    expect(progress.completed).toBe(1);
    expect(progress.totalWallets).toBe(2);
  });

  it('triggers onProgress callback', async () => {
    vi.mocked(fetch).mockResolvedValue(heliusResponse([]));

    const limiter = mockRateLimiter();
    const onProgress = vi.fn();
    await collectAllWallets(API_KEY, ['WalletA', 'WalletB'], {
      outputDir: '/tmp/backtest-output',
      rateLimiter: limiter,
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledTimes(2);
  });

  it('auth error stops entire collection', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    const limiter = mockRateLimiter();

    await expect(
      collectAllWallets(API_KEY, ['WalletA', 'WalletB'], {
        outputDir: '/tmp/backtest-output',
        rateLimiter: limiter,
      }),
    ).rejects.toThrow('authentication failed');
  });

  it('rate limit error stops entire collection', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Rate limited', { status: 429 }));
    const limiter = mockRateLimiter();

    await expect(
      collectAllWallets(API_KEY, ['WalletA', 'WalletB'], {
        outputDir: '/tmp/backtest-output',
        rateLimiter: limiter,
      }),
    ).rejects.toThrow('rate limit');
  });
});

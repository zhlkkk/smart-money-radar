import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchTopWallets, fetchWalletPnL, fetchHotTokensByVolume } from '../../src/discovery/birdeye.js';

const API_KEY = 'test-birdeye-key';

function birdeyeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('fetchTopWallets', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests limit=10 in the URL (Starter plan max)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      birdeyeResponse({ success: true, data: { items: [] } }),
    );

    await fetchTopWallets(API_KEY);

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('limit=10');
  });

  it('returns normalized WalletCandidate array', async () => {
    const mockBody = {
      success: true,
      data: {
        items: [
          {
            address: 'Wallet1abc',
            pnl: 50_000,
            win_rate: 0.72,
            trade_count: 150,
            last_active_timestamp: 1711843200,
          },
          {
            address: 'Wallet2def',
            realized_pnl: 30_000,
            wins: 80,
            losses: 20,
            total_trades: 100,
            last_trade_time: 1711756800,
          },
        ],
      },
    };
    vi.mocked(fetch).mockResolvedValueOnce(birdeyeResponse(mockBody));

    const result = await fetchTopWallets(API_KEY);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      address: 'Wallet1abc',
      pnl: 50_000,
      winRate: 0.72,
      tradeCount: 150,
      lastActiveTimestamp: 1711843200,
    });
    expect(result[1]).toEqual({
      address: 'Wallet2def',
      pnl: 30_000,
      winRate: 0.8,
      tradeCount: 100,
      lastActiveTimestamp: 1711756800,
    });
  });

  it('returns empty array on non-auth errors (graceful degradation)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 }),
    );

    const result = await fetchTopWallets(API_KEY);
    expect(result).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));

    const result = await fetchTopWallets(API_KEY);
    expect(result).toEqual([]);
  });

  it('returns empty array when response has no items', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      birdeyeResponse({ success: true, data: { items: [] } }),
    );

    const result = await fetchTopWallets(API_KEY);
    expect(result).toEqual([]);
  });

  it('throws descriptive error on 401 (bad API key)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    await expect(fetchTopWallets(API_KEY)).rejects.toThrow('authentication failed');
  });

  it('throws descriptive error on 403 (bad API key)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );

    await expect(fetchTopWallets(API_KEY)).rejects.toThrow('authentication failed');
  });

  it('throws descriptive error on 429 (rate limited)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Too Many Requests', { status: 429 }),
    );

    await expect(fetchTopWallets(API_KEY)).rejects.toThrow('rate limit');
  });
});

describe('fetchHotTokensByVolume', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns token mints from two offset pages', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        birdeyeResponse({
          success: true,
          data: { tokens: [{ address: 'Token1' }, { address: 'Token2' }] },
        }),
      )
      .mockResolvedValueOnce(
        birdeyeResponse({
          success: true,
          data: { tokens: [{ address: 'Token3' }, { address: 'Token4' }] },
        }),
      );

    const result = await fetchHotTokensByVolume(API_KEY);

    expect(result).toEqual(['Token1', 'Token2', 'Token3', 'Token4']);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    // Check offsets
    const url0 = vi.mocked(fetch).mock.calls[0][0] as string;
    const url1 = vi.mocked(fetch).mock.calls[1][0] as string;
    expect(url0).toContain('offset=0');
    expect(url1).toContain('offset=20');
  });

  it('deduplicates token mints across pages', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        birdeyeResponse({
          success: true,
          data: { tokens: [{ address: 'Token1' }, { address: 'Token2' }] },
        }),
      )
      .mockResolvedValueOnce(
        birdeyeResponse({
          success: true,
          data: { tokens: [{ address: 'Token2' }, { address: 'Token3' }] },
        }),
      );

    const result = await fetchHotTokensByVolume(API_KEY);
    expect(result).toEqual(['Token1', 'Token2', 'Token3']);
  });

  it('returns fallback tokens on network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network failure'));

    const result = await fetchHotTokensByVolume(API_KEY);

    // Should be fallback tokens (12 items)
    expect(result.length).toBeGreaterThanOrEqual(10);
    expect(result).toContain('So11111111111111111111111111111111111111112');
  });

  it('returns fallback tokens when both pages return empty', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(birdeyeResponse({ success: true, data: { tokens: [] } }))
      .mockResolvedValueOnce(birdeyeResponse({ success: true, data: { tokens: [] } }));

    const result = await fetchHotTokensByVolume(API_KEY);
    expect(result.length).toBeGreaterThanOrEqual(10);
  });

  it('throws on 401 (auth error)', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Unauthorized', { status: 401 }));

    await expect(fetchHotTokensByVolume(API_KEY)).rejects.toThrow('authentication failed');
  });

  it('throws on 429 (rate limit)', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Too Many Requests', { status: 429 }));

    await expect(fetchHotTokensByVolume(API_KEY)).rejects.toThrow('rate limit');
  });

  it('uses partial results when one page fails with non-auth error', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        birdeyeResponse({
          success: true,
          data: { tokens: [{ address: 'Token1' }] },
        }),
      )
      .mockResolvedValueOnce(new Response('Server Error', { status: 500 }));

    const result = await fetchHotTokensByVolume(API_KEY);
    expect(result).toEqual(['Token1']);
  });

  it('filters out items with missing address', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        birdeyeResponse({
          success: true,
          data: { tokens: [{ address: 'Token1' }, { address: '' }, {}] },
        }),
      )
      .mockResolvedValueOnce(birdeyeResponse({ success: true, data: { tokens: [] } }));

    const result = await fetchHotTokensByVolume(API_KEY);
    expect(result).toEqual(['Token1']);
  });
});

describe('fetchWalletPnL', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns data for valid wallet', async () => {
    const mockBody = {
      success: true,
      data: {
        wallet: 'WalletAddr123',
        pnl: 120_000,
        win_rate: 0.65,
        trade_count: 200,
        last_active_timestamp: 1711843200,
      },
    };
    vi.mocked(fetch).mockResolvedValueOnce(birdeyeResponse(mockBody));

    const result = await fetchWalletPnL(API_KEY, 'WalletAddr123');

    expect(result).toEqual({
      address: 'WalletAddr123',
      pnl: 120_000,
      winRate: 0.65,
      tradeCount: 200,
      lastActiveTimestamp: 1711843200,
    });
  });

  it('returns null on failure (non-auth error)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Server Error', { status: 500 }),
    );

    const result = await fetchWalletPnL(API_KEY, 'WalletAddr123');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection refused'));

    const result = await fetchWalletPnL(API_KEY, 'WalletAddr123');
    expect(result).toBeNull();
  });

  it('throws descriptive error on 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    await expect(fetchWalletPnL(API_KEY, 'WalletAddr123')).rejects.toThrow('authentication failed');
  });

  it('throws descriptive error on 403', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );

    await expect(fetchWalletPnL(API_KEY, 'WalletAddr123')).rejects.toThrow('authentication failed');
  });

  it('throws descriptive error on 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Too Many Requests', { status: 429 }),
    );

    await expect(fetchWalletPnL(API_KEY, 'WalletAddr123')).rejects.toThrow('rate limit');
  });
});

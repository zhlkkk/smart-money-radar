import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchTopWallets, fetchWalletPnL } from '../../src/discovery/birdeye.js';

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

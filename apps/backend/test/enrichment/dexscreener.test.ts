import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchDexScreenerData } from '../../src/enrichment/dexscreener.js';

describe('fetchDexScreenerData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts data from the highest-liquidity pair', async () => {
    const mockResponse = [
      { liquidity: { usd: 500_000 }, fdv: 10_000_000, marketCap: 5_000_000 },
      { liquidity: { usd: 1_200_000 }, fdv: 12_000_000, marketCap: 6_000_000 },
    ];
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
    const result = await fetchDexScreenerData('TokenMint123');
    expect(result.liquidity).toBe(1_200_000);
    expect(result.fdv).toBe(12_000_000);
    expect(result.marketCap).toBe(6_000_000);
  });

  it('returns nulls when fdv/marketCap are missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([{ liquidity: { usd: 100_000 } }]), { status: 200 }),
    );
    const result = await fetchDexScreenerData('TokenMint123');
    expect(result.liquidity).toBe(100_000);
    expect(result.fdv).toBeNull();
    expect(result.marketCap).toBeNull();
  });

  it('returns all nulls on empty response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    const result = await fetchDexScreenerData('TokenMint123');
    expect(result).toEqual({ tokenSymbol: null, liquidity: null, fdv: null, marketCap: null, volume24h: null, txns24h: null, pairCreatedAt: null });
  });

  it('returns all nulls on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
    const result = await fetchDexScreenerData('TokenMint123');
    expect(result).toEqual({ tokenSymbol: null, liquidity: null, fdv: null, marketCap: null, volume24h: null, txns24h: null, pairCreatedAt: null });
  });

  it('returns all nulls on non-200 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('rate limited', { status: 429 }),
    );
    const result = await fetchDexScreenerData('TokenMint123');
    expect(result).toEqual({ tokenSymbol: null, liquidity: null, fdv: null, marketCap: null, volume24h: null, txns24h: null, pairCreatedAt: null });
  });

  it('extracts volume, txns, and pairCreatedAt from best pair', async () => {
    const mockResponse = [
      {
        liquidity: { usd: 500_000 },
        fdv: 10_000_000,
        marketCap: 5_000_000,
        volume: { h24: 120_000 },
        txns: { h24: { buys: 300, sells: 250 } },
        pairCreatedAt: 1711900800000,
      },
    ];
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
    const result = await fetchDexScreenerData('TokenMint123');
    expect(result.volume24h).toBe(120_000);
    expect(result.txns24h).toEqual({ buys: 300, sells: 250 });
    expect(result.pairCreatedAt).toBe(1711900800000);
  });

  it('returns null for missing volume/txns/pairCreatedAt', async () => {
    const mockResponse = [{ liquidity: { usd: 100_000 } }];
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
    const result = await fetchDexScreenerData('TokenMint123');
    expect(result.volume24h).toBeNull();
    expect(result.txns24h).toBeNull();
    expect(result.pairCreatedAt).toBeNull();
  });
});

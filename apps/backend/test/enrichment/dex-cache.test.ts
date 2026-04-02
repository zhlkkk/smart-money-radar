import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DexCache } from '../../src/enrichment/dex-cache.js';
import type { DexScreenerData } from '../../src/types.js';

function makeDexData(overrides: Partial<DexScreenerData> = {}): DexScreenerData {
  return {
    tokenSymbol: 'TEST',
    liquidity: 100_000,
    fdv: 1_000_000,
    marketCap: 500_000,
    volume24h: 50_000,
    txns24h: { buys: 100, sells: 80 },
    pairCreatedAt: 1711900800000,
    priceUsd: 0.01,
    ...overrides,
  };
}

describe('DexCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null on first get (cache miss)', () => {
    const cache = new DexCache();
    expect(cache.get('mint1')).toBeNull();
  });

  it('returns cached data after set', () => {
    const cache = new DexCache();
    const data = makeDexData();
    cache.set('mint1', data);
    expect(cache.get('mint1')).toEqual(data);
  });

  it('returns null after TTL expires', () => {
    const cache = new DexCache({ ttlMs: 1000 });
    cache.set('mint1', makeDexData());

    vi.advanceTimersByTime(1001);
    expect(cache.get('mint1')).toBeNull();
  });

  it('returns stale data via getStale after TTL expires', () => {
    const cache = new DexCache({ ttlMs: 1000 });
    const data = makeDexData();
    cache.set('mint1', data);

    vi.advanceTimersByTime(5000);
    expect(cache.get('mint1')).toBeNull();
    expect(cache.getStale('mint1')).toEqual(data);
  });

  it('getStale returns null for non-existent key', () => {
    const cache = new DexCache();
    expect(cache.getStale('nonexistent')).toBeNull();
  });

  it('evicts oldest entry when maxSize is exceeded', () => {
    const cache = new DexCache({ maxSize: 2 });
    cache.set('mint1', makeDexData({ tokenSymbol: 'A' }));
    cache.set('mint2', makeDexData({ tokenSymbol: 'B' }));
    cache.set('mint3', makeDexData({ tokenSymbol: 'C' }));

    expect(cache.get('mint1')).toBeNull();
    expect(cache.get('mint2')?.tokenSymbol).toBe('B');
    expect(cache.get('mint3')?.tokenSymbol).toBe('C');
    expect(cache.size).toBe(2);
  });

  it('updates timestamp and data on duplicate set', () => {
    const cache = new DexCache({ ttlMs: 1000 });
    cache.set('mint1', makeDexData({ tokenSymbol: 'OLD' }));

    vi.advanceTimersByTime(800);
    cache.set('mint1', makeDexData({ tokenSymbol: 'NEW' }));

    vi.advanceTimersByTime(800);
    // Would be expired if timestamp wasn't updated, but it should still be fresh
    const result = cache.get('mint1');
    expect(result).not.toBeNull();
    expect(result?.tokenSymbol).toBe('NEW');
  });

  it('reports correct size', () => {
    const cache = new DexCache();
    expect(cache.size).toBe(0);
    cache.set('a', makeDexData());
    cache.set('b', makeDexData());
    expect(cache.size).toBe(2);
  });
});

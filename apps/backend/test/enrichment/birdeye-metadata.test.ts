import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchBirdeyeMetadata, resetBirdeyeMetaCache } from '../../src/enrichment/birdeye-metadata.js';

describe('fetchBirdeyeMetadata', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    resetBirdeyeMetaCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns symbol and name from Birdeye API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({
        success: true,
        data: { symbol: 'BONK', name: 'Bonk' },
      })),
    );

    const result = await fetchBirdeyeMetadata('mint123', 'test-key');

    expect(result).toEqual({ symbol: 'BONK', name: 'Bonk' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('caches result — second call does not trigger HTTP', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({
        success: true,
        data: { symbol: 'BONK', name: 'Bonk' },
      })),
    );

    await fetchBirdeyeMetadata('mint123', 'test-key');
    const result = await fetchBirdeyeMetadata('mint123', 'test-key');

    expect(result).toEqual({ symbol: 'BONK', name: 'Bonk' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('returns null when API returns no symbol', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: {} })),
    );

    const result = await fetchBirdeyeMetadata('mint123', 'test-key');

    expect(result).toEqual({ symbol: null, name: null });
  });

  it('returns null on HTTP 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    const result = await fetchBirdeyeMetadata('mint123', 'test-key');

    expect(result).toBeNull();
  });

  it('returns null on network timeout', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(
      new DOMException('The operation was aborted', 'AbortError'),
    );

    const result = await fetchBirdeyeMetadata('mint123', 'test-key');

    expect(result).toBeNull();
  });

  it('returns null when apiKey is undefined', async () => {
    const result = await fetchBirdeyeMetadata('mint123', undefined);

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns null when success is false', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false })),
    );

    const result = await fetchBirdeyeMetadata('mint123', 'test-key');

    expect(result).toBeNull();
  });
});

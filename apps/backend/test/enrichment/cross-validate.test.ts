import { describe, it, expect, vi, beforeEach } from 'vitest';
import { crossValidatePrice } from '../../src/enrichment/cross-validate.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

function raydiumResponse(price: number) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        success: true,
        data: {
          data: [
            {
              price,
              mintA: { address: 'So11111111111111111111111111111111' },
              mintB: { address: 'TokenMintXyz' },
            },
          ],
        },
      }),
  };
}

describe('crossValidatePrice', () => {
  it('returns onChainPrice when Raydium API returns valid price', async () => {
    mockFetch.mockResolvedValueOnce(raydiumResponse(0.0025));

    const result = await crossValidatePrice('TokenMintXyz');
    expect(result.onChainPrice).toBe(0.0025);
  });

  it('calculates deviation when dexPrice is provided', async () => {
    mockFetch.mockResolvedValueOnce(raydiumResponse(0.0025));

    const result = await crossValidatePrice('TokenMintXyz', 0.0026);
    expect(result.onChainPrice).toBe(0.0025);
    // deviation = |0.0026 - 0.0025| / 0.0025 * 100 = 4%
    expect(result.priceDeviation).toBeCloseTo(4, 1);
  });

  it('returns small deviation for close prices', async () => {
    mockFetch.mockResolvedValueOnce(raydiumResponse(1.0));

    const result = await crossValidatePrice('TokenMintXyz', 1.02);
    expect(result.priceDeviation).toBeCloseTo(2, 1);
  });

  it('returns large deviation for divergent prices', async () => {
    mockFetch.mockResolvedValueOnce(raydiumResponse(1.0));

    const result = await crossValidatePrice('TokenMintXyz', 1.5);
    // deviation = |1.5 - 1.0| / 1.0 * 100 = 50%
    expect(result.priceDeviation).toBeCloseTo(50, 1);
  });

  it('returns null deviation when dexPrice is null', async () => {
    mockFetch.mockResolvedValueOnce(raydiumResponse(0.0025));

    const result = await crossValidatePrice('TokenMintXyz', null);
    expect(result.onChainPrice).toBe(0.0025);
    expect(result.priceDeviation).toBeNull();
  });

  it('returns null deviation when dexPrice is not provided', async () => {
    mockFetch.mockResolvedValueOnce(raydiumResponse(0.0025));

    const result = await crossValidatePrice('TokenMintXyz');
    expect(result.onChainPrice).toBe(0.0025);
    expect(result.priceDeviation).toBeNull();
  });

  it('returns empty result when no Raydium pool found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { data: [] },
        }),
    });

    const result = await crossValidatePrice('UnknownMint');
    expect(result.onChainPrice).toBeNull();
    expect(result.priceDeviation).toBeNull();
  });

  it('returns empty result when pool price is 0', async () => {
    mockFetch.mockResolvedValueOnce(raydiumResponse(0));

    const result = await crossValidatePrice('TokenMintXyz', 0.5);
    expect(result.onChainPrice).toBeNull();
    expect(result.priceDeviation).toBeNull();
  });

  it('returns empty result on Raydium API timeout', async () => {
    mockFetch.mockRejectedValueOnce(new Error('AbortError'));

    const result = await crossValidatePrice('TokenMintXyz', 0.5);
    expect(result.onChainPrice).toBeNull();
    expect(result.priceDeviation).toBeNull();
  });

  it('returns empty result on Raydium API non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await crossValidatePrice('TokenMintXyz', 0.5);
    expect(result.onChainPrice).toBeNull();
    expect(result.priceDeviation).toBeNull();
  });

  it('returns empty result on malformed Raydium response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ unexpected: 'format' }),
    });

    const result = await crossValidatePrice('TokenMintXyz', 0.5);
    expect(result.onChainPrice).toBeNull();
    expect(result.priceDeviation).toBeNull();
  });

  it('returns empty result when success is false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: false }),
    });

    const result = await crossValidatePrice('TokenMintXyz', 0.5);
    expect(result.onChainPrice).toBeNull();
    expect(result.priceDeviation).toBeNull();
  });
});

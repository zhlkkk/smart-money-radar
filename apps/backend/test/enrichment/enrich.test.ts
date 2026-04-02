import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/enrichment/dexscreener.js', () => ({
  fetchDexScreenerData: vi.fn(),
}));
vi.mock('../../src/enrichment/authority-check.js', () => ({
  checkAuthorities: vi.fn(),
}));
vi.mock('../../src/enrichment/cross-validate.js', () => ({
  crossValidatePrice: vi.fn(),
}));

import { enrichToken } from '../../src/enrichment/enrich.js';
import { fetchDexScreenerData } from '../../src/enrichment/dexscreener.js';
import { checkAuthorities } from '../../src/enrichment/authority-check.js';
import { crossValidatePrice } from '../../src/enrichment/cross-validate.js';

const mockRpc = {} as unknown;

describe('enrichToken', () => {
  it('returns full data when all three succeed', async () => {
    vi.mocked(fetchDexScreenerData).mockResolvedValueOnce({ liquidity: 1_000_000, fdv: 10_000_000, marketCap: 5_000_000, priceUsd: 0.5 });
    vi.mocked(checkAuthorities).mockResolvedValueOnce({ mintAuthority: null, freezeAuthority: null });
    vi.mocked(crossValidatePrice).mockResolvedValueOnce({ onChainPrice: 0.5, priceDeviation: null });
    const result = await enrichToken('Mint', mockRpc);
    expect(result.liquidity).toBe(1_000_000);
    expect(result.mintAuthority).toBeNull();
    // 偏差 = |0.5 - 0.5| / 0.5 * 100 = 0%
    expect(result.priceDeviation).toBe(0);
  });

  it('calculates priceDeviation when dex and chain prices differ', async () => {
    vi.mocked(fetchDexScreenerData).mockResolvedValueOnce({ liquidity: 1_000_000, fdv: 10_000_000, marketCap: 5_000_000, priceUsd: 1.05 });
    vi.mocked(checkAuthorities).mockResolvedValueOnce({ mintAuthority: null, freezeAuthority: null });
    vi.mocked(crossValidatePrice).mockResolvedValueOnce({ onChainPrice: 1.0, priceDeviation: null });
    const result = await enrichToken('Mint', mockRpc);
    // deviation = |1.05 - 1.0| / 1.0 * 100 = 5%
    expect(result.priceDeviation).toBeCloseTo(5, 1);
  });

  it('returns undefined priceDeviation when cross-validate has no onChainPrice', async () => {
    vi.mocked(fetchDexScreenerData).mockResolvedValueOnce({ liquidity: 1_000_000, fdv: 10_000_000, marketCap: 5_000_000, priceUsd: 0.5 });
    vi.mocked(checkAuthorities).mockResolvedValueOnce({ mintAuthority: null, freezeAuthority: null });
    vi.mocked(crossValidatePrice).mockResolvedValueOnce({ onChainPrice: null, priceDeviation: null });
    const result = await enrichToken('Mint', mockRpc);
    expect(result.priceDeviation).toBeUndefined();
  });

  it('returns undefined priceDeviation when dex has no priceUsd', async () => {
    vi.mocked(fetchDexScreenerData).mockResolvedValueOnce({ liquidity: 1_000_000, fdv: 10_000_000, marketCap: 5_000_000, priceUsd: null });
    vi.mocked(checkAuthorities).mockResolvedValueOnce({ mintAuthority: null, freezeAuthority: null });
    vi.mocked(crossValidatePrice).mockResolvedValueOnce({ onChainPrice: 0.5, priceDeviation: null });
    const result = await enrichToken('Mint', mockRpc);
    expect(result.priceDeviation).toBeUndefined();
  });

  it('degrades DexScreener gracefully', async () => {
    vi.mocked(fetchDexScreenerData).mockRejectedValueOnce(new Error('timeout'));
    vi.mocked(checkAuthorities).mockResolvedValueOnce({ mintAuthority: null, freezeAuthority: null });
    vi.mocked(crossValidatePrice).mockResolvedValueOnce({ onChainPrice: 0.5, priceDeviation: null });
    const result = await enrichToken('Mint', mockRpc);
    expect(result.liquidity).toBeNull();
    expect(result.mintAuthority).toBeNull();
    expect(result.priceDeviation).toBeUndefined();
  });

  it('degrades authority check gracefully', async () => {
    vi.mocked(fetchDexScreenerData).mockResolvedValueOnce({ liquidity: 500_000, fdv: 2_000_000, marketCap: 1_000_000, priceUsd: 0.1 });
    vi.mocked(checkAuthorities).mockRejectedValueOnce(new Error('timeout'));
    vi.mocked(crossValidatePrice).mockResolvedValueOnce({ onChainPrice: 0.1, priceDeviation: null });
    const result = await enrichToken('Mint', mockRpc);
    expect(result.liquidity).toBe(500_000);
    expect(result.mintAuthority).toBe('unchecked');
    expect(result.priceDeviation).toBe(0);
  });

  it('degrades cross-validate gracefully', async () => {
    vi.mocked(fetchDexScreenerData).mockResolvedValueOnce({ liquidity: 500_000, fdv: 2_000_000, marketCap: 1_000_000, priceUsd: 0.1 });
    vi.mocked(checkAuthorities).mockResolvedValueOnce({ mintAuthority: null, freezeAuthority: null });
    vi.mocked(crossValidatePrice).mockRejectedValueOnce(new Error('timeout'));
    const result = await enrichToken('Mint', mockRpc);
    expect(result.liquidity).toBe(500_000);
    expect(result.mintAuthority).toBeNull();
    expect(result.priceDeviation).toBeUndefined();
  });

  it('degrades all three gracefully', async () => {
    vi.mocked(fetchDexScreenerData).mockRejectedValueOnce(new Error('fail'));
    vi.mocked(checkAuthorities).mockRejectedValueOnce(new Error('fail'));
    vi.mocked(crossValidatePrice).mockRejectedValueOnce(new Error('fail'));
    const result = await enrichToken('Mint', mockRpc);
    expect(result.liquidity).toBeNull();
    expect(result.mintAuthority).toBe('unchecked');
    expect(result.priceDeviation).toBeUndefined();
  });
});

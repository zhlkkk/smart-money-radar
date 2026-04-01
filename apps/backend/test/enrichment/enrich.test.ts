import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/enrichment/dexscreener.js', () => ({
  fetchDexScreenerData: vi.fn(),
}));
vi.mock('../../src/enrichment/authority-check.js', () => ({
  checkAuthorities: vi.fn(),
}));

import { enrichToken } from '../../src/enrichment/enrich.js';
import { fetchDexScreenerData } from '../../src/enrichment/dexscreener.js';
import { checkAuthorities } from '../../src/enrichment/authority-check.js';

const mockRpc = {} as any;

describe('enrichToken', () => {
  it('returns full data when both succeed', async () => {
    vi.mocked(fetchDexScreenerData).mockResolvedValueOnce({ liquidity: 1_000_000, fdv: 10_000_000, marketCap: 5_000_000 });
    vi.mocked(checkAuthorities).mockResolvedValueOnce({ mintAuthority: null, freezeAuthority: null });
    const result = await enrichToken('Mint', mockRpc);
    expect(result.liquidity).toBe(1_000_000);
    expect(result.mintAuthority).toBeNull();
  });

  it('degrades DexScreener gracefully', async () => {
    vi.mocked(fetchDexScreenerData).mockRejectedValueOnce(new Error('timeout'));
    vi.mocked(checkAuthorities).mockResolvedValueOnce({ mintAuthority: null, freezeAuthority: null });
    const result = await enrichToken('Mint', mockRpc);
    expect(result.liquidity).toBeNull();
    expect(result.mintAuthority).toBeNull();
  });

  it('degrades authority check gracefully', async () => {
    vi.mocked(fetchDexScreenerData).mockResolvedValueOnce({ liquidity: 500_000, fdv: 2_000_000, marketCap: 1_000_000 });
    vi.mocked(checkAuthorities).mockRejectedValueOnce(new Error('timeout'));
    const result = await enrichToken('Mint', mockRpc);
    expect(result.liquidity).toBe(500_000);
    expect(result.mintAuthority).toBe('unchecked');
  });

  it('degrades both gracefully', async () => {
    vi.mocked(fetchDexScreenerData).mockRejectedValueOnce(new Error('fail'));
    vi.mocked(checkAuthorities).mockRejectedValueOnce(new Error('fail'));
    const result = await enrichToken('Mint', mockRpc);
    expect(result.liquidity).toBeNull();
    expect(result.mintAuthority).toBe('unchecked');
  });
});

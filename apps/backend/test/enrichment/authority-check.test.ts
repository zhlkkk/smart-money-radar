import { describe, it, expect, vi } from 'vitest';

vi.mock('@solana-program/token', () => ({
  fetchMint: vi.fn(),
}));

vi.mock('@solana-program/token-2022', () => ({
  fetchMint: vi.fn(),
}));

vi.mock('@solana/kit', () => ({
  address: (addr: string) => addr,
  unwrapOption: (opt: { __option: string; value?: string }) => {
    if (opt.__option === 'None') return null;
    return opt.value ?? null;
  },
}));

import { checkAuthorities } from '../../src/enrichment/authority-check.js';
import { fetchMint } from '@solana-program/token';
import { fetchMint as fetchMint2022 } from '@solana-program/token-2022';

const mockRpc = {} as any;

describe('checkAuthorities', () => {
  it('returns null for both when revoked (SPL Token)', async () => {
    vi.mocked(fetchMint).mockResolvedValueOnce({
      data: {
        mintAuthority: { __option: 'None' },
        freezeAuthority: { __option: 'None' },
      },
    } as any);
    const result = await checkAuthorities(mockRpc, 'SomeMint');
    expect(result.mintAuthority).toBeNull();
    expect(result.freezeAuthority).toBeNull();
  });

  it('returns addresses when authorities are active', async () => {
    vi.mocked(fetchMint).mockResolvedValueOnce({
      data: {
        mintAuthority: { __option: 'Some', value: 'MintAuth111' },
        freezeAuthority: { __option: 'Some', value: 'FreezeAuth222' },
      },
    } as any);
    const result = await checkAuthorities(mockRpc, 'SomeMint');
    expect(result.mintAuthority).toBe('MintAuth111');
    expect(result.freezeAuthority).toBe('FreezeAuth222');
  });

  it('falls back to Token-2022 when SPL Token fails', async () => {
    vi.mocked(fetchMint).mockRejectedValueOnce(new Error('wrong program'));
    vi.mocked(fetchMint2022).mockResolvedValueOnce({
      data: {
        mintAuthority: { __option: 'None' },
        freezeAuthority: { __option: 'Some', value: 'Freeze333' },
      },
    } as any);
    const result = await checkAuthorities(mockRpc, 'SomeMint');
    expect(result.mintAuthority).toBeNull();
    expect(result.freezeAuthority).toBe('Freeze333');
  });

  it('returns unchecked when both programs fail', async () => {
    vi.mocked(fetchMint).mockRejectedValueOnce(new Error('fail'));
    vi.mocked(fetchMint2022).mockRejectedValueOnce(new Error('fail'));
    const result = await checkAuthorities(mockRpc, 'SomeMint');
    expect(result.mintAuthority).toBe('unchecked');
    expect(result.freezeAuthority).toBe('unchecked');
  });
});

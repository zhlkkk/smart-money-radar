import { address, unwrapOption } from '@solana/kit';
import { fetchMint } from '@solana-program/token';
import { fetchMint as fetchMint2022 } from '@solana-program/token-2022';
import type { AuthorityData } from '../types.js';

const UNCHECKED: AuthorityData = { mintAuthority: 'unchecked', freezeAuthority: 'unchecked' };

export async function checkAuthorities(
  rpc: unknown,
  mintAddr: string,
): Promise<AuthorityData> {
  try {
    const mint = await fetchMint(rpc as any, address(mintAddr));
    return {
      mintAuthority: unwrapOption(mint.data.mintAuthority) as string | null,
      freezeAuthority: unwrapOption(mint.data.freezeAuthority) as string | null,
    };
  } catch {
    try {
      const mint = await fetchMint2022(rpc as any, address(mintAddr));
      return {
        mintAuthority: unwrapOption(mint.data.mintAuthority) as string | null,
        freezeAuthority: unwrapOption(mint.data.freezeAuthority) as string | null,
      };
    } catch {
      return UNCHECKED;
    }
  }
}

// --- Shared domain types for Smart Money Radar ---

export interface SmartMoneyWallet {
  label: string;
  category: string;
}

export interface ParsedSwap {
  signature: string;
  buyerAddress: string;
  tokenMint: string;
  tokenSymbol?: string;
  amountRaw?: string;
  dexSource: string;
  timestamp: number;
}

export interface DexScreenerData {
  liquidity: number | null;
  fdv: number | null;
  marketCap: number | null;
}

export interface AuthorityData {
  mintAuthority: string | null;
  freezeAuthority: string | null;
}

export interface EnrichmentResult {
  liquidity: number | null;
  fdv: number | null;
  marketCap: number | null;
  mintAuthority: string | null | 'unchecked';
  freezeAuthority: string | null | 'unchecked';
}

export interface WalletState {
  walletMap: Map<string, SmartMoneyWallet>;
  watchedAddresses: Set<string>;
}

export interface WalletStateRef {
  current: WalletState;
}

export function createWalletState(wallets: Map<string, SmartMoneyWallet>): WalletState {
  return {
    walletMap: wallets,
    watchedAddresses: new Set(wallets.keys()),
  };
}

export interface AlertData {
  wallet: SmartMoneyWallet;
  swap: ParsedSwap;
  enrichment: EnrichmentResult;
  aiSummary: string;
}

export interface WalletCandidate {
  address: string;
  pnl: number;
  winRate: number;
  tradeCount: number;
  lastActiveTimestamp: number;
}

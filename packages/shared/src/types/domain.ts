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
  tokenSymbol: string | null;
  liquidity: number | null;
  fdv: number | null;
  marketCap: number | null;
  volume24h: number | null;
  txns24h: { buys: number; sells: number } | null;
  pairCreatedAt: number | null;
}

export interface AuthorityData {
  mintAuthority: string | null;
  freezeAuthority: string | null;
}

export interface EnrichmentResult {
  tokenSymbol: string | null;
  liquidity: number | null;
  fdv: number | null;
  marketCap: number | null;
  volume24h: number | null;
  txns24h: { buys: number; sells: number } | null;
  pairCreatedAt: number | null;
  mintAuthority: string | null | 'unchecked';
  freezeAuthority: string | null | 'unchecked';
}

export type RiskLevel = 'high' | 'medium' | 'low';

export interface RiskAssessment {
  level: RiskLevel;
  label: string;
  factors: string[];
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
  riskAssessment: RiskAssessment;
  aiSummary: string;
  confidence: ConfidenceResult;
}

export interface WalletCandidate {
  address: string;
  pnl: number;
  winRate: number;
  tradeCount: number;
  lastActiveTimestamp: number;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceResult {
  score: number;           // 0-100
  level: ConfidenceLevel;  // high ≥ 80, medium ≥ 45, low < 45
  label: string;           // "🟢 信号强度: 高" 等
}

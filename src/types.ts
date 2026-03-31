// --- Helius Enhanced Transaction (subset we use) ---
// Types reflect reality: many fields are optional because Helius omits them
// for unsupported DEXes, failed parses, or certain transaction types.

export interface HeliusTokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  fromTokenAccount: string;
  toTokenAccount: string;
  tokenAmount: number;
  mint: string;
  tokenStandard: string;
}

export interface HeliusSwapTokenIO {
  mint: string;
  rawTokenAmount: {
    decimals: number;
    tokenAmount: string;
  };
  tokenAccount: string;
  userAccount: string;
}

export interface HeliusSwapEvent {
  nativeInput?: { account: string; amount: string } | null;
  nativeOutput?: { account: string; amount: string } | null;
  tokenInputs: HeliusSwapTokenIO[];
  tokenOutputs: HeliusSwapTokenIO[];
  tokenFees?: HeliusSwapTokenIO[];
  nativeFees?: { account: string; amount: string }[];
  innerSwaps?: {
    tokenInputs: HeliusSwapTokenIO[];
    tokenOutputs: HeliusSwapTokenIO[];
    programInfo?: { source: string; account: string; programName: string; instructionName: string };
  }[];
}

export interface HeliusEnhancedTransaction {
  signature: string;
  type: string;
  source: string;
  description: string;
  fee: number;
  feePayer: string;
  slot: number;
  timestamp: number;
  nativeTransfers: { from: string; to: string; amount: number }[];
  tokenTransfers: HeliusTokenTransfer[];
  events: {
    swap?: HeliusSwapEvent;
  };
  transactionError: unknown;
}

// --- Our domain types ---

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

// --- Wallet discovery (Phase 2) ---

export interface WalletCandidate {
  address: string;
  pnl: number;
  winRate: number;
  tradeCount: number;
  lastActiveTimestamp: number;
}

// --- Helius Webhook Management API ---

export interface HeliusWebhook {
  webhookID: string;
  wallet: string;
  webhookURL: string;
  transactionTypes: string[];
  accountAddresses: string[];
  webhookType: string;
  authHeader: string;
}

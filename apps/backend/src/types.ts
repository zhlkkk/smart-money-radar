// --- Re-export shared domain types ---
// Backend code continues to import from './types.js' with zero changes.
export {
  createWalletState,
} from '@radar/shared';

export type {
  SmartMoneyWallet,
  ParsedSwap,
  DexScreenerData,
  AuthorityData,
  EnrichmentResult,
  WalletState,
  WalletStateRef,
  AlertData,
  WalletCandidate,
} from '@radar/shared';

// --- Helius Enhanced Transaction (backend-only) ---
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

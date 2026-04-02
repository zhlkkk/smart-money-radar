import { alertsHistory } from '@radar/db';
import type { PoolDatabase } from '@radar/db';
import type { ParsedSwap, EnrichmentResult, SmartMoneyWallet, ConfidenceResult } from '@radar/shared';

export interface PersistAlertInput {
  swap: ParsedSwap;
  enrichment: EnrichmentResult;
  wallet: SmartMoneyWallet;
  aiSummary: string;
  confidence: ConfidenceResult;
}

/**
 * Persist an alert to the database. Uses ON CONFLICT DO NOTHING for idempotency.
 * Returns true if inserted, false if duplicate signature.
 */
export async function persistAlert(
  db: PoolDatabase,
  input: PersistAlertInput,
): Promise<boolean> {
  const result = await db
    .insert(alertsHistory)
    .values({
      signature: input.swap.signature,
      walletAddress: input.swap.buyerAddress,
      walletLabel: input.wallet.label,
      tokenMint: input.swap.tokenMint,
      tokenSymbol: input.swap.tokenSymbol ?? null,
      dexSource: input.swap.dexSource,
      amountRaw: input.swap.amountRaw ?? null,
      liquidity: input.enrichment.liquidity,
      fdv: input.enrichment.fdv,
      marketCap: input.enrichment.marketCap,
      mintAuthority:
        input.enrichment.mintAuthority === 'unchecked' ? null : input.enrichment.mintAuthority,
      freezeAuthority:
        input.enrichment.freezeAuthority === 'unchecked' ? null : input.enrichment.freezeAuthority,
      aiSummary: input.aiSummary || null,
      telegramSent: true,
    })
    .onConflictDoNothing({ target: alertsHistory.signature })
    .returning({ id: alertsHistory.id });

  return result.length > 0;
}

import { trackedWallets } from '@radar/db';
import type { PoolDatabase } from '@radar/db';
import type { SmartMoneyWallet } from '@radar/shared';

export interface ScoredWalletInput {
  address: string;
  label?: string;
  category?: string;
  source: 'pinned' | 'discovered';
  compositeScore?: number;
  winRate?: number;
  pnl?: number;
  tradeCount?: number;
}

/**
 * Sync tracked wallets to the database. Uses upsert (ON CONFLICT DO UPDATE)
 * to keep scores current.
 */
export async function syncTrackedWallets(
  db: PoolDatabase,
  wallets: ScoredWalletInput[],
): Promise<void> {
  for (const w of wallets) {
    await db
      .insert(trackedWallets)
      .values({
        address: w.address,
        label: w.label ?? null,
        category: w.category ?? null,
        source: w.source,
        compositeScore: w.compositeScore ?? null,
        winRate: w.winRate ?? null,
        pnl: w.pnl ?? null,
        tradeCount: w.tradeCount ?? null,
        isActive: true,
        lastDiscoveredAt: w.source === 'discovered' ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: trackedWallets.address,
        set: {
          label: w.label ?? undefined,
          category: w.category ?? undefined,
          compositeScore: w.compositeScore ?? undefined,
          winRate: w.winRate ?? undefined,
          pnl: w.pnl ?? undefined,
          tradeCount: w.tradeCount ?? undefined,
          isActive: true,
          lastDiscoveredAt: w.source === 'discovered' ? new Date() : undefined,
        },
      });
  }
}

/**
 * Deactivate wallets that were previously discovered but are no longer in the active set.
 */
export async function deactivateWallets(
  db: PoolDatabase,
  addresses: string[],
): Promise<void> {
  if (addresses.length === 0) return;
  const { eq, inArray } = await import('drizzle-orm');
  await db
    .update(trackedWallets)
    .set({ isActive: false })
    .where(inArray(trackedWallets.address, addresses));
}

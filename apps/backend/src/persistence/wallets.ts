import { trackedWallets } from '@radar/db';
import { eq } from 'drizzle-orm';
import type { PoolDatabase } from '@radar/db';

export interface LoadedWallet {
  address: string;
  label: string | null;
  category: string | null;
  compositeScore: number | null;
  winRate: number | null;
  pnl: number | null;
  tradeCount: number | null;
}

/**
 * Load all active discovered wallets from the database.
 * Used at startup to restore wallet state in container environments
 * where local JSON persistence is lost on redeploy.
 */
export async function loadActiveWallets(db: PoolDatabase): Promise<LoadedWallet[]> {
  const rows = await db
    .select({
      address: trackedWallets.address,
      label: trackedWallets.label,
      category: trackedWallets.category,
      compositeScore: trackedWallets.compositeScore,
      winRate: trackedWallets.winRate,
      pnl: trackedWallets.pnl,
      tradeCount: trackedWallets.tradeCount,
    })
    .from(trackedWallets)
    .where(eq(trackedWallets.isActive, true));

  return rows;
}

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
          updatedAt: new Date(),
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

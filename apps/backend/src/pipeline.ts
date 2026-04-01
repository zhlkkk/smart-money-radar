import type Anthropic from '@anthropic-ai/sdk';
import type { PoolDatabase } from '@radar/db';
import type { HeliusEnhancedTransaction, WalletStateRef } from './types.js';
import { TxDedup } from './webhook/dedup.js';
import { parseSwap } from './webhook/parse.js';
import { enrichToken } from './enrichment/enrich.js';
import { generateAttribution } from './ai/attribution.js';
import { formatAlert } from './telegram/format.js';
import { sendAlert } from './telegram/bot.js';
import { persistAlert } from './persistence/alerts.js';

export interface PipelineConfig {
  walletStateRef: WalletStateRef;
  rpc: unknown;
  anthropicClient: Anthropic;
  botToken: string;
  channelId: string;
  db?: PoolDatabase | null;
  logger?: { error: (obj: unknown, msg: string) => void };
}

export function createPipeline(config: PipelineConfig) {
  const dedup = new TxDedup();

  async function processTransaction(tx: HeliusEnhancedTransaction): Promise<void> {
    if (dedup.isDuplicate(tx.signature)) return;

    const { watchedAddresses, walletMap } = config.walletStateRef.current;

    const swap = parseSwap(tx, watchedAddresses);
    if (!swap) return;

    const wallet = walletMap.get(swap.buyerAddress);
    if (!wallet) return;

    const enrichment = await enrichToken(swap.tokenMint, config.rpc);

    const aiSummary = await generateAttribution(
      {
        tokenSymbol: swap.tokenSymbol,
        tokenMint: swap.tokenMint,
        liquidity: enrichment.liquidity,
        fdv: enrichment.fdv,
        walletLabel: wallet.label,
        walletCategory: wallet.category,
        dexSource: swap.dexSource,
      },
      config.anthropicClient,
    );

    const html = formatAlert({ wallet, swap, enrichment, aiSummary });

    // DB write and Telegram send run in parallel — DB failure never blocks alerts
    // Wrap persistAlert in an async IIFE to catch synchronous throws
    const dbWrite = config.db
      ? (async () => persistAlert(config.db!, { swap, enrichment, wallet, aiSummary }))()
      : Promise.resolve(false);

    const results = await Promise.allSettled([
      sendAlert(html, config.botToken, config.channelId),
      dbWrite,
    ]);

    // Log DB write failure but never throw
    const dbResult = results[1];
    if (dbResult && dbResult.status === 'rejected') {
      config.logger?.error(
        { err: dbResult.reason, signature: swap.signature },
        'Failed to persist alert to database',
      );
    }
  }

  return { processTransaction };
}

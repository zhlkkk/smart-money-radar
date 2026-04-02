import type { PoolDatabase } from '@radar/db';
import type { HeliusEnhancedTransaction, WalletStateRef } from './types.js';
import { TxDedup } from './webhook/dedup.js';
import { parseSwap } from './webhook/parse.js';
import { enrichToken } from './enrichment/enrich.js';
import { generateAttribution } from './ai/attribution.js';
import type { LLMConfig } from './ai/attribution.js';
import { formatAlert } from './telegram/format.js';
import { sendAlert } from './telegram/bot.js';
import { persistAlert } from './persistence/alerts.js';
import type { EnrichmentResult, RiskAssessment } from './types.js';
import { alertBus } from './events.js';

// 质量过滤最低阈值
const MIN_LIQUIDITY = 5_000;       // $5K — 低于此值无法退出仓位
const MIN_FDV = 50_000;            // $50K — 过滤废弃代币
const MIN_VOLUME_24H = 1_000;      // $1K — 过滤无交易量代币
const MIN_PAIR_AGE_MS = 5 * 60 * 1000; // 5分钟 — 过滤刚创建的池子

export function passesQualityFilter(enrichment: EnrichmentResult): boolean {
  // DexScreener 无数据则跳过（代币未上市）
  if (enrichment.liquidity === null && enrichment.fdv === null) return false;
  // 检查流动性阈值
  if (enrichment.liquidity !== null && enrichment.liquidity < MIN_LIQUIDITY) return false;
  // 检查 FDV 阈值
  if (enrichment.fdv !== null && enrichment.fdv < MIN_FDV) return false;
  // 检查 24h 交易量阈值
  if (enrichment.volume24h !== null && enrichment.volume24h < MIN_VOLUME_24H) return false;
  // 检查池子创建时间（过滤刚创建的池子）
  if (enrichment.pairCreatedAt !== null && Date.now() - enrichment.pairCreatedAt < MIN_PAIR_AGE_MS) return false;
  return true;
}

export function assessRisk(enrichment: EnrichmentResult): RiskAssessment {
  const reds: string[] = [];
  const yellows: string[] = [];

  // 高风险：权限未撤销
  if (enrichment.mintAuthority !== null && enrichment.mintAuthority !== 'unchecked') {
    reds.push('Mint Authority 未撤销');
  }
  if (enrichment.freezeAuthority !== null && enrichment.freezeAuthority !== 'unchecked') {
    reds.push('Freeze Authority 未撤销');
  }

  // 中风险：流动性偏低
  if (enrichment.liquidity !== null && enrichment.liquidity < 100_000) {
    yellows.push('流动性偏低');
  }
  // 中风险：24h 交易量偏低
  if (enrichment.volume24h !== null && enrichment.volume24h < 50_000) {
    yellows.push('24h交易量偏低');
  }
  // 中风险：池子创建不足24h
  if (enrichment.pairCreatedAt !== null) {
    const ageMs = Date.now() - enrichment.pairCreatedAt;
    if (ageMs < 24 * 60 * 60 * 1000) yellows.push('池子创建不足24h');
  }

  const factors = [...reds, ...yellows];

  if (reds.length > 0) return { level: 'high', label: '🔴 高风险', factors };
  if (yellows.length > 0) return { level: 'medium', label: '🟡 注意', factors };
  return { level: 'low', label: '🟢 低风险', factors };
}

export interface PipelineConfig {
  walletStateRef: WalletStateRef;
  rpc: unknown;
  llmConfig: LLMConfig;
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

    // 用 DexScreener 的 tokenSymbol 补充 Helius 解析可能缺失的 symbol
    const tokenSymbol = swap.tokenSymbol ?? enrichment.tokenSymbol ?? null;

    // 质量过滤 — 跳过低质量代币以减少噪音
    if (!passesQualityFilter(enrichment)) return;

    // 风险评估
    const riskAssessment = assessRisk(enrichment);

    const aiSummary = await generateAttribution(
      {
        tokenSymbol,
        tokenMint: swap.tokenMint,
        liquidity: enrichment.liquidity,
        fdv: enrichment.fdv,
        volume24h: enrichment.volume24h,
        txns24h: enrichment.txns24h,
        pairCreatedAt: enrichment.pairCreatedAt,
        walletLabel: wallet.label,
        walletCategory: wallet.category,
        dexSource: swap.dexSource,
        mintAuthority: enrichment.mintAuthority,
        freezeAuthority: enrichment.freezeAuthority,
        riskLabel: riskAssessment.label,
        riskFactors: riskAssessment.factors,
      },
      config.llmConfig,
    );

    // 广播告警事件到 SSE 连接
    alertBus.emit('alert', {
      id: swap.signature,
      signature: swap.signature,
      walletAddress: swap.buyerAddress,
      walletLabel: wallet.label,
      tokenMint: swap.tokenMint,
      tokenSymbol,
      dexSource: swap.dexSource,
      liquidity: enrichment.liquidity,
      fdv: enrichment.fdv,
      marketCap: enrichment.marketCap,
      mintAuthority: enrichment.mintAuthority,
      freezeAuthority: enrichment.freezeAuthority,
      aiSummary,
      createdAt: new Date().toISOString(),
    });

    const html = formatAlert({ wallet, swap, enrichment, riskAssessment, aiSummary });

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

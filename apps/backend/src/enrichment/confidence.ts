import type { EnrichmentResult, ConfidenceResult, ConfidenceLevel } from '../types.js';

/** stale 数据降分 */
const STALE_DATA_PENALTY = 10;
/** 价格偏差降分 */
const PRICE_DEVIATION_PENALTY = 10;
/** 偏差阈值（百分比） */
const PRICE_DEVIATION_THRESHOLD = 5;

interface ConfidenceOptions {
  staleData?: boolean;
  priceDeviation?: number;
}

export function computeConfidence(
  enrichment: EnrichmentResult,
  isTopWallet: boolean,
  options?: ConfidenceOptions,
): ConfidenceResult {
  let score = 0;

  // +30: 链上权限安全（mint 和 freeze 权限均已撤销）
  if (enrichment.mintAuthority === null && enrichment.freezeAuthority === null) {
    score += 30;
  }

  // +25: DexScreener 数据完整（流动性和 FDV 均有值）
  const dexScreenerComplete = enrichment.liquidity !== null && enrichment.fdv !== null;
  if (dexScreenerComplete) {
    score += 25;
  }

  // +25: 流动性充足（> $50K）
  if (enrichment.liquidity !== null && enrichment.liquidity > 50_000) {
    score += 25;
  }

  // +20: 高评分钱包（Birdeye 评分靠前）
  if (isTopWallet) {
    score += 20;
  }

  // -10: stale 缓存数据降分（仅在 DexScreener 数据完整时才扣分）
  if (options?.staleData === true && dexScreenerComplete) {
    score -= STALE_DATA_PENALTY;
  }

  // -10: 价格偏差过大降分（偏差 > 阈值百分比）
  if (
    options?.priceDeviation !== undefined &&
    options.priceDeviation > PRICE_DEVIATION_THRESHOLD
  ) {
    score -= PRICE_DEVIATION_PENALTY;
  }

  // 保底 0 分
  score = Math.max(score, 0);

  const level: ConfidenceLevel = score >= 80 ? 'high' : score >= 45 ? 'medium' : 'low';

  const labelMap: Record<ConfidenceLevel, string> = {
    high: '🟢 信号强度: 高',
    medium: '🟡 信号强度: 中',
    low: '🔴 信号强度: 低',
  };

  return { score, level, label: labelMap[level] };
}

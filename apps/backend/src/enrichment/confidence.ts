import type { EnrichmentResult, ConfidenceResult, ConfidenceLevel } from '../types.js';

export function computeConfidence(
  enrichment: EnrichmentResult,
  isTopWallet: boolean,
): ConfidenceResult {
  let score = 0;

  // +30: 链上权限安全（mint 和 freeze 权限均已撤销）
  if (enrichment.mintAuthority === null && enrichment.freezeAuthority === null) {
    score += 30;
  }

  // +25: DexScreener 数据完整（流动性和 FDV 均有值）
  if (enrichment.liquidity !== null && enrichment.fdv !== null) {
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

  const level: ConfidenceLevel = score >= 80 ? 'high' : score >= 45 ? 'medium' : 'low';

  const labelMap: Record<ConfidenceLevel, string> = {
    high: '🟢 信号强度: 高',
    medium: '🟡 信号强度: 中',
    low: '🔴 信号强度: 低',
  };

  return { score, level, label: labelMap[level] };
}

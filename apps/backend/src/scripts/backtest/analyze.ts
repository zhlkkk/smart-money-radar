import type {
  PriceTrackResult,
  BacktestStats,
  BacktestReport,
} from './types.js';

/**
 * 获取单笔交易的有效 24h 回报率。
 * noData 的交易视为 -100% 回报。
 */
function effective24hReturn(result: PriceTrackResult): number {
  if (result.noData) return -100;
  return result.returns.h24 ?? -100;
}

/**
 * 根据价格追踪结果计算统计指标。
 *
 * - 胜率 = 24h 回报 > 0 的交易数 / 总交易数（noData 视为 -100%）
 * - 平均回报 = 所有交易 24h 回报的算术平均
 * - 最大回撤 = 最小单笔 24h 回报
 * - 盈利集中度 = 前 10% 盈利交易的利润之和 / 总利润之和
 * - 无数据比例 = noData 交易数 / 总交易数
 */
export function computeStats(results: PriceTrackResult[]): BacktestStats {
  if (results.length === 0) {
    return {
      totalTrades: 0,
      winRate24h: 0,
      avgReturn24h: 0,
      maxDrawdown: 0,
      profitConcentration: 0,
      noDataRatio: 0,
    };
  }

  const totalTrades = results.length;
  const returns24h = results.map(effective24hReturn);

  // 胜率
  const wins = returns24h.filter((r) => r > 0).length;
  const winRate24h = wins / totalTrades;

  // 平均回报
  const sumReturns = returns24h.reduce((acc, r) => acc + r, 0);
  const avgReturn24h = sumReturns / totalTrades;

  // 最大回撤（最差单笔回报）
  const maxDrawdown = Math.min(...returns24h);

  // 盈利集中度
  const profitableReturns = returns24h.filter((r) => r > 0).sort((a, b) => b - a);
  const totalProfit = profitableReturns.reduce((acc, r) => acc + r, 0);

  let profitConcentration = 0;
  if (totalProfit > 0) {
    const top10Count = Math.max(1, Math.ceil(profitableReturns.length * 0.1));
    const top10Profit = profitableReturns.slice(0, top10Count).reduce((acc, r) => acc + r, 0);
    profitConcentration = top10Profit / totalProfit;
  }

  // 无数据比例
  const noDataCount = results.filter((r) => r.noData).length;
  const noDataRatio = noDataCount / totalTrades;

  return {
    totalTrades,
    winRate24h,
    avgReturn24h,
    maxDrawdown,
    profitConcentration,
    noDataRatio,
  };
}

/**
 * 生成完整的回测报告。
 *
 * - passed = 聪明钱 winRate24h > 0.55 且 (聪明钱 - 基线) > 0.10
 * - dataReliable = 聪明钱 noDataRatio <= 0.3
 */
export function generateReport(
  smartMoneyResults: PriceTrackResult[],
  baselineResults: PriceTrackResult[],
): BacktestReport {
  const smartMoneyStats = computeStats(smartMoneyResults);
  const baselineStats = computeStats(baselineResults);

  const passed =
    smartMoneyStats.winRate24h > 0.55 &&
    smartMoneyStats.winRate24h - baselineStats.winRate24h > 0.1;

  const dataReliable = smartMoneyStats.noDataRatio <= 0.3;

  return {
    smartMoneyStats,
    baselineStats,
    passed,
    dataReliable,
    generatedAt: new Date().toISOString(),
  };
}

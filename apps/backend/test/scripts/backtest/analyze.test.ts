import { describe, it, expect } from 'vitest';
import { computeStats, generateReport } from '../../../src/scripts/backtest/analyze.js';
import { formatMarkdownReport } from '../../../src/scripts/backtest/report.js';
import type { PriceTrackResult, BacktestReport } from '../../../src/scripts/backtest/types.js';

/** 辅助函数：快速创建 PriceTrackResult */
function makePriceResult(
  overrides: Partial<PriceTrackResult> & { h24?: number | null },
): PriceTrackResult {
  const { h24, ...rest } = overrides;
  return {
    tradeSignature: 'sig-default',
    tokenMint: 'mint-default',
    buyTimestamp: 1711843200,
    buyPrice: 1.0,
    noData: rest.noData ?? false,
    ...rest,
    returns: {
      h1: rest.returns?.h1 ?? null,
      h24: h24 !== undefined ? h24 : (rest.returns?.h24 ?? null),
      d7: rest.returns?.d7 ?? null,
    },
  };
}

describe('computeStats', () => {
  it('给定完整价格数据，正确计算 24h 胜率和平均回报', () => {
    const results: PriceTrackResult[] = [
      makePriceResult({ tradeSignature: 'sig1', h24: 50 }),
      makePriceResult({ tradeSignature: 'sig2', h24: -20 }),
      makePriceResult({ tradeSignature: 'sig3', h24: 30 }),
      makePriceResult({ tradeSignature: 'sig4', h24: 10 }),
    ];

    const stats = computeStats(results);

    expect(stats.totalTrades).toBe(4);
    // 3 笔盈利 / 4 笔总计 = 0.75
    expect(stats.winRate24h).toBe(0.75);
    // (50 + -20 + 30 + 10) / 4 = 17.5
    expect(stats.avgReturn24h).toBe(17.5);
    // 最差单笔 = -20
    expect(stats.maxDrawdown).toBe(-20);
    expect(stats.noDataRatio).toBe(0);
  });

  it('noData 的交易视为 -100%，noDataRatio 统计正确', () => {
    const results: PriceTrackResult[] = [
      makePriceResult({ tradeSignature: 'sig1', h24: 50 }),
      makePriceResult({ tradeSignature: 'sig2', noData: true }),
      makePriceResult({ tradeSignature: 'sig3', h24: 30 }),
    ];

    const stats = computeStats(results);

    expect(stats.totalTrades).toBe(3);
    // noData 交易视为 -100%: 1 笔盈利(50) + 1 笔盈利(30) = 2，noData 算亏损
    // 胜率 = 2/3
    expect(stats.winRate24h).toBeCloseTo(2 / 3, 5);
    // 平均 = (50 + -100 + 30) / 3 = -20/3 ≈ -6.667
    expect(stats.avgReturn24h).toBeCloseTo(-20 / 3, 5);
    // 最差 = -100
    expect(stats.maxDrawdown).toBe(-100);
    // noDataRatio = 1/3
    expect(stats.noDataRatio).toBeCloseTo(1 / 3, 5);
  });

  it('所有买入都盈利（100% 胜率）→ 正常输出', () => {
    const results: PriceTrackResult[] = [
      makePriceResult({ tradeSignature: 'sig1', h24: 10 }),
      makePriceResult({ tradeSignature: 'sig2', h24: 25 }),
      makePriceResult({ tradeSignature: 'sig3', h24: 5 }),
    ];

    const stats = computeStats(results);

    expect(stats.winRate24h).toBe(1.0);
    expect(stats.avgReturn24h).toBeCloseTo(40 / 3, 5);
    expect(stats.maxDrawdown).toBe(5); // "最差"也是正数
  });

  it('盈利集中度 > 0.8（前 10% 贡献超 80%）', () => {
    // 10 笔交易，前 1 笔（10%）盈利 1000，其余 9 笔各盈利 1
    const results: PriceTrackResult[] = [
      makePriceResult({ tradeSignature: 'sig-big', h24: 1000 }),
      ...Array.from({ length: 9 }, (_, i) =>
        makePriceResult({ tradeSignature: `sig-${i}`, h24: 1 }),
      ),
    ];

    const stats = computeStats(results);

    // 前 10% (1 笔) 利润 = 1000, 总利润 = 1000 + 9 = 1009
    // 集中度 = 1000 / 1009 ≈ 0.991
    expect(stats.profitConcentration).toBeGreaterThan(0.8);
    expect(stats.profitConcentration).toBeCloseTo(1000 / 1009, 3);
  });

  it('总利润 <= 0 → profitConcentration = 0', () => {
    const results: PriceTrackResult[] = [
      makePriceResult({ tradeSignature: 'sig1', h24: -50 }),
      makePriceResult({ tradeSignature: 'sig2', h24: -20 }),
    ];

    const stats = computeStats(results);

    expect(stats.profitConcentration).toBe(0);
  });

  it('空数组输入 → 合理默认值', () => {
    const stats = computeStats([]);

    expect(stats.totalTrades).toBe(0);
    expect(stats.winRate24h).toBe(0);
    expect(stats.avgReturn24h).toBe(0);
    expect(stats.maxDrawdown).toBe(0);
    expect(stats.profitConcentration).toBe(0);
    expect(stats.noDataRatio).toBe(0);
  });
});

describe('generateReport', () => {
  it('聪明钱组 vs 随机组对比结果格式正确', () => {
    const smartMoney: PriceTrackResult[] = [
      makePriceResult({ tradeSignature: 's1', h24: 60 }),
      makePriceResult({ tradeSignature: 's2', h24: 40 }),
      makePriceResult({ tradeSignature: 's3', h24: -10 }),
      makePriceResult({ tradeSignature: 's4', h24: 20 }),
    ];

    const baseline: PriceTrackResult[] = [
      makePriceResult({ tradeSignature: 'b1', h24: 10 }),
      makePriceResult({ tradeSignature: 'b2', h24: -30 }),
      makePriceResult({ tradeSignature: 'b3', h24: -20 }),
      makePriceResult({ tradeSignature: 'b4', h24: 5 }),
    ];

    const report = generateReport(smartMoney, baseline);

    // 聪明钱: 3/4 win = 0.75, 基线: 2/4 = 0.50
    expect(report.smartMoneyStats.winRate24h).toBe(0.75);
    expect(report.baselineStats.winRate24h).toBe(0.5);
    // passed: 0.75 > 0.55 且 0.75 - 0.50 = 0.25 > 0.10
    expect(report.passed).toBe(true);
    expect(report.dataReliable).toBe(true);
    expect(report.generatedAt).toBeTruthy();
  });

  it('noDataRatio > 0.3 → report.dataReliable = false', () => {
    // 3 笔中 2 笔 noData → noDataRatio ≈ 0.667
    const smartMoney: PriceTrackResult[] = [
      makePriceResult({ tradeSignature: 's1', h24: 100 }),
      makePriceResult({ tradeSignature: 's2', noData: true }),
      makePriceResult({ tradeSignature: 's3', noData: true }),
    ];

    const baseline: PriceTrackResult[] = [
      makePriceResult({ tradeSignature: 'b1', h24: 5 }),
    ];

    const report = generateReport(smartMoney, baseline);

    expect(report.dataReliable).toBe(false);
    expect(report.smartMoneyStats.noDataRatio).toBeCloseTo(2 / 3, 5);
  });

  it('聪明钱胜率不足 → passed = false', () => {
    // 胜率 = 1/4 = 0.25, 不满足 > 0.55
    const smartMoney: PriceTrackResult[] = [
      makePriceResult({ tradeSignature: 's1', h24: 10 }),
      makePriceResult({ tradeSignature: 's2', h24: -20 }),
      makePriceResult({ tradeSignature: 's3', h24: -10 }),
      makePriceResult({ tradeSignature: 's4', h24: -5 }),
    ];

    const baseline: PriceTrackResult[] = [
      makePriceResult({ tradeSignature: 'b1', h24: -50 }),
    ];

    const report = generateReport(smartMoney, baseline);

    expect(report.passed).toBe(false);
  });

  it('基线组为空（fallback 场景）→ passed 仅看绝对胜率', () => {
    // Smart money: 3/4 = 0.75 > 0.55, baseline: empty → winRate = 0
    // Diff = 0.75 - 0 = 0.75 > 0.10 → passed = true
    const smartMoney: PriceTrackResult[] = [
      makePriceResult({ tradeSignature: 's1', h24: 10 }),
      makePriceResult({ tradeSignature: 's2', h24: 20 }),
      makePriceResult({ tradeSignature: 's3', h24: 30 }),
      makePriceResult({ tradeSignature: 's4', h24: -5 }),
    ];

    const report = generateReport(smartMoney, []);

    expect(report.passed).toBe(true);
    expect(report.baselineStats.totalTrades).toBe(0);
    expect(report.baselineStats.winRate24h).toBe(0);
  });

  it('聪明钱 winRate=50% 基线 winRate=48% → passed=false（不足 55%）', () => {
    // Smart money: 2/4 = 0.50, not > 0.55 → failed regardless of diff
    const smartMoney: PriceTrackResult[] = [
      makePriceResult({ tradeSignature: 's1', h24: 10 }),
      makePriceResult({ tradeSignature: 's2', h24: 20 }),
      makePriceResult({ tradeSignature: 's3', h24: -10 }),
      makePriceResult({ tradeSignature: 's4', h24: -5 }),
    ];

    const baseline: PriceTrackResult[] = [
      makePriceResult({ tradeSignature: 'b1', h24: 10 }),
      makePriceResult({ tradeSignature: 'b2', h24: 20 }),
      makePriceResult({ tradeSignature: 'b3', h24: -10 }),
      makePriceResult({ tradeSignature: 'b4', h24: -5 }),
      makePriceResult({ tradeSignature: 'b5', h24: -15 }),
    ];

    const report = generateReport(smartMoney, baseline);

    expect(report.passed).toBe(false);
    expect(report.smartMoneyStats.winRate24h).toBe(0.5);
  });

  it('聪明钱胜率高但差值不够 → passed = false', () => {
    // 聪明钱: 3/4 = 0.75, 基线: 3/4 = 0.75, 差值 = 0 < 0.10
    const smartMoney: PriceTrackResult[] = [
      makePriceResult({ tradeSignature: 's1', h24: 10 }),
      makePriceResult({ tradeSignature: 's2', h24: 20 }),
      makePriceResult({ tradeSignature: 's3', h24: 30 }),
      makePriceResult({ tradeSignature: 's4', h24: -5 }),
    ];

    const baseline: PriceTrackResult[] = [
      makePriceResult({ tradeSignature: 'b1', h24: 10 }),
      makePriceResult({ tradeSignature: 'b2', h24: 20 }),
      makePriceResult({ tradeSignature: 'b3', h24: 30 }),
      makePriceResult({ tradeSignature: 'b4', h24: -5 }),
    ];

    const report = generateReport(smartMoney, baseline);

    expect(report.passed).toBe(false);
  });
});

describe('formatMarkdownReport', () => {
  function makeReport(overrides: Partial<BacktestReport> = {}): BacktestReport {
    return {
      smartMoneyStats: {
        totalTrades: 10,
        winRate24h: 0.7,
        avgReturn24h: 15,
        maxDrawdown: -30,
        profitConcentration: 0.5,
        noDataRatio: 0.1,
      },
      baselineStats: {
        totalTrades: 10,
        winRate24h: 0.4,
        avgReturn24h: -5,
        maxDrawdown: -80,
        profitConcentration: 0.3,
        noDataRatio: 0.2,
      },
      passed: true,
      dataReliable: true,
      generatedAt: '2026-04-03T00:00:00.000Z',
      ...overrides,
    };
  }

  it('包含 dataSource 时显示数据来源和局限性警告', () => {
    const report = makeReport({
      dataSource: {
        smartMoney: 'Birdeye top 30%',
        baseline: 'Birdeye bottom 30%',
      },
    });

    const md = formatMarkdownReport(report);

    expect(md).toContain('## 数据来源');
    expect(md).toContain('Birdeye top 30%');
    expect(md).toContain('Birdeye bottom 30%');
    expect(md).toContain('并非真正的随机钱包');
  });

  it('无 dataSource 时不显示数据来源段落', () => {
    const report = makeReport();

    const md = formatMarkdownReport(report);

    expect(md).not.toContain('## 数据来源');
    expect(md).not.toContain('并非真正的随机钱包');
  });

  it('基线组无交易时显示无基线标注', () => {
    const report = makeReport({
      baselineStats: {
        totalTrades: 0,
        winRate24h: 0,
        avgReturn24h: 0,
        maxDrawdown: 0,
        profitConcentration: 0,
        noDataRatio: 0,
      },
    });

    const md = formatMarkdownReport(report);

    expect(md).toContain('无基线对照');
    expect(md).toContain('仅供参考');
  });

  it('基线组有交易时不显示无基线标注', () => {
    const report = makeReport();

    const md = formatMarkdownReport(report);

    expect(md).not.toContain('无基线对照');
  });
});

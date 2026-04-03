import type { BacktestReport, BacktestStats } from './types.js';

/**
 * 格式化百分比数值，保留 2 位小数。
 */
function fmtPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

/**
 * 格式化比例为百分比字符串。
 */
function fmtRatio(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * 生成单组统计的摘要行。
 */
function statsRow(label: string, stats: BacktestStats): string {
  return [
    `| ${label}`,
    `${stats.totalTrades}`,
    `${fmtRatio(stats.winRate24h)}`,
    `${fmtPct(stats.avgReturn24h)}`,
    `${fmtPct(stats.maxDrawdown)}`,
    `${fmtRatio(stats.profitConcentration)}`,
    `${fmtRatio(stats.noDataRatio)} |`,
  ].join(' | ');
}

/**
 * 将回测报告格式化为可读的 Markdown。
 *
 * 包含：
 * - 标题和生成时间
 * - 聪明钱组 vs 基线组的指标对比表
 * - pass/fail 结论
 * - 数据可靠性标注
 * - 盈利集中度警告
 */
export function formatMarkdownReport(report: BacktestReport): string {
  const lines: string[] = [];

  lines.push('# Birdeye 聪明钱评分回测报告');
  lines.push('');
  lines.push(`> 生成时间: ${report.generatedAt}`);
  lines.push('');

  // 数据来源说明
  if (report.dataSource) {
    lines.push('## 数据来源');
    lines.push('');
    lines.push(`- **聪明钱组**: ${report.dataSource.smartMoney}`);
    lines.push(`- **基线对照组**: ${report.dataSource.baseline}`);
    lines.push('');
    lines.push(
      '> ⚠️ 基线组取自 Birdeye 排行榜底部钱包，并非真正的随机钱包。' +
        '对比结果反映的是排行榜内部差异，而非聪明钱 vs 市场平均水平。',
    );
    lines.push('');
  }

  // 无基线对照标注
  if (report.baselineStats.totalTrades === 0) {
    lines.push(
      '> ⚠️ **无基线对照** — 基线组无交易数据，pass/fail 结论仅供参考。',
    );
    lines.push('');
  }

  // 指标对比表
  lines.push('## 指标对比');
  lines.push('');
  lines.push(
    '| 组别 | 交易数 | 24h 胜率 | 24h 平均回报 | 最大回撤 | 盈利集中度 | 无数据比例 |',
  );
  lines.push(
    '|------|--------|----------|-------------|---------|-----------|-----------|',
  );
  lines.push(statsRow('聪明钱', report.smartMoneyStats));
  lines.push(statsRow('随机基线', report.baselineStats));
  lines.push('');

  // 结论
  lines.push('## 结论');
  lines.push('');

  if (report.passed) {
    lines.push(
      '**✅ 通过** — 聪明钱组 24h 胜率 > 55% 且显著高于基线（差值 > 10pp）。',
    );
  } else {
    lines.push(
      '**❌ 未通过** — 聪明钱组未能满足胜率 > 55% 且显著高于基线（差值 > 10pp）的条件。',
    );
  }
  lines.push('');

  // 数据可靠性
  if (!report.dataReliable) {
    lines.push(
      '> ⚠️ **数据不足，结论不可靠** — 聪明钱组无数据比例超过 30%，' +
        '大量代币可能已退市或缺少历史价格数据。',
    );
    lines.push('');
  }

  // 盈利集中度警告
  if (report.smartMoneyStats.profitConcentration > 0.8) {
    lines.push(
      '> ⚠️ **运气成分高** — 前 10% 交易贡献了超过 80% 的利润，' +
        '整体表现可能由少数交易主导而非系统性优势。',
    );
    lines.push('');
  }

  return lines.join('\n');
}

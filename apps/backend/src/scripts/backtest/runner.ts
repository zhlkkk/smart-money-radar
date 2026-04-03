/**
 * BacktestRunner — reusable backtest pipeline service.
 *
 * Extracts the seed-mode pipeline from cli.ts into a class that both
 * the CLI and future API endpoints can invoke.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createRateLimiter } from '../../discovery/rate-limiter.js';
import { collectAllWallets } from './collect.js';
import { trackAllTrades } from './track-prices.js';
import { generateReport } from './analyze.js';
import { formatMarkdownReport } from './report.js';
import { seedFromBirdeye } from './cli.js';
import type {
  BacktestProgress,
  BacktestRunnerConfig,
  BacktestReport,
  BacktestDataSource,
  CollectionProgress,
  BacktestTrade,
  WalletTradeData,
} from './types.js';
import { readFile, readdir } from 'node:fs/promises';

export type { BacktestProgress, BacktestRunnerConfig };

/** Load buy trades from collected JSON files in a directory */
async function loadBuyTrades(dataDir: string): Promise<BacktestTrade[]> {
  let files: string[];
  try {
    files = await readdir(dataDir);
  } catch {
    return [];
  }

  const jsonFiles = files.filter((f) => f.endsWith('.json'));
  const allTrades: BacktestTrade[] = [];

  for (const file of jsonFiles) {
    const filePath = join(dataDir, file);
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as WalletTradeData;

    if (data.trades) {
      const buys = data.trades.filter((t) => t.type === 'buy');
      allTrades.push(...buys);
    }
  }

  return allTrades;
}

/** Generate YYYY-MM-DD date string */
function todayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class BacktestRunner {
  private readonly birdeyeApiKey: string;
  private readonly heliusApiKey: string;
  private readonly outputDir: string;
  private readonly onProgress: (event: BacktestProgress) => void;

  constructor(config: BacktestRunnerConfig) {
    this.birdeyeApiKey = config.birdeyeApiKey;
    this.heliusApiKey = config.heliusApiKey;
    this.outputDir = config.outputDir;
    this.onProgress = config.onProgress ?? (() => {});
  }

  async run(): Promise<BacktestReport> {
    const rateLimiter = createRateLimiter(30);

    // Phase 1: Seed from Birdeye
    this.onProgress({ phase: 'seed', percent: 5, message: '从 Birdeye 获取候选钱包并分组...' });
    const groups = await seedFromBirdeye(this.birdeyeApiKey);

    const smartMoneyCollectDir = join(this.outputDir, 'smart-money');
    const baselineCollectDir = join(this.outputDir, 'baseline');

    // Phase 2: Collect smart money group
    this.onProgress({
      phase: 'collect-smart',
      percent: 10,
      message: `开始采集聪明钱组交易数据（${groups.smartMoney.length} 个钱包）...`,
    });
    const smProgress = await collectAllWallets(this.heliusApiKey, groups.smartMoney, {
      outputDir: smartMoneyCollectDir,
      rateLimiter,
      onProgress: (p: CollectionProgress) => {
        const total = p.completed + p.failed + p.skipped;
        const pct = 10 + Math.round((total / p.totalWallets) * 25);
        this.onProgress({
          phase: 'collect-smart',
          percent: pct,
          message: `聪明钱组进度: ${total}/${p.totalWallets} (成功=${p.completed} 失败=${p.failed} 跳过=${p.skipped})`,
        });
      },
    });
    this.onProgress({
      phase: 'collect-smart',
      percent: 35,
      message: `聪明钱组采集完成: 成功=${smProgress.completed} 失败=${smProgress.failed} 跳过=${smProgress.skipped}`,
    });

    // Phase 3: Collect baseline group
    this.onProgress({
      phase: 'collect-baseline',
      percent: 35,
      message: `开始采集基线组交易数据（${groups.baseline.length} 个钱包）...`,
    });
    const blProgress = await collectAllWallets(this.heliusApiKey, groups.baseline, {
      outputDir: baselineCollectDir,
      rateLimiter,
      onProgress: (p: CollectionProgress) => {
        const total = p.completed + p.failed + p.skipped;
        const pct = 35 + Math.round((total / p.totalWallets) * 25);
        this.onProgress({
          phase: 'collect-baseline',
          percent: pct,
          message: `基线组进度: ${total}/${p.totalWallets} (成功=${p.completed} 失败=${p.failed} 跳过=${p.skipped})`,
        });
      },
    });
    this.onProgress({
      phase: 'collect-baseline',
      percent: 60,
      message: `基线组采集完成: 成功=${blProgress.completed} 失败=${blProgress.failed} 跳过=${blProgress.skipped}`,
    });

    // Load collected data
    const smartMoneyBuyTrades = await loadBuyTrades(smartMoneyCollectDir);
    const baselineBuyTrades = await loadBuyTrades(baselineCollectDir);

    if (smartMoneyBuyTrades.length === 0) {
      throw new Error('聪明钱组没有找到任何买入交易数据');
    }

    // Phase 4: Track smart money prices
    this.onProgress({
      phase: 'track-smart',
      percent: 60,
      message: `开始追踪聪明钱组交易价格表现（${smartMoneyBuyTrades.length} 笔）...`,
    });
    const smartMoneyResults = await trackAllTrades(smartMoneyBuyTrades, this.birdeyeApiKey, rateLimiter);
    this.onProgress({
      phase: 'track-smart',
      percent: 75,
      message: `聪明钱组价格追踪完成: ${smartMoneyResults.length} 笔交易`,
    });

    // Phase 5: Track baseline prices
    this.onProgress({
      phase: 'track-baseline',
      percent: 75,
      message: `开始追踪基线组交易价格表现（${baselineBuyTrades.length} 笔）...`,
    });
    const baselineResults = await trackAllTrades(baselineBuyTrades, this.birdeyeApiKey, rateLimiter);
    this.onProgress({
      phase: 'track-baseline',
      percent: 90,
      message: `基线组价格追踪完成: ${baselineResults.length} 笔交易`,
    });

    // Phase 6: Analyze and generate report
    this.onProgress({ phase: 'analyze', percent: 95, message: '生成回测报告...' });
    const report = generateReport(smartMoneyResults, baselineResults);

    const dataSource: BacktestDataSource = {
      smartMoney: `Birdeye trader/gainers-losers 排行榜 PnL 前 30%`,
      baseline: `Birdeye trader/gainers-losers 排行榜 PnL 后 30%`,
    };
    report.dataSource = dataSource;

    const markdown = formatMarkdownReport(report);

    // Write report file
    await mkdir(this.outputDir, { recursive: true });
    const reportFileName = `report-${todayString()}.md`;
    const reportPath = join(this.outputDir, reportFileName);
    await writeFile(reportPath, markdown);

    this.onProgress({ phase: 'analyze', percent: 100, message: `报告已写入: ${reportPath}` });

    return report;
  }
}

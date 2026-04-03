/**
 * 回测 CLI 入口脚本。
 *
 * 集成采集（collect）、价格追踪（track-prices）和分析（analyze）模块，
 * 输出 Markdown 格式的回测报告。
 *
 * 用法:
 *   npx tsx src/scripts/backtest/cli.ts [options]
 *
 * 选项:
 *   --wallets-file <path>  钱包地址来源文件（默认 config/smart-money-addresses.json）
 *   --output-dir <path>    输出目录（默认 data/backtest）
 *   --skip-collect         跳过采集阶段，直接用已有数据分析
 *   --help                 显示帮助信息
 */

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createRateLimiter } from '../../discovery/rate-limiter.js';
import { fetchTopWallets } from '../../discovery/birdeye.js';
import { collectAllWallets } from './collect.js';
import { trackAllTrades } from './track-prices.js';
import { generateReport } from './analyze.js';
import { formatMarkdownReport } from './report.js';
import type { BacktestTrade, BacktestGroups, CollectionProgress, PriceTrackResult, WalletTradeData } from './types.js';

/** 进度日志输出到 stderr，不干扰 stdout 报告输出 */
function log(message: string): void {
  console.error(`[backtest] ${message}`);
}

/** 显示帮助信息并退出 */
function printHelp(): void {
  console.error(`
Birdeye 聪明钱评分回测 CLI

用法:
  npx tsx src/scripts/backtest/cli.ts [options]

选项:
  --wallets-file <path>  钱包地址来源文件（默认 config/smart-money-addresses.json）
  --output-dir <path>    输出目录（默认 data/backtest）
  --skip-collect         跳过采集阶段，直接用已有数据分析
  --seed-from-birdeye    从 Birdeye 自动获取候选钱包，按 PnL 分组（覆盖钱包文件）
  --help                 显示帮助信息

环境变量:
  BIRDEYE_API_KEY        Birdeye API 密钥（必须）
`);
}

/** 解析命令行参数 */
interface CliArgs {
  walletsFile: string;
  outputDir: string;
  skipCollect: boolean;
  seedFromBirdeye: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    walletsFile: 'config/smart-money-addresses.json',
    outputDir: 'data/backtest',
    skipCollect: false,
    seedFromBirdeye: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--wallets-file': {
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) {
          console.error('错误: --wallets-file 需要一个路径参数');
          process.exit(1);
        }
        args.walletsFile = next;
        i++;
        break;
      }
      case '--output-dir': {
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) {
          console.error('错误: --output-dir 需要一个路径参数');
          process.exit(1);
        }
        args.outputDir = next;
        i++;
        break;
      }
      case '--skip-collect':
        args.skipCollect = true;
        break;
      case '--seed-from-birdeye':
        args.seedFromBirdeye = true;
        break;
      case '--help':
        args.help = true;
        break;
      default:
        console.error(`未知参数: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  return args;
}

/** 从钱包配置文件读取地址列表 */
async function loadWalletAddresses(filePath: string): Promise<string[]> {
  const content = await readFile(filePath, 'utf-8');
  const parsed: unknown = JSON.parse(content);

  // 支持两种格式：
  // 1. { "wallets": { "addr1": {...}, "addr2": {...} } }
  // 2. { "addr1": {...}, "addr2": {...} }（空对象或扁平结构）
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'wallets' in parsed &&
    typeof (parsed as Record<string, unknown>).wallets === 'object' &&
    (parsed as Record<string, unknown>).wallets !== null
  ) {
    return Object.keys((parsed as Record<string, unknown>).wallets as Record<string, unknown>);
  }

  if (typeof parsed === 'object' && parsed !== null) {
    return Object.keys(parsed);
  }

  throw new Error(`无法解析钱包文件: ${filePath}`);
}

/**
 * 从 Birdeye 获取候选钱包，按 PnL 降序排列后分组：
 * - 前 30% → smartMoney
 * - 后 30% → baseline
 */
export async function seedFromBirdeye(apiKey: string): Promise<BacktestGroups> {
  log('从 Birdeye 获取候选钱包...');
  const candidates = await fetchTopWallets(apiKey);

  if (candidates.length < 10) {
    throw new Error(
      `钱包候选数量不足（需要至少 10 个，实际 ${candidates.length} 个）`,
    );
  }

  // Sort by PnL descending
  candidates.sort((a, b) => b.pnl - a.pnl);

  const topCount = Math.floor(candidates.length * 0.3);
  const bottomCount = Math.floor(candidates.length * 0.3);

  const smartMoney = candidates.slice(0, topCount).map((c) => c.address);
  const baseline = candidates.slice(candidates.length - bottomCount).map((c) => c.address);

  log(`Birdeye 种子分组完成: 候选 ${candidates.length} 个, 聪明钱 ${smartMoney.length} 个, 基线 ${baseline.length} 个`);

  return { smartMoney, baseline };
}

/** 从已采集的 JSON 文件中提取所有买入交易 */
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

/** 生成日期字符串 YYYY-MM-DD */
function todayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function main(): Promise<void> {
  const cliArgs = parseArgs(process.argv.slice(2));

  if (cliArgs.help) {
    printHelp();
    process.exit(0);
  }

  // 检查必须的环境变量
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) {
    console.error('错误: 缺少环境变量 BIRDEYE_API_KEY');
    console.error('请设置后重试: export BIRDEYE_API_KEY=your_key_here');
    process.exit(1);
  }

  const walletsFile = resolve(cliArgs.walletsFile);
  const outputDir = resolve(cliArgs.outputDir);

  log(`钱包文件: ${walletsFile}`);
  log(`输出目录: ${outputDir}`);

  // 1. 读取钱包地址列表
  log('读取钱包地址列表...');
  const addresses = await loadWalletAddresses(walletsFile);

  // 创建限流器（30 req/min，Birdeye 免费层限制）
  const rateLimiter = createRateLimiter(30);

  // Results will be populated by either seed mode or config file mode
  let smartMoneyResults: PriceTrackResult[];
  let baselineResults: PriceTrackResult[];

  // Determine whether to use Birdeye seed mode
  const useSeedMode = cliArgs.seedFromBirdeye || addresses.length === 0;

  if (useSeedMode) {
    // --- Birdeye seed mode: auto-fetch + split into two groups ---
    if (addresses.length === 0) {
      log('钱包配置为空，自动切换到 Birdeye 种子模式');
    } else {
      log('--seed-from-birdeye 已指定，使用 Birdeye 种子模式');
    }

    const groups = await seedFromBirdeye(apiKey);

    const smartMoneyCollectDir = join(outputDir, 'smart-money');
    const baselineCollectDir = join(outputDir, 'baseline');

    // 2. 采集阶段 — smart money group
    if (!cliArgs.skipCollect) {
      log(`开始采集聪明钱组交易数据（${groups.smartMoney.length} 个钱包）...`);
      const smProgress = await collectAllWallets(apiKey, groups.smartMoney, {
        outputDir: smartMoneyCollectDir,
        rateLimiter,
        onProgress: (p: CollectionProgress) => {
          const total = p.completed + p.failed + p.skipped;
          log(`  聪明钱组进度: ${total}/${p.totalWallets} (成功=${p.completed} 失败=${p.failed} 跳过=${p.skipped})`);
        },
      });
      log(`聪明钱组采集完成: 成功=${smProgress.completed} 失败=${smProgress.failed} 跳过=${smProgress.skipped}`);

      log(`开始采集基线组交易数据（${groups.baseline.length} 个钱包）...`);
      const blProgress = await collectAllWallets(apiKey, groups.baseline, {
        outputDir: baselineCollectDir,
        rateLimiter,
        onProgress: (p: CollectionProgress) => {
          const total = p.completed + p.failed + p.skipped;
          log(`  基线组进度: ${total}/${p.totalWallets} (成功=${p.completed} 失败=${p.failed} 跳过=${p.skipped})`);
        },
      });
      log(`基线组采集完成: 成功=${blProgress.completed} 失败=${blProgress.failed} 跳过=${blProgress.skipped}`);
    } else {
      log('跳过采集阶段（--skip-collect）');
    }

    // 3. 读取已采集数据
    log('读取聪明钱组已采集数据...');
    const smartMoneyBuyTrades = await loadBuyTrades(smartMoneyCollectDir);
    log(`聪明钱组共 ${smartMoneyBuyTrades.length} 笔买入交易`);

    log('读取基线组已采集数据...');
    const baselineBuyTrades = await loadBuyTrades(baselineCollectDir);
    log(`基线组共 ${baselineBuyTrades.length} 笔买入交易`);

    if (smartMoneyBuyTrades.length === 0) {
      console.error('错误: 聪明钱组没有找到任何买入交易数据');
      process.exit(1);
    }

    // 4. 追踪价格
    log('开始追踪聪明钱组交易价格表现...');
    smartMoneyResults = await trackAllTrades(smartMoneyBuyTrades, apiKey, rateLimiter);
    log(`聪明钱组价格追踪完成: ${smartMoneyResults.length} 笔交易`);

    log('开始追踪基线组交易价格表现...');
    baselineResults = await trackAllTrades(baselineBuyTrades, apiKey, rateLimiter);
    log(`基线组价格追踪完成: ${baselineResults.length} 笔交易`);
  } else {
    // --- Config file mode: backward compatible ---
    const collectDir = join(outputDir, 'wallets');
    log(`使用配置文件模式: ${addresses.length} 个钱包地址`);

    // 2. 采集阶段
    if (!cliArgs.skipCollect) {
      log('开始采集钱包交易数据...');
      const progress = await collectAllWallets(apiKey, addresses, {
        outputDir: collectDir,
        rateLimiter,
        onProgress: (p: CollectionProgress) => {
          const total = p.completed + p.failed + p.skipped;
          log(`  进度: ${total}/${p.totalWallets} (成功=${p.completed} 失败=${p.failed} 跳过=${p.skipped})`);
        },
      });
      log(`采集完成: 成功=${progress.completed} 失败=${progress.failed} 跳过=${progress.skipped}`);
    } else {
      log('跳过采集阶段（--skip-collect）');
    }

    // 3. 读取已采集数据，提取买入交易
    log('读取已采集数据...');
    const buyTrades = await loadBuyTrades(collectDir);
    log(`共 ${buyTrades.length} 笔买入交易`);

    if (buyTrades.length === 0) {
      console.error('错误: 没有找到任何买入交易数据');
      console.error('请先运行采集阶段（不带 --skip-collect）');
      process.exit(1);
    }

    // 4. 追踪价格
    log('开始追踪交易价格表现...');
    smartMoneyResults = await trackAllTrades(buyTrades, apiKey, rateLimiter);
    log(`价格追踪完成: ${smartMoneyResults.length} 笔交易`);

    // 5. 基线对照组 — config mode uses empty baseline (backward compatible)
    baselineResults = await trackAllTrades([], apiKey, rateLimiter);
  }

  // 6. 生成报告
  log('生成回测报告...');
  const report = generateReport(smartMoneyResults, baselineResults);
  const markdown = formatMarkdownReport(report);

  // 7. 写入报告文件
  await mkdir(outputDir, { recursive: true });
  const reportFileName = `report-${todayString()}.md`;
  const reportPath = join(outputDir, reportFileName);
  await writeFile(reportPath, markdown);
  log(`报告已写入: ${reportPath}`);

  // 8. 输出到 stdout
  console.log(markdown);
}

// Only run main() when executed directly (not when imported for testing)
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('/cli.ts') || process.argv[1].endsWith('/cli.js'));

if (isDirectRun) {
  main().catch((error: unknown) => {
    if (error instanceof Error) {
      // 认证错误给出明确提示
      if (error.message.includes('authentication failed')) {
        console.error('错误: Birdeye API 认证失败，请检查 BIRDEYE_API_KEY 是否正确');
      } else {
        console.error(`错误: ${error.message}`);
      }
    } else {
      console.error('发生未知错误', error);
    }
    process.exit(1);
  });
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WalletCandidate } from '@radar/shared';
import type { BacktestProgress, CollectionProgress, PriceTrackResult } from '../../../src/scripts/backtest/types.js';

// Mock external dependencies before importing runner
vi.mock('../../../src/discovery/birdeye.js', () => ({
  fetchTopWallets: vi.fn<() => Promise<WalletCandidate[]>>(),
}));

vi.mock('../../../src/scripts/backtest/collect.js', () => ({
  collectAllWallets: vi.fn(),
}));

vi.mock('../../../src/scripts/backtest/track-prices.js', () => ({
  trackAllTrades: vi.fn(),
}));

vi.mock('../../../src/scripts/backtest/analyze.js', () => ({
  generateReport: vi.fn(),
}));

vi.mock('../../../src/scripts/backtest/report.js', () => ({
  formatMarkdownReport: vi.fn(),
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...original,
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
  };
});

import { BacktestRunner } from '../../../src/scripts/backtest/runner.js';
import { fetchTopWallets } from '../../../src/discovery/birdeye.js';
import { collectAllWallets } from '../../../src/scripts/backtest/collect.js';
import { trackAllTrades } from '../../../src/scripts/backtest/track-prices.js';
import { generateReport } from '../../../src/scripts/backtest/analyze.js';
import { formatMarkdownReport } from '../../../src/scripts/backtest/report.js';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';

/** Generate N wallet candidates with descending PnL */
function makeCandidates(count: number, startPnl = 1000): WalletCandidate[] {
  return Array.from({ length: count }, (_, i) => ({
    address: `Wallet${String(i + 1).padStart(3, '0')}`,
    pnl: startPnl - i * 10,
    winRate: 0.5,
    tradeCount: 100,
    lastActiveTimestamp: Date.now(),
  }));
}

/** Create mock PriceTrackResult array */
function makePriceTrackResults(count: number): PriceTrackResult[] {
  return Array.from({ length: count }, (_, i) => ({
    tradeSignature: `sig-${i}`,
    tokenMint: `mint-${i}`,
    buyTimestamp: Date.now() / 1000 - 86400,
    buyPrice: 1.0,
    returns: { h1: 5, h24: 10, d7: 20 },
    noData: false,
  }));
}

describe('BacktestRunner', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // fs mocks
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(readdir).mockResolvedValue(['wallet1.json'] as unknown as import('node:fs').Dirent[]);
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({
        address: 'Wallet001',
        trades: [
          { address: 'Wallet001', signature: 'sig1', tokenMint: 'mint1', type: 'buy', timestamp: 1000, amount: 1 },
        ],
        collectedAt: new Date().toISOString(),
      }),
    );

    // Default mock: collectAllWallets resolves with progress
    vi.mocked(collectAllWallets).mockResolvedValue({
      totalWallets: 5,
      completed: 5,
      failed: 0,
      skipped: 0,
    } satisfies CollectionProgress);

    // Default mock: trackAllTrades returns results
    vi.mocked(trackAllTrades).mockResolvedValue(makePriceTrackResults(3));

    // Default mock: generateReport returns a valid report
    vi.mocked(generateReport).mockReturnValue({
      smartMoneyStats: {
        totalTrades: 3,
        winRate24h: 0.6,
        avgReturn24h: 10,
        maxDrawdown: -20,
        profitConcentration: 0.5,
        noDataRatio: 0.1,
      },
      baselineStats: {
        totalTrades: 3,
        winRate24h: 0.4,
        avgReturn24h: 2,
        maxDrawdown: -30,
        profitConcentration: 0.6,
        noDataRatio: 0.2,
      },
      passed: true,
      dataReliable: true,
      generatedAt: new Date().toISOString(),
    });

    vi.mocked(formatMarkdownReport).mockReturnValue('# Report');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls onProgress with phases in correct order', async () => {
    const candidates = makeCandidates(20);
    vi.mocked(fetchTopWallets).mockResolvedValueOnce(candidates);

    const phases: string[] = [];
    const runner = new BacktestRunner({
      birdeyeApiKey: 'test-birdeye-key',
      heliusApiKey: 'test-helius-key',
      outputDir: '/tmp/test-backtest',
      onProgress: (event: BacktestProgress) => {
        // Record unique phase transitions
        if (phases.length === 0 || phases[phases.length - 1] !== event.phase) {
          phases.push(event.phase);
        }
      },
    });

    await runner.run();

    expect(phases).toEqual([
      'seed',
      'collect-smart',
      'collect-baseline',
      'track-smart',
      'track-baseline',
      'analyze',
    ]);
  });

  it('returns a valid BacktestReport with smartMoneyStats and baselineStats', async () => {
    const candidates = makeCandidates(20);
    vi.mocked(fetchTopWallets).mockResolvedValueOnce(candidates);

    const runner = new BacktestRunner({
      birdeyeApiKey: 'test-birdeye-key',
      heliusApiKey: 'test-helius-key',
      outputDir: '/tmp/test-backtest',
    });

    const report = await runner.run();

    expect(report).toHaveProperty('smartMoneyStats');
    expect(report).toHaveProperty('baselineStats');
    expect(report).toHaveProperty('passed');
    expect(report).toHaveProperty('dataReliable');
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('dataSource');
    expect(report.smartMoneyStats.totalTrades).toBe(3);
    expect(report.baselineStats.totalTrades).toBe(3);
  });

  it('throws when fetchTopWallets returns < 10 candidates', async () => {
    const candidates = makeCandidates(5);
    vi.mocked(fetchTopWallets).mockResolvedValueOnce(candidates);

    const runner = new BacktestRunner({
      birdeyeApiKey: 'test-birdeye-key',
      heliusApiKey: 'test-helius-key',
      outputDir: '/tmp/test-backtest',
    });

    await expect(runner.run()).rejects.toThrow(
      '钱包候选数量不足（需要至少 10 个，实际 5 个）',
    );
  });

  it('progress percent reaches 100 at completion', async () => {
    const candidates = makeCandidates(20);
    vi.mocked(fetchTopWallets).mockResolvedValueOnce(candidates);

    let maxPercent = 0;
    const runner = new BacktestRunner({
      birdeyeApiKey: 'test-birdeye-key',
      heliusApiKey: 'test-helius-key',
      outputDir: '/tmp/test-backtest',
      onProgress: (event: BacktestProgress) => {
        if (event.percent > maxPercent) maxPercent = event.percent;
      },
    });

    await runner.run();

    expect(maxPercent).toBe(100);
  });

  it('attaches Birdeye dataSource metadata to the report', async () => {
    const candidates = makeCandidates(20);
    vi.mocked(fetchTopWallets).mockResolvedValueOnce(candidates);

    const runner = new BacktestRunner({
      birdeyeApiKey: 'test-birdeye-key',
      heliusApiKey: 'test-helius-key',
      outputDir: '/tmp/test-backtest',
    });

    const report = await runner.run();

    expect(report.dataSource).toBeDefined();
    expect(report.dataSource?.smartMoney).toContain('PnL 前 30%');
    expect(report.dataSource?.baseline).toContain('PnL 后 30%');
  });
});

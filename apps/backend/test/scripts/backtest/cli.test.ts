import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WalletCandidate } from '@radar/shared';

// Mock birdeye module before importing cli
vi.mock('../../../src/discovery/birdeye.js', () => ({
  fetchTopWallets: vi.fn<() => Promise<WalletCandidate[]>>(),
}));

import { seedFromBirdeye } from '../../../src/scripts/backtest/cli.js';
import { fetchTopWallets } from '../../../src/discovery/birdeye.js';

/** Generate N wallet candidates with descending PnL from startPnl */
function makeCandidates(count: number, startPnl = 1000): WalletCandidate[] {
  return Array.from({ length: count }, (_, i) => ({
    address: `Wallet${String(i + 1).padStart(3, '0')}`,
    pnl: startPnl - i * 10,
    winRate: 0.5,
    tradeCount: 100,
    lastActiveTimestamp: Date.now(),
  }));
}

describe('seedFromBirdeye', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('50 个候选 → 15 聪明钱 + 15 基线，无重叠', async () => {
    const candidates = makeCandidates(50);
    vi.mocked(fetchTopWallets).mockResolvedValueOnce(candidates);

    const groups = await seedFromBirdeye('test-key');

    expect(groups.smartMoney).toHaveLength(15);
    expect(groups.baseline).toHaveLength(15);

    // No overlap
    const overlap = groups.smartMoney.filter((addr) => groups.baseline.includes(addr));
    expect(overlap).toHaveLength(0);
  });

  it('聪明钱组包含 PnL 最高的地址', async () => {
    const candidates = makeCandidates(50, 1000);
    vi.mocked(fetchTopWallets).mockResolvedValueOnce(candidates);

    const groups = await seedFromBirdeye('test-key');

    // Top 15 by PnL should be Wallet001..Wallet015
    expect(groups.smartMoney).toContain('Wallet001');
    expect(groups.smartMoney).toContain('Wallet015');
    expect(groups.smartMoney).not.toContain('Wallet016');
  });

  it('基线组包含 PnL 最低的地址', async () => {
    const candidates = makeCandidates(50, 1000);
    vi.mocked(fetchTopWallets).mockResolvedValueOnce(candidates);

    const groups = await seedFromBirdeye('test-key');

    // Bottom 15 by PnL should be Wallet036..Wallet050
    expect(groups.baseline).toContain('Wallet050');
    expect(groups.baseline).toContain('Wallet036');
    expect(groups.baseline).not.toContain('Wallet035');
  });

  it('候选数量不足 20 个时抛出描述性错误', async () => {
    const candidates = makeCandidates(15);
    vi.mocked(fetchTopWallets).mockResolvedValueOnce(candidates);

    await expect(seedFromBirdeye('test-key')).rejects.toThrow('钱包候选数量不足');
  });

  it('0 个候选时抛出错误', async () => {
    vi.mocked(fetchTopWallets).mockResolvedValueOnce([]);

    await expect(seedFromBirdeye('test-key')).rejects.toThrow('钱包候选数量不足');
  });

  it('19 个候选时抛出错误（低于 MIN_CANDIDATES_FAIL=20）', async () => {
    const candidates = makeCandidates(19);
    vi.mocked(fetchTopWallets).mockResolvedValueOnce(candidates);

    await expect(seedFromBirdeye('test-key')).rejects.toThrow('钱包候选数量不足');
  });

  it('20~49 个候选时打印 WARNING 并继续执行（低质量模式）', async () => {
    const candidates = makeCandidates(30);
    vi.mocked(fetchTopWallets).mockResolvedValueOnce(candidates);
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const groups = await seedFromBirdeye('test-key');

    // Should succeed, not throw
    expect(groups.smartMoney).toHaveLength(9); // floor(30 * 0.3)
    expect(groups.baseline).toHaveLength(9);
    // Warning should have been emitted
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[WARNING]'));
    stderrSpy.mockRestore();
  });

  it('恰好 20 个候选时打印 WARNING 并继续（刚好等于 FAIL 阈值）', async () => {
    const candidates = makeCandidates(20);
    vi.mocked(fetchTopWallets).mockResolvedValueOnce(candidates);
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const groups = await seedFromBirdeye('test-key');

    // floor(20 * 0.3) = 6
    expect(groups.smartMoney).toHaveLength(6);
    expect(groups.baseline).toHaveLength(6);
    // WARNING emitted (20 < MIN_CANDIDATES_WARN=50)
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[WARNING]'));

    const overlap = groups.smartMoney.filter((addr) => groups.baseline.includes(addr));
    expect(overlap).toHaveLength(0);
    stderrSpy.mockRestore();
  });

  it('恰好 50 个候选时正常工作（无警告）', async () => {
    const candidates = makeCandidates(50);
    vi.mocked(fetchTopWallets).mockResolvedValueOnce(candidates);
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const groups = await seedFromBirdeye('test-key');

    // floor(50 * 0.3) = 15
    expect(groups.smartMoney).toHaveLength(15);
    expect(groups.baseline).toHaveLength(15);
    // No WARNING for >=50 candidates
    const warnCalls = stderrSpy.mock.calls.filter((c) =>
      String(c[0]).includes('[WARNING]'),
    );
    expect(warnCalls).toHaveLength(0);
    stderrSpy.mockRestore();
  });

  it('恰好 49 个候选时打印 WARNING（WARN 边界下方）', async () => {
    const candidates = makeCandidates(49);
    vi.mocked(fetchTopWallets).mockResolvedValueOnce(candidates);
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const groups = await seedFromBirdeye('test-key');

    // floor(49 * 0.3) = 14 per group
    expect(groups.smartMoney).toHaveLength(14);
    expect(groups.baseline).toHaveLength(14);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[WARNING]'));
    stderrSpy.mockRestore();
  });

  it('恰好 51 个候选时正常工作（无警告）', async () => {
    const candidates = makeCandidates(51);
    vi.mocked(fetchTopWallets).mockResolvedValueOnce(candidates);
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const groups = await seedFromBirdeye('test-key');

    // floor(51 * 0.3) = 15 per group
    expect(groups.smartMoney).toHaveLength(15);
    expect(groups.baseline).toHaveLength(15);
    const warnCalls = stderrSpy.mock.calls.filter((c) => String(c[0]).includes('[WARNING]'));
    expect(warnCalls).toHaveLength(0);
    stderrSpy.mockRestore();
  });

  it('按 PnL 降序排列后再分组（乱序输入）', async () => {
    // Provide 25 candidates in random order (above MIN_CANDIDATES_FAIL=20)
    const candidates: WalletCandidate[] = [
      { address: 'Low1', pnl: -100, winRate: 0.3, tradeCount: 50, lastActiveTimestamp: 0 },
      { address: 'High1', pnl: 900, winRate: 0.8, tradeCount: 200, lastActiveTimestamp: 0 },
      { address: 'Mid1', pnl: 200, winRate: 0.5, tradeCount: 100, lastActiveTimestamp: 0 },
      { address: 'High2', pnl: 800, winRate: 0.7, tradeCount: 150, lastActiveTimestamp: 0 },
      { address: 'Low2', pnl: -50, winRate: 0.4, tradeCount: 60, lastActiveTimestamp: 0 },
      { address: 'Mid2', pnl: 300, winRate: 0.5, tradeCount: 100, lastActiveTimestamp: 0 },
      { address: 'High3', pnl: 700, winRate: 0.6, tradeCount: 120, lastActiveTimestamp: 0 },
      { address: 'Low3', pnl: -200, winRate: 0.2, tradeCount: 40, lastActiveTimestamp: 0 },
      { address: 'Mid3', pnl: 100, winRate: 0.5, tradeCount: 80, lastActiveTimestamp: 0 },
      { address: 'Mid4', pnl: 400, winRate: 0.5, tradeCount: 90, lastActiveTimestamp: 0 },
      { address: 'Mid5', pnl: 350, winRate: 0.5, tradeCount: 90, lastActiveTimestamp: 0 },
      { address: 'Mid6', pnl: 250, winRate: 0.5, tradeCount: 90, lastActiveTimestamp: 0 },
      { address: 'Mid7', pnl: 150, winRate: 0.5, tradeCount: 90, lastActiveTimestamp: 0 },
      { address: 'Mid8', pnl: 50, winRate: 0.5, tradeCount: 90, lastActiveTimestamp: 0 },
      { address: 'Mid9', pnl: -10, winRate: 0.5, tradeCount: 90, lastActiveTimestamp: 0 },
      { address: 'Mid10', pnl: 500, winRate: 0.5, tradeCount: 90, lastActiveTimestamp: 0 },
      { address: 'Mid11', pnl: 450, winRate: 0.5, tradeCount: 90, lastActiveTimestamp: 0 },
      { address: 'Mid12', pnl: 550, winRate: 0.5, tradeCount: 90, lastActiveTimestamp: 0 },
      { address: 'Mid13', pnl: 600, winRate: 0.5, tradeCount: 90, lastActiveTimestamp: 0 },
      { address: 'Mid14', pnl: 650, winRate: 0.5, tradeCount: 90, lastActiveTimestamp: 0 },
      { address: 'Low4', pnl: -300, winRate: 0.2, tradeCount: 40, lastActiveTimestamp: 0 },
      { address: 'Low5', pnl: -150, winRate: 0.2, tradeCount: 40, lastActiveTimestamp: 0 },
      { address: 'Low6', pnl: -250, winRate: 0.2, tradeCount: 40, lastActiveTimestamp: 0 },
      { address: 'Low7', pnl: -350, winRate: 0.2, tradeCount: 40, lastActiveTimestamp: 0 },
      { address: 'Low8', pnl: -400, winRate: 0.2, tradeCount: 40, lastActiveTimestamp: 0 },
    ];
    vi.mocked(fetchTopWallets).mockResolvedValueOnce(candidates);
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const groups = await seedFromBirdeye('test-key');

    // floor(25 * 0.3) = 7 per group
    expect(groups.smartMoney).toHaveLength(7);
    expect(groups.baseline).toHaveLength(7);
    // Top 7 by PnL: High1(900), High2(800), High3(700), Mid14(650), Mid13(600), Mid12(550), Mid10(500)
    expect(groups.smartMoney[0]).toBe('High1');
    expect(groups.smartMoney[1]).toBe('High2');
    // Bottom 7: Low8(-400), Low7(-350), Low4(-300), Low6(-250), Low3(-200), Low5(-150), Low1(-100)
    expect(groups.baseline).toContain('Low8');
    expect(groups.baseline).toContain('Low7');
    stderrSpy.mockRestore();
  });
});

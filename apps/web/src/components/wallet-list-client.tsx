'use client';

// 钱包列表客户端组件 — 排序/筛选/视图切换
import { useState, useMemo } from 'react';
import type { WalletRow } from '@/lib/backend-client';
import { WalletCard } from '@/components/wallet-card';
import { GlassCard } from '@/components/ui/glass-card';
import { LayoutGrid, List, ArrowUpDown } from 'lucide-react';

type SortKey = 'score' | 'pnl' | 'winRate';
type SourceFilter = 'all' | 'pinned' | 'discovered';
type ViewMode = 'grid' | 'list';

interface WalletListClientProps {
  wallets: WalletRow[];
}

export function WalletListClient({ wallets }: WalletListClientProps) {
  const [sortBy, setSortBy] = useState<SortKey>('score');
  const [source, setSource] = useState<SourceFilter>('all');
  const [view, setView] = useState<ViewMode>('grid');

  const filtered = useMemo(() => {
    let result = wallets;
    if (source !== 'all') {
      result = result.filter((w) => w.source === source);
    }
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return (b.compositeScore ?? 0) - (a.compositeScore ?? 0);
        case 'pnl':
          return (b.pnl ?? 0) - (a.pnl ?? 0);
        case 'winRate':
          return (b.winRate ?? 0) - (a.winRate ?? 0);
      }
    });
  }, [wallets, sortBy, source]);

  return (
    <>
      {/* 工具栏 */}
      <GlassCard className="mb-6 flex flex-wrap items-center gap-4 px-4 py-3" hover={false}>
        {/* 排序 */}
        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-smr-text-muted" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="cursor-pointer rounded-md border border-[var(--smr-glass-border)] bg-[var(--smr-bg-elevated)] px-3 py-1.5 text-xs text-smr-text outline-none focus:border-[var(--smr-accent-cyan)]"
          >
            <option value="score">评分排序</option>
            <option value="pnl">PNL 排序</option>
            <option value="winRate">胜率排序</option>
          </select>
        </div>

        {/* 来源筛选 */}
        <div className="flex gap-1">
          {([['all', '全部'], ['pinned', '人工'], ['discovered', '自动']] as const).map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => setSource(key)}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  source === key
                    ? 'bg-[var(--smr-accent-cyan)]/10 text-[var(--smr-accent-cyan)]'
                    : 'text-smr-text-muted hover:bg-[var(--smr-bg-hover)] hover:text-smr-text'
                }`}
                style={{ transition: 'all var(--smr-transition-fast)' }}
              >
                {label}
              </button>
            ),
          )}
        </div>

        {/* 间隔 */}
        <div className="flex-1" />

        {/* 视图切换 */}
        <div className="flex gap-1 rounded-md border border-[var(--smr-glass-border)] p-0.5">
          <button
            onClick={() => setView('grid')}
            className={`cursor-pointer rounded p-1.5 transition ${view === 'grid' ? 'bg-[var(--smr-accent-cyan)]/10 text-[var(--smr-accent-cyan)]' : 'text-smr-text-muted hover:text-smr-text'}`}
            aria-label="网格视图"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => setView('list')}
            className={`cursor-pointer rounded p-1.5 transition ${view === 'list' ? 'bg-[var(--smr-accent-cyan)]/10 text-[var(--smr-accent-cyan)]' : 'text-smr-text-muted hover:text-smr-text'}`}
            aria-label="列表视图"
          >
            <List size={14} />
          </button>
        </div>
      </GlassCard>

      {/* 结果数 */}
      <div className="mb-4 text-xs text-smr-text-muted">
        显示 {filtered.length} 个钱包
      </div>

      {/* 钱包列表 */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((wallet) => (
            <WalletCard key={wallet.id} wallet={wallet} view="grid" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((wallet) => (
            <WalletCard key={wallet.id} wallet={wallet} view="list" />
          ))}
        </div>
      )}
    </>
  );
}

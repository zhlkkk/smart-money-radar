'use client';

// 钱包卡片 — ScoreRing + 评分可视化 + PNL 颜色 + Badge
// 需要 'use client' 因为内含 Recharts 组件

import Link from 'next/link';
import type { WalletRow } from '@/lib/backend-client';
import { truncateAddress, formatPercent, formatPnl } from '@/lib/format';
import { GlassCard } from '@/components/ui/glass-card';
import { ScoreRing } from '@/components/ui/score-ring';
import { MiniPieChart } from '@/components/ui/mini-pie-chart';
import { Badge } from '@/components/ui/badge';

interface WalletCardProps {
  wallet: WalletRow;
  view?: 'grid' | 'list';
}

export function WalletCard({ wallet, view = 'grid' }: WalletCardProps) {
  const pnlColor =
    wallet.pnl == null
      ? 'text-smr-text-muted'
      : wallet.pnl >= 0
        ? 'text-[var(--smr-accent-green)]'
        : 'text-[var(--smr-accent-red)]';

  const sourceVariant = wallet.source === 'pinned' ? 'cyan' : 'green';
  const sourceLabel = wallet.source === 'pinned' ? '人工标记' : '自动发现';

  if (view === 'list') {
    return (
      <Link href={`/dashboard/wallets/${wallet.address}`}>
        <GlassCard className="group flex cursor-pointer items-center gap-4 px-4 py-3">
          <ScoreRing score={wallet.compositeScore} size={36} strokeWidth={2.5} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-smr-text group-hover:text-[var(--smr-accent-cyan)]" style={{ transition: 'color var(--smr-transition-fast)' }}>
                {wallet.label ?? truncateAddress(wallet.address)}
              </span>
              <Badge variant={sourceVariant}>{sourceLabel}</Badge>
            </div>
            {wallet.label && (
              <span className="font-data text-xs text-smr-text-muted">
                {truncateAddress(wallet.address)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-6 text-right">
            <div>
              <div className="text-[10px] text-smr-text-muted">胜率</div>
              <div className="font-data text-sm text-smr-text">{formatPercent(wallet.winRate)}</div>
            </div>
            <div>
              <div className="text-[10px] text-smr-text-muted">PNL</div>
              <div className={`font-data text-sm font-medium ${pnlColor}`}>{formatPnl(wallet.pnl)}</div>
            </div>
            <div>
              <div className="text-[10px] text-smr-text-muted">交易</div>
              <div className="font-data text-sm text-smr-text">{wallet.tradeCount ?? '-'}</div>
            </div>
          </div>
        </GlassCard>
      </Link>
    );
  }

  return (
    <Link href={`/dashboard/wallets/${wallet.address}`}>
      <GlassCard className="group cursor-pointer p-4 transition-transform hover:scale-[1.01]">
        {/* 头部：Badge + 地址 */}
        <div className="mb-4 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-smr-text group-hover:text-[var(--smr-accent-cyan)]" style={{ transition: 'color var(--smr-transition-fast)' }}>
              {wallet.label ?? truncateAddress(wallet.address)}
            </span>
            {wallet.label && (
              <span className="font-data mt-0.5 block text-xs text-smr-text-muted">
                {truncateAddress(wallet.address)}
              </span>
            )}
          </div>
          <Badge variant={sourceVariant}>{sourceLabel}</Badge>
        </div>

        {/* 评分 + 胜率可视化 */}
        <div className="mb-4 flex items-center justify-around">
          <div className="flex flex-col items-center">
            <ScoreRing score={wallet.compositeScore} size={52} />
            <span className="mt-1 text-[10px] text-smr-text-muted">评分</span>
          </div>
          <div className="flex flex-col items-center">
            <MiniPieChart
              value={wallet.winRate}
              size={48}
              color="var(--smr-accent-green)"
            />
            <span className="mt-1 text-[10px] text-smr-text-muted">胜率</span>
          </div>
        </div>

        {/* PNL + 交易次数 */}
        <div className="grid grid-cols-2 gap-3 border-t border-[var(--smr-glass-border)] pt-3">
          <div>
            <div className="text-[10px] text-smr-text-muted">PNL</div>
            <div className={`font-data text-sm font-medium ${pnlColor}`}>
              {formatPnl(wallet.pnl)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-smr-text-muted">交易次数</div>
            <div className="font-data text-sm text-smr-text">
              {wallet.tradeCount ?? <span className="text-smr-text-muted">等待数据</span>}
            </div>
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}

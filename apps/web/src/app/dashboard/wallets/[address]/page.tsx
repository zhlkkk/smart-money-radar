// 钱包详情页 — Glassmorphism 指标卡片 + ScoreRing

export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getWalletDetail } from '@/lib/backend-client';
import { AlertCard } from '@/components/alert-card';
import { GlassCard } from '@/components/ui/glass-card';
import { ScoreRing } from '@/components/ui/score-ring';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  truncateAddress,
  formatPercent,
  formatPnl,
} from '@/lib/format';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface WalletDetailPageProps {
  params: Promise<{ address: string }>;
}

export default async function WalletDetailPage({
  params,
}: WalletDetailPageProps) {
  const { address } = await params;
  const result = await getWalletDetail(address);

  if (!result) {
    notFound();
  }

  const { wallet, recentAlerts } = result;

  const pnlColor =
    wallet.pnl != null && wallet.pnl >= 0
      ? 'text-[var(--smr-accent-green)]'
      : 'text-[var(--smr-accent-red)]';

  return (
    <div className="mx-auto max-w-3xl">
      {/* 返回链接 */}
      <Link
        href="/dashboard/wallets"
        className="mb-6 inline-flex cursor-pointer items-center gap-1 text-sm text-smr-text-muted transition hover:text-smr-text"
      >
        <ArrowLeft size={14} />
        返回钱包列表
      </Link>

      {/* 头部 */}
      <div className="mb-6 flex items-center gap-4">
        <ScoreRing score={wallet.compositeScore} size={64} strokeWidth={3.5} />
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-smr-text">
              {wallet.label ?? truncateAddress(wallet.address)}
            </h1>
            <Badge variant={wallet.source === 'pinned' ? 'cyan' : 'green'} size="md">
              {wallet.source === 'pinned' ? '人工标记' : '自动发现'}
            </Badge>
          </div>
          <p className="font-data mt-1 text-sm text-smr-text-muted">{wallet.address}</p>
          {wallet.category && (
            <Badge variant="muted" size="md" className="mt-2">
              {wallet.category}
            </Badge>
          )}
        </div>
      </div>

      {/* 指标卡片 */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <GlassCard className="p-4" hover={false}>
          <div className="text-xs text-smr-text-muted">综合评分</div>
          <div className="font-data mt-1 text-xl font-bold text-[var(--smr-accent-cyan)]">
            {wallet.compositeScore != null
              ? wallet.compositeScore.toFixed(1)
              : '-'}
          </div>
        </GlassCard>
        <GlassCard className="p-4" hover={false}>
          <div className="text-xs text-smr-text-muted">胜率</div>
          <div className="font-data mt-1 text-xl font-bold text-smr-text">
            {formatPercent(wallet.winRate)}
          </div>
        </GlassCard>
        <GlassCard className="p-4" hover={false}>
          <div className="text-xs text-smr-text-muted">PNL</div>
          <div className={`font-data mt-1 text-xl font-bold ${pnlColor}`}>
            {formatPnl(wallet.pnl)}
          </div>
        </GlassCard>
        <GlassCard className="p-4" hover={false}>
          <div className="text-xs text-smr-text-muted">交易次数</div>
          <div className="font-data mt-1 text-xl font-bold text-smr-text">
            {wallet.tradeCount != null ? String(wallet.tradeCount) : '-'}
          </div>
        </GlassCard>
      </div>

      {/* 关联告警 */}
      <h2 className="mb-4 text-lg font-medium text-smr-text-secondary">近期告警</h2>
      {recentAlerts.length === 0 ? (
        <EmptyState
          title="暂无关联告警"
          description="该钱包尚未触发交易告警"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {recentAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}

// 钱包详情页（Server Component）
// 展示钱包指标 + 关联告警

export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getWalletDetail } from '@/lib/backend-client';
import { AlertCard } from '@/components/alert-card';
import {
  truncateAddress,
  formatPercent,
  formatPnl,
} from '@/lib/format';

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
    wallet.pnl != null && wallet.pnl >= 0 ? 'text-[#00FF88]' : 'text-[#FF4444]';

  return (
    <div className="mx-auto max-w-3xl">
      {/* 头部 */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">
            {wallet.label ?? truncateAddress(wallet.address)}
          </h1>
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              wallet.source === 'pinned'
                ? 'bg-[#00F0FF]/10 text-[#00F0FF]'
                : 'bg-[#00FF88]/10 text-[#00FF88]'
            }`}
          >
            {wallet.source === 'pinned' ? '人工标记' : '自动发现'}
          </span>
        </div>
        <p className="mt-1 font-mono text-sm text-zinc-500">{wallet.address}</p>
        {wallet.category && (
          <span className="mt-2 inline-block rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {wallet.category}
          </span>
        )}
      </div>

      {/* 指标卡片 */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label="综合评分"
          value={
            wallet.compositeScore != null
              ? wallet.compositeScore.toFixed(1)
              : '-'
          }
          accent
        />
        <MetricCard
          label="胜率"
          value={formatPercent(wallet.winRate)}
        />
        <MetricCard
          label="PNL"
          value={formatPnl(wallet.pnl)}
          className={pnlColor}
        />
        <MetricCard
          label="交易次数"
          value={wallet.tradeCount != null ? String(wallet.tradeCount) : '-'}
        />
      </div>

      {/* 关联告警 */}
      <h2 className="mb-4 text-lg font-medium text-zinc-300">近期告警</h2>
      {recentAlerts.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-[#111111] py-8 text-center text-sm text-zinc-500">
          暂无关联告警
        </div>
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

// ─── 内部子组件 ───

interface MetricCardProps {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
}

function MetricCard({ label, value, accent, className }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-[#111111] p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div
        className={`mt-1 text-xl font-bold ${
          className ?? (accent ? 'text-[#00F0FF]' : 'text-white')
        }`}
      >
        {value}
      </div>
    </div>
  );
}

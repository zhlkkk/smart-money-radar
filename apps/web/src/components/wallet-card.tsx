// 钱包卡片组件（Server Component）
// 展示钱包概览信息，点击跳转详情页

import Link from 'next/link';
import type { WalletRow } from '@/lib/backend-client';
import { truncateAddress, formatPercent, formatPnl } from '@/lib/format';

interface WalletCardProps {
  wallet: WalletRow;
}

export function WalletCard({ wallet }: WalletCardProps) {
  const pnlColor =
    wallet.pnl == null
      ? 'text-white'
      : wallet.pnl >= 0
        ? 'text-[#00FF88]'
        : 'text-[#FF4444]';

  return (
    <Link
      href={`/dashboard/wallets/${wallet.address}`}
      className="block rounded-lg border border-zinc-800 bg-[#111111] p-4 transition hover:border-[#00F0FF]/30 hover:bg-[#111111]/80"
    >
      {/* 头部：地址 + 来源 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white">
            {wallet.label ?? truncateAddress(wallet.address)}
          </span>
          {wallet.label && (
            <span className="mt-0.5 text-xs text-zinc-500">
              {truncateAddress(wallet.address)}
            </span>
          )}
        </div>
        <span
          className={`rounded px-1.5 py-0.5 text-xs ${
            wallet.source === 'pinned'
              ? 'bg-[#00F0FF]/10 text-[#00F0FF]'
              : 'bg-[#00FF88]/10 text-[#00FF88]'
          }`}
        >
          {wallet.source === 'pinned' ? '人工标记' : '自动发现'}
        </span>
      </div>

      {/* 指标网格 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-zinc-500">综合评分</div>
          <div className="text-sm font-bold text-[#00F0FF]">
            {wallet.compositeScore != null
              ? wallet.compositeScore.toFixed(1)
              : '-'}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">胜率</div>
          <div className="text-sm font-medium text-white">
            {formatPercent(wallet.winRate)}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">PNL</div>
          <div className={`text-sm font-medium ${pnlColor}`}>
            {formatPnl(wallet.pnl)}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">交易次数</div>
          <div className="text-sm font-medium text-white">
            {wallet.tradeCount ?? '-'}
          </div>
        </div>
      </div>
    </Link>
  );
}

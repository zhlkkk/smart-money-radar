// 告警卡片组件（Server Component）
// 展示单条告警的详细信息

import type { AlertRow } from '@/lib/backend-client';
import { formatCompact, formatRelativeTime, truncateAddress } from '@/lib/format';

interface AlertCardProps {
  alert: AlertRow;
}

export function AlertCard({ alert }: AlertCardProps) {
  const hasFreezeAuthority = alert.freezeAuthority != null && alert.freezeAuthority !== '';

  return (
    <div className="rounded-lg border border-zinc-800 bg-[#111111] p-4 transition hover:border-zinc-700">
      {/* 顶部：时间 + 钱包 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">
            {alert.walletLabel ?? truncateAddress(alert.walletAddress)}
          </span>
          {alert.dexSource && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
              {alert.dexSource}
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-500">
          {formatRelativeTime(alert.createdAt)}
        </span>
      </div>

      {/* 代币信息 */}
      <div className="mb-3 flex items-center gap-3">
        <span className="text-base font-bold text-[#00F0FF]">
          {alert.tokenSymbol ?? '未知代币'}
        </span>
        <span className="text-xs text-zinc-500">
          {truncateAddress(alert.tokenMint)}
        </span>
      </div>

      {/* 指标行 */}
      <div className="mb-3 grid grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-zinc-500">流动性</div>
          <div className="text-sm font-medium text-white">
            ${formatCompact(alert.liquidity)}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">FDV</div>
          <div className="text-sm font-medium text-white">
            ${formatCompact(alert.fdv)}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">市值</div>
          <div className="text-sm font-medium text-white">
            ${formatCompact(alert.marketCap)}
          </div>
        </div>
      </div>

      {/* 风险标记 */}
      {hasFreezeAuthority && (
        <div className="mb-3 rounded bg-[#FF4444]/10 px-2 py-1 text-xs text-[#FF4444]">
          ⚠ Freeze Authority 存在
        </div>
      )}

      {/* AI 摘要 */}
      {alert.aiSummary && (
        <div className="rounded bg-zinc-900 px-3 py-2 text-sm leading-relaxed text-zinc-300">
          {alert.aiSummary}
        </div>
      )}
    </div>
  );
}

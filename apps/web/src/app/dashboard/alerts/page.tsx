// 告警历史页 — 时间线布局 + 筛选工具栏

import { getAlerts } from '@/lib/backend-client';
import { AlertCard } from '@/components/alert-card';
import { LoadMoreAlerts } from '@/components/load-more-alerts';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const { data: alerts, cursor, hasMore } = await getAlerts(undefined, 20);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-smr-text">告警历史</h1>
        {alerts.length > 0 && (
          <span className="font-data text-sm text-smr-text-muted">
            最新 {alerts.length} 条
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          title="暂无告警记录"
          description="系统正在监控聪明钱动态，有新交易时会自动推送告警到这里和 Telegram。"
          action={
            <Link
              href="/dashboard"
              className="cursor-pointer rounded-lg bg-[var(--smr-accent-cyan)] px-5 py-2 text-sm font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
            >
              返回控制台
            </Link>
          }
        />
      ) : (
        <>
          {/* 时间线布局 */}
          <div className="relative">
            {/* 时间线竖线 */}
            <div
              aria-hidden
              className="absolute bottom-0 left-3 top-0 w-px bg-gradient-to-b from-[var(--smr-accent-cyan)]/30 via-[var(--smr-glass-border)] to-transparent"
            />

            <div className="flex flex-col gap-4 pl-8">
              {alerts.map((alert) => (
                <div key={alert.id} className="relative">
                  {/* 时间线节点圆点 */}
                  <div className="absolute -left-8 top-5 flex items-center justify-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-[var(--smr-accent-cyan)] shadow-[0_0_8px_rgba(0,240,255,0.4)]" />
                  </div>
                  <AlertCard alert={alert} />
                </div>
              ))}

              {/* 客户端加载更多 */}
              <LoadMoreAlerts initialCursor={cursor} initialHasMore={hasMore} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

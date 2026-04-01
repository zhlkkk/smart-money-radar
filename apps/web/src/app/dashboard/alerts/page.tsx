// 告警历史页（Server Component）
// 首屏加载 20 条告警，支持游标分页加载更多

import { getAlerts } from '@/lib/backend-client';

export const dynamic = 'force-dynamic';
import { AlertCard } from '@/components/alert-card';
import { LoadMoreAlerts } from '@/components/load-more-alerts';

export default async function AlertsPage() {
  const { data: alerts, cursor, hasMore } = await getAlerts(undefined, 20);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-white">告警历史</h1>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-[#111111] py-16">
          <span className="mb-3 text-4xl">📡</span>
          <p className="text-zinc-400">暂无告警记录</p>
          <p className="mt-1 text-sm text-zinc-500">
            系统正在监控聪明钱动态，有新交易时会自动推送
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* 首屏服务端渲染的告警 */}
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}

          {/* 客户端加载更多 */}
          <LoadMoreAlerts initialCursor={cursor} initialHasMore={hasMore} />
        </div>
      )}
    </div>
  );
}

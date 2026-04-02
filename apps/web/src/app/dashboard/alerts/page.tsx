// 告警历史页 — 统一时间线布局（实时 + 历史）

import { getAlerts } from '@/lib/backend-client';
import { AlertCard } from '@/components/alert-card';
import { LoadMoreAlerts } from '@/components/load-more-alerts';
import { RealtimeAlerts } from '@/components/realtime-alerts';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const { data: alerts, cursor, hasMore } = await getAlerts(undefined, 20);
  const t = await getTranslations('alerts');
  const tCommon = await getTranslations('common');

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-smr-text">{t('title')}</h1>
        {alerts.length > 0 && (
          <span className="font-data text-sm text-smr-text-muted">
            {t('latest', { count: alerts.length })}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <>
          <RealtimeAlerts className="mb-6" />
          <EmptyState
            title={t('emptyTitle')}
            description={t('emptyDesc')}
            action={
              <Link
                href="/dashboard"
                className="cursor-pointer rounded-lg bg-[var(--smr-accent-cyan)] px-5 py-2 text-sm font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
              >
                {tCommon('enterDashboard')}
              </Link>
            }
          />
        </>
      ) : (
        <div className="relative pl-6">
          {/* 时间线竖线 — 居中于圆点 */}
          <div
            aria-hidden
            className="absolute bottom-0 left-[7px] top-0 w-px bg-gradient-to-b from-[var(--smr-accent-cyan)]/30 via-[var(--smr-glass-border)] to-transparent"
          />

          {/* 实时告警（也在时间线内） */}
          <RealtimeAlerts className="mb-4" timeline />

          {/* 历史告警 */}
          <div className="flex flex-col gap-4">
            {alerts.map((alert) => (
              <div key={alert.id} className="relative">
                {/* 时间线圆点 */}
                <div className="absolute -left-6 top-5 flex h-[15px] w-[15px] items-center justify-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-[var(--smr-accent-cyan)] shadow-[0_0_8px_rgba(0,240,255,0.4)]" />
                </div>
                <AlertCard alert={alert} />
              </div>
            ))}

            {/* 加载更多 */}
            <LoadMoreAlerts initialCursor={cursor} initialHasMore={hasMore} />
          </div>
        </div>
      )}
    </div>
  );
}

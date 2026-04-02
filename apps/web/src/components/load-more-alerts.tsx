'use client';

// 告警加载更多按钮 — 游标分页

import { useState, useTransition } from 'react';
import type { AlertRow } from '@/lib/backend-client';
import { AlertCard } from './alert-card';
import { useTranslations } from 'next-intl';

interface LoadMoreAlertsProps {
  initialCursor: string | null;
  initialHasMore: boolean;
}

export function LoadMoreAlerts({
  initialCursor,
  initialHasMore,
}: LoadMoreAlertsProps) {
  const t = useTranslations('alerts');
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleLoadMore() {
    if (!cursor || !hasMore) return;
    setError(false);

    startTransition(async () => {
      const params = new URLSearchParams({ limit: '20' });
      if (cursor) {
        params.set('cursor', cursor);
      }

      try {
        const res = await fetch(`/api/alerts?${params.toString()}`);
        if (!res.ok) {
          setError(true);
          return;
        }

        const data = (await res.json()) as {
          data: AlertRow[];
          cursor: string | null;
          hasMore: boolean;
        };

        setAlerts((prev) => [...prev, ...data.data]);
        setCursor(data.cursor);
        setHasMore(data.hasMore);
      } catch {
        setError(true);
      }
    });
  }

  return (
    <>
      {/* 动态加载的告警 */}
      {alerts.map((alert) => (
        <div key={alert.id} className="relative">
          <div className="absolute -left-6 top-5 flex h-[15px] w-[15px] items-center justify-center">
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--smr-accent-cyan)] shadow-[0_0_8px_rgba(0,240,255,0.4)]" />
          </div>
          <AlertCard alert={alert} />
        </div>
      ))}

      {/* 错误提示 */}
      {error && (
        <div className="glass-card mt-4 border-[var(--smr-accent-red)]/30 px-4 py-2.5 text-center text-sm text-[var(--smr-accent-red)]">
          {t('loadFailed')}
        </div>
      )}

      {/* 加载更多按钮 */}
      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={isPending}
          className="glass-card mt-4 w-full cursor-pointer py-2.5 text-center text-sm text-smr-text-muted transition hover:border-[var(--smr-border-hover)] hover:text-[var(--smr-accent-cyan)] disabled:opacity-50"
          style={{ transition: 'all var(--smr-transition-fast)' }}
        >
          {isPending ? t('loadingMore') : error ? t('retry') : t('loadMore')}
        </button>
      )}
    </>
  );
}

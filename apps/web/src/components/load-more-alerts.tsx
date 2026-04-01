'use client';

// 告警加载更多按钮（Client Component）
// 使用游标分页从后端获取下一页告警

import { useState, useTransition } from 'react';
import type { AlertRow } from '@/lib/backend-client';
import { AlertCard } from './alert-card';

interface LoadMoreAlertsProps {
  initialCursor: string | null;
  initialHasMore: boolean;
}

export function LoadMoreAlerts({
  initialCursor,
  initialHasMore,
}: LoadMoreAlertsProps) {
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
        <AlertCard key={alert.id} alert={alert} />
      ))}

      {/* 错误提示 */}
      {error && (
        <div className="mt-4 rounded-md border border-[#FF4444]/30 bg-[#FF4444]/10 px-4 py-2.5 text-center text-sm text-[#FF4444]">
          加载失败，请重试
        </div>
      )}

      {/* 加载更多按钮 */}
      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={isPending}
          className="mt-4 w-full rounded-md border border-zinc-800 bg-[#111111] py-2.5 text-sm text-zinc-400 transition hover:border-[#00F0FF]/30 hover:text-[#00F0FF] disabled:opacity-50"
        >
          {isPending ? '加载中...' : error ? '重试' : '加载更多'}
        </button>
      )}
    </>
  );
}

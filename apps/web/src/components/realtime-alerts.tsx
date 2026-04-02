'use client';

// SSE 实时告警监听 — 新告警插入列表顶部带入场动画
import { useEffect, useState, useRef } from 'react';
import type { AlertRow } from '@/lib/backend-client';
import { AlertCard } from '@/components/alert-card';

const SSE_URL = process.env.NEXT_PUBLIC_BACKEND_SSE_URL
  ?? (typeof window !== 'undefined' ? '' : '');

interface RealtimeAlertsProps {
  className?: string;
}

export function RealtimeAlerts({ className = '' }: RealtimeAlertsProps) {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!SSE_URL) return;

    const url = `${SSE_URL}/api/v1/alerts/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);

    es.addEventListener('alert', (event) => {
      try {
        const data = JSON.parse(event.data) as AlertRow;
        setAlerts((prev) => [data, ...prev].slice(0, 50)); // 最多保留 50 条实时告警
      } catch {
        // 忽略解析错误
      }
    });

    es.onerror = () => {
      setConnected(false);
      // EventSource 会自动重连
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className={className}>
      {/* 实时标识 */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full bg-[var(--smr-accent-green)]"
          style={{ animation: connected ? 'pulse-glow 2s ease-in-out infinite' : 'none' }}
        />
        <span className="text-xs font-medium text-[var(--smr-accent-green)]">
          LIVE
        </span>
        <span className="text-xs text-smr-text-muted">
          {alerts.length} new
        </span>
      </div>

      {/* 实时告警列表 */}
      <div className="flex flex-col gap-3">
        {alerts.map((alert, i) => (
          <div
            key={alert.id ?? alert.signature}
            style={{
              animation: i === 0 ? 'alert-slide-in 400ms ease-out' : 'none',
            }}
          >
            <AlertCard alert={alert} defaultExpanded />
          </div>
        ))}
      </div>
    </div>
  );
}

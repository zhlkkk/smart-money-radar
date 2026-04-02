'use client';

// SSE 实时告警 — 暂停/继续 + 入场动画
import { useEffect, useState, useRef, useCallback } from 'react';
import { Pause, Play } from 'lucide-react';
import type { AlertRow } from '@/lib/backend-client';
import { AlertCard } from '@/components/alert-card';

const SSE_PATH = '/api/alerts/stream';

interface RealtimeAlertsProps {
  className?: string;
}

export function RealtimeAlerts({ className = '' }: RealtimeAlertsProps) {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pausedRef = useRef(false);
  const pendingRef = useRef<AlertRow[]>([]);

  // 同步 ref 以便 SSE 回调读取最新值
  pausedRef.current = paused;

  const handleAlert = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as AlertRow;
      if (pausedRef.current) {
        // 暂停时缓存到待处理队列
        pendingRef.current = [data, ...pendingRef.current].slice(0, 50);
        setPendingCount(pendingRef.current.length);
      } else {
        setAlerts((prev) => [data, ...prev].slice(0, 50));
      }
    } catch {
      // 忽略解析错误
    }
  }, []);

  useEffect(() => {
    const es = new EventSource(SSE_PATH);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.addEventListener('alert', handleAlert);
    es.onerror = () => setConnected(false);

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [handleAlert]);

  function togglePause() {
    if (paused) {
      // 恢复：将缓存的告警合并到列表顶部
      setAlerts((prev) => [...pendingRef.current, ...prev].slice(0, 50));
      pendingRef.current = [];
      setPendingCount(0);
    }
    setPaused((p) => !p);
  }

  if (alerts.length === 0 && !paused) return null;

  return (
    <div className={className}>
      {/* 控制栏 */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${paused ? 'bg-[var(--smr-accent-gold)]' : 'bg-[var(--smr-accent-green)]'}`}
            style={{ animation: !paused && connected ? 'pulse-glow 2s ease-in-out infinite' : 'none' }}
          />
          <span className={`text-xs font-medium ${paused ? 'text-[var(--smr-accent-gold)]' : 'text-[var(--smr-accent-green)]'}`}>
            {paused ? 'PAUSED' : 'LIVE'}
          </span>
          <span className="text-xs text-smr-text-muted">
            {alerts.length} alerts
          </span>
        </div>

        {/* 暂停/继续按钮 */}
        <button
          onClick={togglePause}
          className={`cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            paused
              ? 'bg-[var(--smr-accent-green)]/10 text-[var(--smr-accent-green)] hover:bg-[var(--smr-accent-green)]/20'
              : 'bg-[var(--smr-bg-elevated)] text-smr-text-muted hover:bg-[var(--smr-bg-hover)] hover:text-smr-text'
          }`}
          style={{ transition: 'all var(--smr-transition-fast)' }}
        >
          {paused ? (
            <>
              <Play size={12} />
              Resume{pendingCount > 0 && ` (${pendingCount} new)`}
            </>
          ) : (
            <>
              <Pause size={12} />
              Pause
            </>
          )}
        </button>
      </div>

      {/* 实时告警列表 */}
      <div className="flex flex-col gap-3">
        {alerts.map((alert, i) => (
          <div
            key={alert.id ?? alert.signature}
            style={{
              animation: i === 0 && !paused ? 'alert-slide-in 400ms ease-out' : 'none',
            }}
          >
            <AlertCard alert={alert} defaultExpanded />
          </div>
        ))}
      </div>
    </div>
  );
}

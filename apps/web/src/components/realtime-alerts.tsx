'use client';

// SSE 实时告警 — 暂停/继续 + 入场动画
import { useEffect, useState, useRef, useCallback } from 'react';
import { Pause, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AlertRow } from '@/lib/backend-client';
import { AlertCard } from '@/components/alert-card';

const SSE_PATH = '/api/alerts/stream';

interface RealtimeAlertsProps {
  className?: string;
  timeline?: boolean;
}

export function RealtimeAlerts({ className = '', timeline = false }: RealtimeAlertsProps) {
  const t = useTranslations('alerts');
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

  return (
    <div className={className}>
      {/* 控制栏 */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${paused ? 'bg-[var(--smr-accent-gold)]' : connected ? 'bg-[var(--smr-accent-green)]' : 'bg-smr-text-muted'}`}
            style={{ animation: !paused && connected ? 'pulse-glow 2s ease-in-out infinite' : 'none' }}
          />
          <span className={`text-xs font-medium ${paused ? 'text-[var(--smr-accent-gold)]' : connected ? 'text-[var(--smr-accent-green)]' : 'text-smr-text-muted'}`}>
            {paused ? t('paused') : connected ? t('live') : t('connecting')}
          </span>
          {alerts.length > 0 && (
            <span className="text-xs text-smr-text-muted">
              {t('alertCount', { count: alerts.length })}
            </span>
          )}
        </div>

        {/* 暂停/继续按钮 — 有告警时才显示 */}
        {alerts.length > 0 && <button
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
              {pendingCount > 0 ? t('resumeWithCount', { count: pendingCount }) : t('resume')}
            </>
          ) : (
            <>
              <Pause size={12} />
              {t('pause')}
            </>
          )}
        </button>}
      </div>

      {/* 实时告警列表 */}
      <div className="flex flex-col gap-3">
        {alerts.map((alert, i) => (
          <div
            key={alert.id ?? alert.signature}
            className="relative"
            style={{
              animation: i === 0 && !paused ? 'alert-slide-in 400ms ease-out' : 'none',
            }}
          >
            {timeline && (
              <div className="absolute -left-6 top-5 flex h-[15px] w-[15px] items-center justify-center">
                <div className="h-2.5 w-2.5 rounded-full bg-[var(--smr-accent-green)] shadow-[0_0_8px_rgba(6,214,160,0.4)]" />
              </div>
            )}
            <AlertCard alert={alert} defaultExpanded />
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';

interface BacktestProgress {
  phase: string;
  percent: number;
  message: string;
}

type RunStatus = 'idle' | 'running' | 'complete' | 'error';

export function BacktestPanel() {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [progress, setProgress] = useState<BacktestProgress | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch initial status on mount
  useEffect(() => {
    fetch('/api/admin/backtest/status')
      .then((res) => res.json())
      .then((data: { status: RunStatus; runId: string | null; progress: BacktestProgress | null; error: string | null }) => {
        setStatus(data.status ?? 'idle');
        setRunId(data.runId);
        setProgress(data.progress);
        if (data.error) setError(data.error);
      })
      .catch(() => {
        // Ignore fetch errors on mount
      });
  }, []);

  // SSE subscription when running
  useEffect(() => {
    if (status !== 'running') return;

    const es = new EventSource('/api/admin/backtest/stream');

    es.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data) as BacktestProgress;
      setProgress(data);
    });

    es.addEventListener('complete', () => {
      setStatus('complete');
      loadReport();
      es.close();
    });

    es.addEventListener('backtest-error', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { error: string };
      setError(data.error);
      setStatus('error');
      es.close();
    });

    return () => es.close();
  }, [status]);

  const loadReport = useCallback(() => {
    fetch('/api/admin/backtest/report')
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: { markdown: string } | null) => {
        if (data) setMarkdown(data.markdown);
      })
      .catch(() => {});
  }, []);

  // Load report on mount if complete
  useEffect(() => {
    if (status === 'complete' && !markdown) {
      loadReport();
    }
  }, [status, markdown, loadReport]);

  async function handleTrigger() {
    setLoading(true);
    setError(null);
    setMarkdown(null);

    try {
      const res = await fetch('/api/admin/backtest', { method: 'POST' });
      const data = await res.json() as { runId?: string; error?: string };

      if (res.status === 409) {
        setError(data.error ?? 'Backtest already running');
        return;
      }

      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }

      setRunId(data.runId ?? null);
      setStatus('running');
      setProgress({ phase: 'seed', percent: 0, message: 'Starting...' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const phaseLabels: Record<string, string> = {
    seed: 'Fetching wallets',
    'collect-smart': 'Collecting smart money',
    'collect-baseline': 'Collecting baseline',
    'track-smart': 'Tracking smart money prices',
    'track-baseline': 'Tracking baseline prices',
    analyze: 'Analyzing results',
  };

  return (
    <div className="space-y-6">
      {/* Trigger button */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-smr-text">Birdeye Backtest</h3>
            <p className="mt-1 text-sm text-smr-text-muted">
              Fetch wallets from Birdeye, split by PnL, run full pipeline
            </p>
          </div>
          <button
            onClick={handleTrigger}
            disabled={status === 'running' || loading}
            className="rounded-lg bg-[var(--smr-accent-cyan)] px-5 py-2.5 font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'running' ? 'Running...' : 'Start Backtest'}
          </button>
        </div>

        {runId && (
          <p className="mt-2 text-xs text-smr-text-muted">Run: {runId}</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm font-medium text-red-400">Error</p>
          <p className="mt-1 text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Progress */}
      {status === 'running' && progress && (
        <div className="glass-card p-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-smr-text">
              {phaseLabels[progress.phase] ?? progress.phase}
            </span>
            <span className="font-mono text-smr-text-muted">{progress.percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-smr-bg-secondary">
            <div
              className="h-full rounded-full bg-[var(--smr-accent-cyan)] transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-smr-text-muted">{progress.message}</p>
        </div>
      )}

      {/* Report */}
      {markdown && (
        <div className="glass-card p-6">
          <h3 className="mb-4 font-semibold text-smr-text">Report</h3>
          <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap rounded-lg bg-smr-bg-secondary p-4 text-sm text-smr-text">
            {markdown}
          </pre>
        </div>
      )}
    </div>
  );
}

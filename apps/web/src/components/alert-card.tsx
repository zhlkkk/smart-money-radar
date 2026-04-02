'use client';

// 告警卡片 — 时间线样式 + 严重程度边框 + 可展开 AI 详情

import { useState } from 'react';
import type { AlertRow } from '@/lib/backend-client';
import { formatCompact, formatRelativeTime, truncateAddress } from '@/lib/format';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, AlertTriangle, Brain, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface AlertCardProps {
  alert: AlertRow;
}

type Severity = 'high' | 'medium' | 'info';

function getSeverity(alert: AlertRow): Severity {
  if (alert.freezeAuthority != null && alert.freezeAuthority !== '') return 'high';
  return 'info';
}

const severityStyles: Record<Severity, { border: string; labelKey: 'highRisk' | 'mediumRisk' | 'info'; variant: 'red' | 'gold' | 'cyan' }> = {
  high: { border: 'border-l-4 border-l-[var(--smr-accent-red)]', labelKey: 'highRisk', variant: 'red' },
  medium: { border: 'border-l-4 border-l-[var(--smr-accent-gold)]', labelKey: 'mediumRisk', variant: 'gold' },
  info: { border: 'border-l-4 border-l-[var(--smr-accent-cyan)]', labelKey: 'info', variant: 'cyan' },
};

export function AlertCard({ alert }: AlertCardProps) {
  const t = useTranslations('alerts');
  const [expanded, setExpanded] = useState(false);
  const severity = getSeverity(alert);
  const style = severityStyles[severity];

  return (
    <GlassCard
      className={`${style.border} overflow-hidden p-0`}
      hover
    >
      <div className="p-4">
        {/* 顶部：时间 + 钱包 + 严重程度 */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-smr-text">
              {alert.walletLabel ?? truncateAddress(alert.walletAddress)}
            </span>
            {alert.dexSource && (
              <Badge variant="muted">{alert.dexSource}</Badge>
            )}
            <Badge variant={style.variant}>{t(style.labelKey)}</Badge>
          </div>
          <span className="font-data text-xs text-smr-text-muted">
            {formatRelativeTime(alert.createdAt)}
          </span>
        </div>

        {/* 代币信息 */}
        <div className="mb-3 flex items-center gap-3">
          <span className="font-data text-base font-bold text-[var(--smr-accent-cyan)]">
            {alert.tokenSymbol ?? '未知代币'}
          </span>
          <span className="font-data text-xs text-smr-text-muted">
            {truncateAddress(alert.tokenMint)}
          </span>
        </div>

        {/* 指标行 */}
        <div className="mb-3 grid grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] text-smr-text-muted">流动性</div>
            <div className="font-data text-sm font-medium text-smr-text">
              ${formatCompact(alert.liquidity)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-smr-text-muted">FDV</div>
            <div className="font-data text-sm font-medium text-smr-text">
              ${formatCompact(alert.fdv)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-smr-text-muted">市值</div>
            <div className="font-data text-sm font-medium text-smr-text">
              ${formatCompact(alert.marketCap)}
            </div>
          </div>
        </div>

        {/* 风险标记 */}
        {severity === 'high' && (
          <div className="mb-3 flex items-center gap-2 rounded-md bg-[var(--smr-accent-red)]/10 px-3 py-1.5">
            <AlertTriangle size={14} className="text-[var(--smr-accent-red)]" />
            <span className="text-xs text-[var(--smr-accent-red)]">
              {t('freezeWarning')}
            </span>
          </div>
        )}

        {/* AI 摘要 展开/折叠 */}
        {alert.aiSummary && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md bg-[var(--smr-bg-elevated)] px-3 py-2 text-left text-sm text-smr-text-secondary transition hover:bg-[var(--smr-bg-hover)]"
            style={{ transition: 'background var(--smr-transition-fast)' }}
          >
            <Brain size={14} className="shrink-0 text-[var(--smr-accent-cyan)]" />
            <span className="flex-1">
              {expanded ? t('aiDetail') : t('aiDetailExpand')}
            </span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* 展开的 AI 详情 */}
      {alert.aiSummary && expanded && (
        <div
          className="border-t border-[var(--smr-glass-border)] bg-[var(--smr-bg-elevated)] px-4 py-3"
          style={{ animation: 'fade-in var(--smr-transition-normal)' }}
        >
          <p className="text-sm leading-relaxed text-smr-text-secondary">
            {alert.aiSummary}
          </p>
        </div>
      )}
    </GlassCard>
  );
}

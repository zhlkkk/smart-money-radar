'use client';

// 告警卡片 — 融合风：顶部色带 + 四列指标 + AI 摘要内联 + 数据源 footer

import type { AlertRow } from '@/lib/backend-client';
import { formatCompact, formatRelativeTime, truncateAddress } from '@/lib/format';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface AlertCardProps {
  alert: AlertRow;
  defaultExpanded?: boolean; // kept for call-site compatibility, no longer used
}

type Severity = 'high' | 'medium' | 'low';

function getSeverity(alert: AlertRow): Severity {
  const hasFreezeRisk = alert.freezeAuthority != null && alert.freezeAuthority !== '';
  const hasMintRisk = alert.mintAuthority != null && alert.mintAuthority !== '';
  if (hasFreezeRisk || hasMintRisk) return 'high';
  if (
    (alert.liquidity !== null && alert.liquidity < 100_000) ||
    (alert.volume24h !== null && alert.volume24h < 50_000)
  ) return 'medium';
  return 'low';
}

function getRiskWarning(alert: AlertRow): string | null {
  const hasFreezeRisk = alert.freezeAuthority != null && alert.freezeAuthority !== '';
  const hasMintRisk = alert.mintAuthority != null && alert.mintAuthority !== '';
  if (hasFreezeRisk && hasMintRisk) return 'Mint & Freeze Authority 均未撤销';
  if (hasFreezeRisk) return 'Freeze Authority 未撤销，存在冻结风险';
  if (hasMintRisk) return 'Mint Authority 未撤销，存在增发风险';
  return null;
}

const RISK_BAND_STYLE: Record<Severity, string> = {
  high:   'linear-gradient(90deg, var(--smr-accent-red),  color-mix(in srgb, var(--smr-accent-red)  40%, transparent))',
  medium: 'linear-gradient(90deg, var(--smr-accent-gold), color-mix(in srgb, var(--smr-accent-gold) 40%, transparent))',
  low:    'linear-gradient(90deg, var(--smr-accent-cyan), color-mix(in srgb, var(--smr-accent-cyan) 40%, transparent))',
};

const SEVERITY_BADGE_PROPS: Record<Severity, { variant: 'red' | 'gold' | 'cyan'; labelKey: 'highRisk' | 'mediumRisk' | 'info' }> = {
  high:   { variant: 'red',  labelKey: 'highRisk' },
  medium: { variant: 'gold', labelKey: 'mediumRisk' },
  low:    { variant: 'cyan', labelKey: 'info' },
};

const METRICS: Array<{ label: string; key: 'liquidity' | 'fdv' | 'marketCap' | 'volume24h'; highlight?: boolean }> = [
  { label: 'Liq',     key: 'liquidity',  highlight: true },
  { label: 'FDV',     key: 'fdv' },
  { label: 'MC',      key: 'marketCap' },
  { label: 'Vol 24h', key: 'volume24h' },
];

export function AlertCard({ alert }: AlertCardProps) {
  const t = useTranslations('alerts');
  const severity = getSeverity(alert);
  const riskWarning = getRiskWarning(alert);
  const { variant, labelKey } = SEVERITY_BADGE_PROPS[severity];

  return (
    <GlassCard
      className="overflow-hidden p-0 transition-all hover:scale-[1.01] hover:shadow-[var(--smr-shadow-card-hover)]"
      hover
    >
      {/* 顶部风险色带 */}
      <div style={{ height: '3px', background: RISK_BAND_STYLE[severity] }} />

      <div className="p-4">
        {/* 顶行：钱包名 + 时间/DEX + 徽章 */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-bold text-smr-text">
              🐋 {alert.walletLabel ?? truncateAddress(alert.walletAddress)}
            </div>
            <div className="mt-0.5 text-[10px] text-smr-text-muted">
              {[alert.dexSource, formatRelativeTime(alert.createdAt)].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant={variant}>{t(labelKey)}</Badge>
            {alert.confidenceLevel && (
              <Badge
                variant={
                  alert.confidenceLevel === 'high' ? 'green' :
                  alert.confidenceLevel === 'medium' ? 'gold' : 'red'
                }
              >
                {alert.confidenceLevel === 'high' ? '✓ ' : ''}
                {alert.confidenceLevel === 'high'   ? t('confidenceHigh') :
                 alert.confidenceLevel === 'medium' ? t('confidenceMedium') :
                                                      t('confidenceLow')}
                {alert.confidenceScore != null && ` ${alert.confidenceScore}`}
              </Badge>
            )}
          </div>
        </div>

        {/* 代币行 */}
        <div className="mb-3 flex items-baseline gap-2">
          <span className="font-data text-lg font-extrabold text-[var(--smr-accent-cyan)]">
            {alert.tokenSymbol ?? truncateAddress(alert.tokenMint)}
          </span>
          <span className="font-data text-[10px] text-smr-text-muted">
            {truncateAddress(alert.tokenMint)}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <a
              href={`https://birdeye.so/token/${alert.tokenMint}?chain=solana`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-smr-text-muted transition hover:text-[var(--smr-accent-cyan)]"
            >
              ↗ Birdeye
            </a>
            <a
              href={`https://dexscreener.com/solana/${alert.tokenMint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-smr-text-muted transition hover:text-[var(--smr-accent-cyan)]"
            >
              ↗ DexScreener
            </a>
          </div>
        </div>

        {/* 风险警告（高风险时显示） */}
        {riskWarning && (
          <div className="mb-3 flex items-center gap-2 rounded-md bg-[var(--smr-accent-red)]/10 px-3 py-1.5">
            <AlertTriangle size={13} className="shrink-0 text-[var(--smr-accent-red)]" />
            <span className="text-xs text-[var(--smr-accent-red)]">⚠️ {riskWarning}</span>
          </div>
        )}

        {/* 四列指标 */}
        <div className="mb-3 flex overflow-hidden rounded-md bg-[var(--smr-bg-elevated)]">
          {METRICS.map(({ label, key, highlight }, i) => (
            <div
              key={label}
              className={`flex-1 px-2 py-2 text-center ${i > 0 ? 'border-l border-[var(--smr-glass-border)]' : ''}`}
            >
              <div className="text-[9px] uppercase tracking-wide text-smr-text-muted">{label}</div>
              <div
                className={`font-data text-xs font-semibold ${
                  highlight ? 'text-[var(--smr-accent-cyan)]' : 'text-smr-text'
                }`}
              >
                ${formatCompact(alert[key])}
              </div>
            </div>
          ))}
        </div>

        {/* AI 摘要 — 始终可见，不再折叠 */}
        {alert.aiSummary && (
          <div className="mb-3 border-l-2 border-[var(--smr-accent-cyan)] pl-3">
            <p className="text-xs italic leading-relaxed text-smr-text-secondary">
              🤖 {alert.aiSummary}
            </p>
          </div>
        )}

        {/* 数据源 footer */}
        <div className="flex items-center justify-between border-t border-[var(--smr-glass-border)] pt-2">
          <span className="text-[10px] text-smr-text-muted">🔍 Helius → DexScreener → Claude</span>
          <div className="flex gap-3">
            <a
              href={`https://birdeye.so/token/${alert.tokenMint}?chain=solana`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[var(--smr-accent-cyan)]/70 transition hover:text-[var(--smr-accent-cyan)]"
            >
              Birdeye
            </a>
            <a
              href={`https://dexscreener.com/solana/${alert.tokenMint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[var(--smr-accent-cyan)]/70 transition hover:text-[var(--smr-accent-cyan)]"
            >
              DexScreener
            </a>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

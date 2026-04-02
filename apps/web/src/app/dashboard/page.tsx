// Dashboard 总览页（Server Component + 客户端图表）
// Glassmorphism 统计卡片 + Bento Grid 导航 + 最近告警预览

import Link from 'next/link';
import { Zap, Wallet, TrendingUp, Activity, ArrowRight } from 'lucide-react';
import { getAlerts, getWallets } from '@/lib/backend-client';
import { GlassCard } from '@/components/ui/glass-card';
import { StatusPulse } from '@/components/ui/status-pulse';
import { formatRelativeTime, truncateAddress } from '@/lib/format';
import { DashboardCharts } from '@/components/dashboard-charts';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

interface DashboardPageProps {
  searchParams: Promise<{ checkout?: string }>;
}

// 模拟趋势数据（等后端支持后替换）
const walletTrendData = [12, 14, 13, 16, 18, 17, 20, 22, 21, 24];

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { checkout } = await searchParams;
  const t = await getTranslations('dashboard');

  const [alertsResult, walletsResult] = await Promise.allSettled([
    getAlerts(undefined, 5),
    getWallets(),
  ]);

  const alerts =
    alertsResult.status === 'fulfilled' ? alertsResult.value.data : [];
  const hasAlerts = alerts.length > 0;
  const walletCount =
    walletsResult.status === 'fulfilled' ? walletsResult.value.data.length : 0;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Checkout 成功消息 */}
      {checkout === 'success' && (
        <GlassCard className="mb-6 border-[var(--smr-accent-green)]/30 px-4 py-3" hover={false}>
          <span className="text-sm text-[var(--smr-accent-green)]">
            {t('checkoutSuccess')}
          </span>
        </GlassCard>
      )}

      {/* 标题 */}
      <h1 className="mb-8 text-2xl font-bold text-smr-text">{t('title')}</h1>

      {/* ─── 统计卡片 ─── */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* 活跃钱包 — 青色主调 */}
        <GlassCard className="relative overflow-hidden p-5" hover={false}>
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--smr-accent-cyan)]/5 blur-2xl" />
          <div className="relative">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-smr-text-muted">{t('activeWallets')}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--smr-accent-cyan)]/10">
                <Wallet size={16} className="text-[var(--smr-accent-cyan)]" />
              </div>
            </div>
            <div className="font-data text-2xl font-bold text-[var(--smr-accent-cyan)]">
              {walletCount}
            </div>
            <DashboardCharts type="sparkline" data={walletTrendData} color="cyan" />
          </div>
        </GlassCard>

        {/* 告警状态 — 金色/绿色（根据状态变化） */}
        <GlassCard className="relative overflow-hidden p-5" hover={false}>
          <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl ${hasAlerts ? 'bg-[var(--smr-accent-gold)]/5' : 'bg-[var(--smr-accent-green)]/5'}`} />
          <div className="relative">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-smr-text-muted">{t('alertStatus')}</span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${hasAlerts ? 'bg-[var(--smr-accent-gold)]/10' : 'bg-[var(--smr-accent-green)]/10'}`}>
                <Zap size={16} className={hasAlerts ? 'text-[var(--smr-accent-gold)]' : 'text-[var(--smr-accent-green)]'} />
              </div>
            </div>
            <div className={`font-data text-2xl font-bold ${hasAlerts ? 'text-[var(--smr-accent-gold)]' : 'text-[var(--smr-accent-green)]'}`}>
              {hasAlerts ? `${alerts.length} ${t('newAlerts')}` : t('allClear')}
            </div>
            <div className="mt-2">
              <StatusPulse status={hasAlerts ? 'warning' : 'ok'} label={hasAlerts ? t('pending') : t('noNewAlerts')} />
            </div>
          </div>
        </GlassCard>

        {/* 系统状态 — 绿色主调 */}
        <GlassCard className="relative overflow-hidden p-5" hover={false}>
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--smr-accent-green)]/5 blur-2xl" />
          <div className="relative">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-smr-text-muted">{t('systemStatus')}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--smr-accent-green)]/10">
                <Activity size={16} className="text-[var(--smr-accent-green)]" />
              </div>
            </div>
            <div className="font-data text-2xl font-bold text-[var(--smr-accent-green)]">
              {t('running')}
            </div>
            {/* SVG 心跳线 */}
            <div className="mt-2">
              <svg width="120" height="28" viewBox="0 0 120 28" className="text-[var(--smr-accent-green)]">
                <path
                  d="M0 14 L20 14 L28 4 L36 24 L44 14 L60 14 L68 6 L76 22 L84 14 L100 14 L108 8 L116 20 L120 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.7"
                />
              </svg>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ─── Bento Grid 快速导航 ─── */}
      <h2 className="mb-4 text-lg font-medium text-smr-text-secondary">{t('quickNav')}</h2>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 告警历史 — 金色渐变 */}
        <Link href="/dashboard/alerts">
          <GlassCard className="group relative cursor-pointer overflow-hidden p-5">
            <div className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-[var(--smr-accent-gold)]/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-50" />
            <div className="relative">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--smr-accent-gold)]/10">
                    <Zap size={20} className="text-[var(--smr-accent-gold)]" />
                  </div>
                  <span className="font-medium text-smr-text transition group-hover:text-[var(--smr-accent-gold)]" style={{ transition: 'color var(--smr-transition-fast)' }}>
                    {t('alertHistory')}
                  </span>
                </div>
                <ArrowRight size={16} className="text-smr-text-muted transition-transform group-hover:translate-x-1 group-hover:text-[var(--smr-accent-gold)]" />
              </div>
              <p className="text-sm text-smr-text-muted">
                {t('alertHistoryDesc')}
              </p>
            </div>
          </GlassCard>
        </Link>

        {/* 钱包列表 — 绿色渐变 */}
        <Link href="/dashboard/wallets">
          <GlassCard className="group relative cursor-pointer overflow-hidden p-5">
            <div className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-[var(--smr-accent-green)]/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-50" />
            <div className="relative">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--smr-accent-green)]/10">
                    <Wallet size={20} className="text-[var(--smr-accent-green)]" />
                  </div>
                  <span className="font-medium text-smr-text transition group-hover:text-[var(--smr-accent-green)]" style={{ transition: 'color var(--smr-transition-fast)' }}>
                    {t('walletList')}
                  </span>
                </div>
                <ArrowRight size={16} className="text-smr-text-muted transition-transform group-hover:translate-x-1 group-hover:text-[var(--smr-accent-green)]" />
              </div>
              <p className="text-sm text-smr-text-muted">
                {t('walletListDesc')}
              </p>
            </div>
          </GlassCard>
        </Link>
      </div>

      {/* ─── 最近告警预览 ─── */}
      {alerts.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-smr-text-secondary">{t('recentAlerts')}</h2>
            <Link
              href="/dashboard/alerts"
              className="cursor-pointer text-xs text-[var(--smr-accent-gold)] transition hover:text-[var(--smr-accent-gold)]/80"
            >
              {t('viewAll')}
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {alerts.slice(0, 3).map((alert) => (
              <GlassCard key={alert.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-[var(--smr-accent-gold)]" />
                  <span className="text-sm font-medium text-smr-text">
                    {alert.walletLabel ?? truncateAddress(alert.walletAddress)}
                  </span>
                  <span className="font-data text-sm font-bold text-[var(--smr-accent-cyan)]">
                    {alert.tokenSymbol ?? t('unknown')}
                  </span>
                </div>
                <span className="font-data text-xs text-smr-text-muted">
                  {formatRelativeTime(alert.createdAt)}
                </span>
              </GlassCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

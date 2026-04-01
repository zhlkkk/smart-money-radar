// Dashboard 总览页（Server Component + 客户端图表）
// Glassmorphism 统计卡片 + Bento Grid 导航 + 最近告警预览

import Link from 'next/link';
import { Zap, Wallet, TrendingUp } from 'lucide-react';
import { getAlerts, getWallets } from '@/lib/backend-client';
import { GlassCard } from '@/components/ui/glass-card';
import { StatusPulse } from '@/components/ui/status-pulse';
import { formatRelativeTime, truncateAddress } from '@/lib/format';
import { DashboardCharts } from '@/components/dashboard-charts';

export const dynamic = 'force-dynamic';

interface DashboardPageProps {
  searchParams: Promise<{ checkout?: string }>;
}

// 模拟趋势数据（等后端支持后替换）
const walletTrendData = [12, 14, 13, 16, 18, 17, 20, 22, 21, 24];

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { checkout } = await searchParams;

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
            订阅成功！欢迎使用 Smart Money Radar Pro。
          </span>
        </GlassCard>
      )}

      {/* 标题 */}
      <h1 className="mb-8 text-2xl font-bold text-smr-text">控制台总览</h1>

      {/* ─── 统计卡片 ─── */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* 活跃钱包 */}
        <GlassCard className="p-5" hover={false}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-smr-text-muted">活跃钱包</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--smr-accent-cyan)]/10">
              <Wallet size={16} className="text-[var(--smr-accent-cyan)]" />
            </div>
          </div>
          <div className="font-data text-2xl font-bold text-[var(--smr-accent-cyan)]">
            {walletCount}
          </div>
          <DashboardCharts type="sparkline" data={walletTrendData} />
        </GlassCard>

        {/* 告警状态 */}
        <GlassCard className="p-5" hover={false}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-smr-text-muted">告警状态</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--smr-accent-green)]/10">
              <Zap size={16} className="text-[var(--smr-accent-green)]" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-data text-2xl font-bold text-smr-text">
              {hasAlerts ? '有新告警' : '暂无告警'}
            </span>
          </div>
          <div className="mt-2">
            <StatusPulse status={hasAlerts ? 'warning' : 'ok'} label={hasAlerts ? `${alerts.length} 条待查看` : '一切正常'} />
          </div>
        </GlassCard>

        {/* 系统状态 */}
        <GlassCard className="p-5" hover={false}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-smr-text-muted">系统状态</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--smr-accent-green)]/10">
              <TrendingUp size={16} className="text-[var(--smr-accent-green)]" />
            </div>
          </div>
          <div className="font-data text-2xl font-bold text-[var(--smr-accent-green)]">
            运行中
          </div>
          {/* SVG 心跳线 */}
          <div className="mt-2">
            <svg width="100" height="24" viewBox="0 0 100 24" className="text-[var(--smr-accent-green)]">
              <path
                d="M0 12 L20 12 L28 4 L36 20 L44 12 L60 12 L68 6 L76 18 L84 12 L100 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.6"
              />
            </svg>
          </div>
        </GlassCard>
      </div>

      {/* ─── Bento Grid 快速导航 ─── */}
      <h2 className="mb-4 text-lg font-medium text-smr-text-secondary">快速导航</h2>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/dashboard/alerts">
          <GlassCard className="group cursor-pointer bg-gradient-to-br from-[var(--smr-accent-cyan)]/5 to-transparent p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--smr-accent-cyan)]/10">
                <Zap size={20} className="text-[var(--smr-accent-cyan)]" />
              </div>
              <span className="font-medium text-smr-text transition group-hover:text-[var(--smr-accent-cyan)]" style={{ transition: 'color var(--smr-transition-fast)' }}>
                告警历史
              </span>
            </div>
            <p className="text-sm text-smr-text-muted">
              查看所有聪明钱交易告警，包含 AI 智能分析摘要
            </p>
          </GlassCard>
        </Link>
        <Link href="/dashboard/wallets">
          <GlassCard className="group cursor-pointer bg-gradient-to-br from-[var(--smr-accent-green)]/5 to-transparent p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--smr-accent-green)]/10">
                <Wallet size={20} className="text-[var(--smr-accent-green)]" />
              </div>
              <span className="font-medium text-smr-text transition group-hover:text-[var(--smr-accent-green)]" style={{ transition: 'color var(--smr-transition-fast)' }}>
                钱包列表
              </span>
            </div>
            <p className="text-sm text-smr-text-muted">
              浏览追踪中的聪明钱地址，查看评分和盈亏数据
            </p>
          </GlassCard>
        </Link>
      </div>

      {/* ─── 最近告警预览 ─── */}
      {alerts.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-smr-text-secondary">最近告警</h2>
            <Link
              href="/dashboard/alerts"
              className="cursor-pointer text-xs text-[var(--smr-accent-cyan)] transition hover:text-[var(--smr-accent-cyan)]/80"
            >
              查看全部 →
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {alerts.slice(0, 3).map((alert) => (
              <GlassCard key={alert.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Zap size={14} className="text-[var(--smr-accent-cyan)]" />
                  <span className="text-sm font-medium text-smr-text">
                    {alert.walletLabel ?? truncateAddress(alert.walletAddress)}
                  </span>
                  <span className="font-data text-sm font-bold text-[var(--smr-accent-cyan)]">
                    {alert.tokenSymbol ?? '未知'}
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

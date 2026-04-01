// Dashboard 总览页（Server Component）
// 展示简要统计和快速导航，处理 checkout 成功回调

import Link from 'next/link';
import { getAlerts, getWallets } from '@/lib/backend-client';

export const dynamic = 'force-dynamic';

interface DashboardPageProps {
  searchParams: Promise<{ checkout?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { checkout } = await searchParams;

  // 并行获取统计数据，失败则降级
  const [alertsResult, walletsResult] = await Promise.allSettled([
    getAlerts(undefined, 1),
    getWallets(),
  ]);

  const alertCount =
    alertsResult.status === 'fulfilled' ? alertsResult.value.data.length : 0;
  const hasAlerts = alertCount > 0 || (alertsResult.status === 'fulfilled' && alertsResult.value.hasMore);
  const walletCount =
    walletsResult.status === 'fulfilled' ? walletsResult.value.data.length : 0;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Checkout 成功消息 */}
      {checkout === 'success' && (
        <div className="mb-6 rounded-lg border border-[#00FF88]/30 bg-[#00FF88]/10 px-4 py-3 text-sm text-[#00FF88]">
          订阅成功！欢迎使用 Smart Money Radar Pro。
        </div>
      )}

      {/* 标题 */}
      <h1 className="mb-8 text-2xl font-bold text-white">控制台总览</h1>

      {/* 统计卡片 */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="活跃钱包"
          value={String(walletCount)}
          accent
        />
        <StatCard
          label="告警状态"
          value={hasAlerts ? '有新告警' : '暂无告警'}
        />
        <StatCard
          label="系统状态"
          value="运行中"
        />
      </div>

      {/* 快速导航 */}
      <h2 className="mb-4 text-lg font-medium text-zinc-300">快速导航</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <QuickLink
          href="/dashboard/alerts"
          title="告警历史"
          description="查看所有聪明钱交易告警，包含 AI 智能分析摘要"
          icon="⚡"
        />
        <QuickLink
          href="/dashboard/wallets"
          title="钱包列表"
          description="浏览追踪中的聪明钱地址，查看评分和盈亏数据"
          icon="◎"
        />
      </div>
    </div>
  );
}

// ─── 内部子组件 ───

interface StatCardProps {
  label: string;
  value: string;
  accent?: boolean;
}

function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-[#111111] p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div
        className={`mt-1 text-xl font-bold ${accent ? 'text-[#00F0FF]' : 'text-white'}`}
      >
        {value}
      </div>
    </div>
  );
}

interface QuickLinkProps {
  href: string;
  title: string;
  description: string;
  icon: string;
}

function QuickLink({ href, title, description, icon }: QuickLinkProps) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-zinc-800 bg-[#111111] p-5 transition hover:border-[#00F0FF]/30"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="font-medium text-white group-hover:text-[#00F0FF]">
          {title}
        </span>
      </div>
      <p className="text-sm text-zinc-400">{description}</p>
    </Link>
  );
}

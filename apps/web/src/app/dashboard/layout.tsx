// Dashboard 布局
// 服务端检查订阅状态，未订阅直接渲染 paywall 而非数据

import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { SidebarNav } from '@/components/sidebar-nav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  const metadata = user?.publicMetadata as
    | { subscriptionStatus?: string }
    | undefined;
  const isSubscribed = metadata?.subscriptionStatus === 'active';

  return (
    <div className="flex h-screen overflow-hidden bg-smr-bg">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto p-6">
        {isSubscribed ? children : <Paywall />}
      </main>
    </div>
  );
}

function Paywall() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="glass-card flex flex-col items-center gap-4 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--smr-accent-cyan)]/10">
          <Lock size={24} className="text-[var(--smr-accent-cyan)]" />
        </div>
        <h2 className="text-xl font-bold text-smr-text">需要订阅才能查看</h2>
        <p className="max-w-sm text-sm text-smr-text-muted">
          升级到 Pro 计划，解锁实时聪明钱告警、钱包追踪和 AI 分析。
        </p>
        <Link
          href="/pricing"
          className="cursor-pointer rounded-lg bg-[var(--smr-accent-cyan)] px-6 py-2.5 font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
          style={{ boxShadow: 'var(--smr-glow-cyan)', transition: 'all var(--smr-transition-normal)' }}
        >
          升级订阅
        </Link>
      </div>
    </div>
  );
}

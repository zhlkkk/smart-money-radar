// Dashboard 布局
// 服务端检查订阅状态，未订阅直接渲染 paywall 而非数据

import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
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
    <div className="flex h-screen overflow-hidden bg-[#0A0A0A]">
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
      <div className="flex flex-col items-center gap-4 rounded-lg border border-zinc-800 bg-[#111111] p-8 text-center">
        <div className="text-3xl">🔒</div>
        <h2 className="text-xl font-bold text-white">需要订阅才能查看</h2>
        <p className="max-w-sm text-sm text-zinc-400">
          升级到 Pro 计划，解锁实时聪明钱告警、钱包追踪和 AI 分析。
        </p>
        <Link
          href="/pricing"
          className="rounded-md bg-[#00F0FF] px-6 py-2.5 font-medium text-black transition hover:bg-[#00F0FF]/80"
        >
          升级订阅
        </Link>
      </div>
    </div>
  );
}

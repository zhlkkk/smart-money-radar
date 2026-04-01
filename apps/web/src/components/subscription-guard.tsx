'use client';

// 订阅状态拦截组件
// 检查用户 publicMetadata 中的 subscriptionStatus，未订阅则显示遮罩

import { useUser } from '@clerk/nextjs';
import Link from 'next/link';

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { user, isLoaded } = useUser();

  // 加载中不阻塞渲染
  if (!isLoaded) {
    return <>{children}</>;
  }

  const metadata = user?.publicMetadata as
    | { subscriptionStatus?: string }
    | undefined;
  const isSubscribed = metadata?.subscriptionStatus === 'active';

  if (!isSubscribed) {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none blur-sm">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A]/80">
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
      </div>
    );
  }

  return <>{children}</>;
}

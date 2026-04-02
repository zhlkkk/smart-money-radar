'use client';

// Helio Pay 加密支付按钮
// 使用 @heliofi/checkout-react 内嵌结账 widget

import dynamic from 'next/dynamic';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Wallet } from 'lucide-react';

// 动态加载 Helio widget（仅客户端，避免 SSR 问题）
const HelioCheckout = dynamic(
  () => import('@heliofi/checkout-react').then((mod) => mod.HelioCheckout),
  { ssr: false },
);

const HELIO_PAYLINK_ID = process.env.NEXT_PUBLIC_HELIO_PAYLINK_ID ?? '';

export function HelioCheckoutButton() {
  const { user, isSignedIn } = useUser();
  const router = useRouter();

  // 未登录 → 跳转登录
  if (!isSignedIn) {
    return (
      <button
        onClick={() => router.push('/sign-in?redirect_url=/pricing')}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--smr-accent-cyan)] py-3 font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
        style={{ boxShadow: 'var(--smr-glow-cyan-strong)', transition: 'all var(--smr-transition-normal)' }}
      >
        <Wallet size={16} />
        登录后使用加密货币支付
      </button>
    );
  }

  // 未配置 paylink ID → 显示提示
  if (!HELIO_PAYLINK_ID) {
    return (
      <button
        disabled
        className="w-full cursor-not-allowed rounded-lg bg-[var(--smr-accent-cyan)]/50 py-3 text-sm font-medium text-[var(--smr-bg-primary)] opacity-60"
      >
        加密支付配置中...
      </button>
    );
  }

  return (
    <HelioCheckout
      config={{
        paylinkId: HELIO_PAYLINK_ID,
        network: 'main' as const,
        display: 'button' as const,
        additionalJSON: {
          clerkUserId: user.id,
          email: user.primaryEmailAddress?.emailAddress ?? '',
        },
        onSuccess: () => {
          router.push('/dashboard?checkout=success');
        },
      }}
    />
  );
}

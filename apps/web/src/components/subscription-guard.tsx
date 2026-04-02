'use client';

// 订阅状态拦截组件
// 检查用户 publicMetadata 中的 subscriptionStatus，未订阅则显示遮罩

import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { user, isLoaded } = useUser();
  const t = useTranslations('paywall');

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
        <div className="absolute inset-0 flex items-center justify-center bg-smr-bg/80">
          <div className="glass-card flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--smr-accent-cyan)]/10">
              <Lock size={24} className="text-[var(--smr-accent-cyan)]" />
            </div>
            <h2 className="text-xl font-bold text-smr-text">{t('title')}</h2>
            <p className="max-w-sm text-sm text-smr-text-muted">
              {t('description')}
            </p>
            <Link
              href="/pricing"
              className="cursor-pointer rounded-lg bg-[var(--smr-accent-cyan)] px-6 py-2.5 font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
              style={{ boxShadow: 'var(--smr-glow-cyan)', transition: 'all var(--smr-transition-normal)' }}
            >
              {t('cta')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

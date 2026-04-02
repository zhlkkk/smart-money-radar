// Dashboard 布局
// 服务端检查订阅状态，未订阅直接渲染 paywall 而非数据

import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { SidebarNav } from '@/components/sidebar-nav';
import { getTranslations } from 'next-intl/server';

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
      <SidebarNav subscriptionStatus={metadata?.subscriptionStatus} />
      <main className="flex-1 overflow-y-auto p-6">
        {isSubscribed ? children : <Paywall />}
      </main>
    </div>
  );
}

async function Paywall() {
  const t = await getTranslations('paywall');

  return (
    <div className="flex h-full items-center justify-center">
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
  );
}

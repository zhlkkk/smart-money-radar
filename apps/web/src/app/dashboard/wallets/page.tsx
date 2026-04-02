// 钱包列表页
// Server Component 获取数据 + Client Component 处理筛选/排序/视图

import { getWallets } from '@/lib/backend-client';
import { WalletListClient } from '@/components/wallet-list-client';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export default async function WalletsPage() {
  const { data: wallets } = await getWallets();
  const t = await getTranslations('wallets');
  const tCommon = await getTranslations('common');

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-smr-text">{t('title')}</h1>
        <span className="font-data text-sm text-smr-text-muted">
          {t('activeCount', { count: wallets.length })}
        </span>
      </div>

      {wallets.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDesc')}
          action={
            <Link
              href="/dashboard"
              className="cursor-pointer rounded-lg bg-[var(--smr-accent-cyan)] px-5 py-2 text-sm font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
            >
              {tCommon('enterDashboard')}
            </Link>
          }
        />
      ) : (
        <WalletListClient wallets={wallets} />
      )}
    </div>
  );
}

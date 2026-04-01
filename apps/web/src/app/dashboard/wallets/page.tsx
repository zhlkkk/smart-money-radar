// 钱包列表页
// Server Component 获取数据 + Client Component 处理筛选/排序/视图

import { getWallets } from '@/lib/backend-client';
import { WalletListClient } from '@/components/wallet-list-client';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function WalletsPage() {
  const { data: wallets } = await getWallets();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-smr-text">钱包列表</h1>
        <span className="font-data text-sm text-smr-text-muted">
          {wallets.length} 个活跃钱包
        </span>
      </div>

      {wallets.length === 0 ? (
        <EmptyState
          title="暂无追踪中的钱包"
          description="系统会自动发现并追踪高评分的聪明钱地址，也可以手动添加。"
          action={
            <Link
              href="/dashboard"
              className="cursor-pointer rounded-lg bg-[var(--smr-accent-cyan)] px-5 py-2 text-sm font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
            >
              返回控制台
            </Link>
          }
        />
      ) : (
        <WalletListClient wallets={wallets} />
      )}
    </div>
  );
}

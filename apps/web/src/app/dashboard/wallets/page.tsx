// 钱包列表页（Server Component）
// 加载活跃钱包，网格布局展示

import { getWallets } from '@/lib/backend-client';

export const dynamic = 'force-dynamic';
import { WalletCard } from '@/components/wallet-card';

export default async function WalletsPage() {
  const { data: wallets } = await getWallets();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">钱包列表</h1>
        <span className="text-sm text-zinc-500">
          {wallets.length} 个活跃钱包
        </span>
      </div>

      {wallets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-[#111111] py-16">
          <span className="mb-3 text-4xl">🔍</span>
          <p className="text-zinc-400">暂无追踪中的钱包</p>
          <p className="mt-1 text-sm text-zinc-500">
            系统会自动发现并追踪高评分的聪明钱地址
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wallets.map((wallet) => (
            <WalletCard key={wallet.id} wallet={wallet} />
          ))}
        </div>
      )}
    </div>
  );
}

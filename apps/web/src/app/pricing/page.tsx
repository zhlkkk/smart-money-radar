import Link from 'next/link';
import { PLANS } from '@radar/shared';
import { PricingCard } from '@/components/pricing-card';

export const metadata = {
  title: '定价 - Smart Money Radar',
  description: '选择适合你的聪明钱追踪计划',
};

export default function PricingPage() {
  const proPlan = PLANS.pro;

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-16">
      {/* 返回首页 */}
      <Link
        href="/"
        className="mb-12 text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        ← 返回首页
      </Link>

      {/* 标题 */}
      <h1 className="mb-4 text-4xl font-bold tracking-tight text-white">
        选择你的计划
      </h1>
      <p className="mb-12 max-w-md text-center text-zinc-400">
        解锁 Solana 聪明钱实时追踪，让 AI 帮你看懂每一笔交易
      </p>

      {/* 套餐卡片 */}
      <PricingCard plan={proPlan} />

      {/* 补充说明 */}
      <p className="mt-8 max-w-sm text-center text-xs text-zinc-600">
        支付由 Stripe 安全处理。订阅后可随时在控制台取消。
      </p>
    </main>
  );
}

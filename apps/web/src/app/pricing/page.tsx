import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PLANS } from '@radar/shared';
import { PricingCard } from '@/components/pricing-card';
import { GridBackground } from '@/components/ui/grid-background';

export const metadata = {
  title: '定价 - Smart Money Radar',
  description: '选择适合你的聪明钱追踪计划',
};

export default function PricingPage() {
  const proPlan = PLANS.pro;

  return (
    <main className="relative flex min-h-screen flex-col items-center px-4 py-16">
      <GridBackground />

      {/* 返回首页 */}
      <Link
        href="/"
        className="relative mb-12 inline-flex cursor-pointer items-center gap-1 text-sm text-smr-text-muted transition hover:text-smr-text"
      >
        <ArrowLeft size={14} />
        返回首页
      </Link>

      {/* 标题 */}
      <h1 className="relative mb-4 text-4xl font-bold tracking-tight text-smr-text">
        选择你的计划
      </h1>
      <p className="relative mb-12 max-w-md text-center text-smr-text-secondary">
        解锁 Solana 聪明钱实时追踪，让 AI 帮你看懂每一笔交易
      </p>

      {/* 套餐卡片 */}
      <div className="relative">
        <PricingCard plan={proPlan} />
      </div>

      {/* 补充说明 */}
      <p className="relative mt-8 max-w-sm text-center text-xs text-smr-text-muted">
        支付由 Stripe 安全处理。订阅后可随时在控制台取消。
      </p>
    </main>
  );
}

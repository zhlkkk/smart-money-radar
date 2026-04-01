'use client';

// Pricing 卡片组件
// 客户端组件：需要 Clerk hooks 获取用户信息 + 点击事件处理

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PlanDefinition } from '@radar/shared';
import { createCheckoutSession } from '@/app/pricing/actions';

// 英文 feature → 中文翻译映射
const featureTranslations: Record<string, string> = {
  'Real-time smart money alerts via Telegram':
    '通过 Telegram 接收实时聪明钱告警',
  'AI-powered buy rationale (<50 words)': 'AI 驱动的买入理由分析（< 50 字）',
  'Rug-pull protection (Mint/Freeze authority check)':
    'Rug-pull 防护（Mint/Freeze Authority 检测）',
  'Web Dashboard with alert history': 'Web 控制台 + 告警历史记录',
  'Tracked wallet details and scoring': '追踪钱包详情与评分',
};

function translateFeature(feature: string): string {
  return featureTranslations[feature] ?? feature;
}

interface PricingCardProps {
  plan: PlanDefinition;
}

export function PricingCard({ plan }: PricingCardProps) {
  const { user, isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    // 未登录 → 跳转登录页，登录后回到 /pricing
    if (!isSignedIn || !user) {
      router.push('/sign-in?redirect_url=/pricing');
      return;
    }

    setLoading(true);
    setError(null);

    const email =
      user.primaryEmailAddress?.emailAddress ?? '';

    const result = await createCheckoutSession(user.id, email);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.url) {
      // 跳转到 Stripe Checkout 页面
      window.location.href = result.url;
    }
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-[#111111] p-8">
      {/* 套餐名称 */}
      <h3 className="mb-2 text-xl font-bold text-white">{plan.name}</h3>

      {/* 价格 */}
      <div className="mb-6 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-[#00F0FF]">
          ${plan.priceMonthly}
        </span>
        <span className="text-zinc-500">/月</span>
      </div>

      {/* 功能列表 */}
      <ul className="mb-8 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 text-[#00FF88]">✓</span>
            <span className="text-zinc-300">
              {translateFeature(feature)}
            </span>
          </li>
        ))}
      </ul>

      {/* 订阅按钮 */}
      <button
        onClick={handleSubscribe}
        disabled={loading || !isLoaded}
        className="w-full rounded-md bg-[#00F0FF] py-3 font-medium text-black transition hover:bg-[#00F0FF]/80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? '处理中...' : '立即订阅'}
      </button>

      {/* 错误提示 */}
      {error && (
        <p className="mt-4 text-center text-sm text-[#FF4444]">{error}</p>
      )}
    </div>
  );
}

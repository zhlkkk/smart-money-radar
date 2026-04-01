'use client';

// Pricing 卡片 — Glassmorphism 风格

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check } from 'lucide-react';
import type { PlanDefinition } from '@radar/shared';
import { createCheckoutSession } from '@/app/pricing/actions';
import { GlassCard } from '@/components/ui/glass-card';

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
    if (!isSignedIn || !user) {
      router.push('/sign-in?redirect_url=/pricing');
      return;
    }

    setLoading(true);
    setError(null);

    const email = user.primaryEmailAddress?.emailAddress ?? '';
    const result = await createCheckoutSession(user.id, email);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.url) {
      window.location.href = result.url;
    }
  }

  return (
    <GlassCard className="w-full max-w-md p-8" glow="cyan">
      {/* 套餐名称 */}
      <h3 className="mb-2 text-xl font-bold text-smr-text">{plan.name}</h3>

      {/* 价格 */}
      <div className="mb-6 flex items-baseline gap-1">
        <span className="font-data text-4xl font-bold text-[var(--smr-accent-cyan)]">
          ${plan.priceMonthly}
        </span>
        <span className="text-smr-text-muted">/月</span>
      </div>

      {/* 功能列表 */}
      <ul className="mb-8 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm">
            <Check size={16} className="mt-0.5 shrink-0 text-[var(--smr-accent-green)]" />
            <span className="text-smr-text-secondary">
              {translateFeature(feature)}
            </span>
          </li>
        ))}
      </ul>

      {/* 订阅按钮 */}
      <button
        onClick={handleSubscribe}
        disabled={loading || !isLoaded}
        className="w-full cursor-pointer rounded-lg bg-[var(--smr-accent-cyan)] py-3 font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ boxShadow: 'var(--smr-glow-cyan)', transition: 'all var(--smr-transition-normal)' }}
      >
        {loading ? '处理中...' : '立即订阅'}
      </button>

      {/* 错误提示 */}
      {error && (
        <p className="mt-4 text-center text-sm text-[var(--smr-accent-red)]">{error}</p>
      )}
    </GlassCard>
  );
}

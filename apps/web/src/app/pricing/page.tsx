import Link from 'next/link';
import { ArrowLeft, Check, CreditCard, Wallet, Clock } from 'lucide-react';
import { PLANS } from '@radar/shared';
import { GlassCard } from '@/components/ui/glass-card';
import { GridBackground } from '@/components/ui/grid-background';
import { Badge } from '@/components/ui/badge';
import { HelioCheckoutButton } from '@/components/helio-checkout';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: '定价 - Smart Money Radar',
  description: '选择适合你的聪明钱追踪计划',
};

const featureTranslations: Record<string, string> = {
  'Real-time smart money alerts via Telegram': '通过 Telegram 接收实时聪明钱告警',
  'AI-powered buy rationale (<50 words)': 'AI 驱动的买入理由分析（< 50 字）',
  'Rug-pull protection (Mint/Freeze authority check)': 'Rug-pull 防护（Mint/Freeze Authority 检测）',
  'Web Dashboard with alert history': 'Web 控制台 + 告警历史记录',
  'Tracked wallet details and scoring': '追踪钱包详情与评分',
};

export default async function PricingPage() {
  const proPlan = PLANS.pro;
  const t = await getTranslations();

  return (
    <main className="relative flex min-h-screen flex-col items-center px-4 py-16">
      <GridBackground />

      <Link
        href="/"
        className="relative mb-12 inline-flex cursor-pointer items-center gap-1 text-sm text-smr-text-muted transition hover:text-smr-text"
      >
        <ArrowLeft size={14} />
        {t('common.backToHome')}
      </Link>

      <h1 className="relative mb-4 text-4xl font-bold tracking-tight text-smr-text">
        {t('pricing.title')}
      </h1>
      <p className="relative mb-12 max-w-md text-center text-smr-text-secondary">
        {t('pricing.subtitle')}
      </p>

      {/* 套餐卡片 */}
      <GlassCard className="relative w-full max-w-md p-8" glow="cyan">
        <h3 className="mb-2 text-xl font-bold text-smr-text">{proPlan.name}</h3>

        <div className="mb-6 flex items-baseline gap-1">
          <span className="font-data text-4xl font-bold text-[var(--smr-accent-cyan)]">
            ${proPlan.priceMonthly}
          </span>
          <span className="text-smr-text-muted">/月</span>
        </div>

        <ul className="mb-8 space-y-3">
          {proPlan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm">
              <Check size={16} className="mt-0.5 shrink-0 text-[var(--smr-accent-green)]" />
              <span className="text-smr-text-secondary">
                {featureTranslations[feature] ?? feature}
              </span>
            </li>
          ))}
        </ul>

        {/* ─── 支付方式 ─── */}
        <div className="space-y-3">
          {/* Helio Pay — 加密支付（主要） */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Wallet size={14} className="text-[var(--smr-accent-cyan)]" />
              <span className="text-xs font-medium text-smr-text-secondary">{t('pricing.cryptoPay')}</span>
              <Badge variant="green" size="sm">{t('pricing.recommended')}</Badge>
            </div>
            <HelioCheckoutButton />
          </div>

          {/* Paddle — 法币支付（待开放） */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <CreditCard size={14} className="text-smr-text-muted" />
              <span className="text-xs font-medium text-smr-text-muted">{t('pricing.cardPay')}</span>
              <Badge variant="muted" size="sm">
                <Clock size={10} className="mr-1" />
                {t('pricing.comingSoon')}
              </Badge>
            </div>
            <button
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-[var(--smr-glass-border)] bg-[var(--smr-bg-elevated)] py-3 text-sm text-smr-text-muted opacity-50"
            >
              {t('pricing.cardDisabled')}
            </button>
          </div>
        </div>
      </GlassCard>

      <p className="relative mt-8 max-w-sm text-center text-xs text-smr-text-muted">
        {t('pricing.helioNote')}
      </p>

      {/* 底部链接 */}
      <div className="relative mt-6 flex gap-4 text-xs text-smr-text-muted">
        <Link href="/terms" className="cursor-pointer transition hover:text-smr-text">{t('footer.terms')}</Link>
        <Link href="/privacy" className="cursor-pointer transition hover:text-smr-text">{t('footer.privacy')}</Link>
        <Link href="/refund" className="cursor-pointer transition hover:text-smr-text">{t('footer.refund')}</Link>
      </div>
    </main>
  );
}

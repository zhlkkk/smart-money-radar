'use client';

import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import {
  Brain,
  TrendingUp,
  ShieldCheck,
  Lock,
  Eye,
  KeyRound,
  Zap,
  ArrowRight,
  Radar,
  Radio,
  Cpu,
  Bell,
  Target,
  Layers,
  ChevronRight,
  Wallet,
  BarChart3,
  ShieldAlert,
  Globe,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { GridBackground } from '@/components/ui/grid-background';
import { MiniSparkline } from '@/components/ui/mini-sparkline';
import { ScoreRing } from '@/components/ui/score-ring';
import { StatusPulse } from '@/components/ui/status-pulse';
import { Badge } from '@/components/ui/badge';
import { AnimateOnScroll } from '@/components/ui/animate-on-scroll';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { TypingText } from '@/components/ui/typing-text';
import { ParticleField } from '@/components/ui/particle-field';
import { LiveAlertFeed } from '@/components/ui/live-alert-feed';
import { GlowCursor } from '@/components/ui/glow-cursor';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LocaleToggle } from '@/components/ui/locale-toggle';

// ─── 模拟数据 ───
const demoPrice = [20, 25, 22, 30, 28, 35, 32, 42, 38, 45, 50, 48, 55, 52, 60, 58, 65, 70, 68, 75];
const demoVolume = [5, 8, 6, 12, 9, 15, 11, 18, 14, 20, 16, 22, 19, 25, 21, 28, 24, 30, 26, 32];

const colorClasses = {
  cyan: {
    text: 'text-[var(--smr-accent-cyan)]',
    bg: 'bg-[var(--smr-accent-cyan)]/10',
    glow: 'bg-[var(--smr-accent-cyan)]/5',
    border: 'border-[var(--smr-accent-cyan)]/20',
  },
  gold: {
    text: 'text-[var(--smr-accent-gold)]',
    bg: 'bg-[var(--smr-accent-gold)]/10',
    glow: 'bg-[var(--smr-accent-gold)]/5',
    border: 'border-[var(--smr-accent-gold)]/20',
  },
  green: {
    text: 'text-[var(--smr-accent-green)]',
    bg: 'bg-[var(--smr-accent-green)]/10',
    glow: 'bg-[var(--smr-accent-green)]/5',
    border: 'border-[var(--smr-accent-green)]/20',
  },
  red: {
    text: 'text-[var(--smr-accent-red)]',
    bg: 'bg-[var(--smr-accent-red)]/10',
    glow: 'bg-[var(--smr-accent-red)]/5',
    border: 'border-[var(--smr-accent-red)]/20',
  },
};

export default function HomePage() {
  const t = useTranslations('hero');
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tStats = useTranslations('stats');
  const tCap = useTranslations('capabilities');
  const tCapViz = useTranslations('capViz');
  const tWorkflow = useTranslations('workflow');
  const tSecurity = useTranslations('security');
  const tCta = useTranslations('cta');
  const tFooter = useTranslations('footer');
  const tDemoChart = useTranslations('demoChart');
  const tDemoWallet = useTranslations('demoWallet');

  // ─── 核心能力数据 ───
  const capabilities = [
    {
      icon: <Radio size={24} />,
      title: tCap('signal.title'),
      subtitle: tCap('signal.subtitle'),
      description: tCap('signal.description'),
      color: 'cyan' as const,
      metrics: [
        { label: tCap('signal.metric1Label'), value: tCap('signal.metric1Value') },
        { label: tCap('signal.metric2Label'), value: tCap('signal.metric2Value') },
      ],
    },
    {
      icon: <Cpu size={24} />,
      title: tCap('ai.title'),
      subtitle: tCap('ai.subtitle'),
      description: tCap('ai.description'),
      color: 'gold' as const,
      metrics: [
        { label: tCap('ai.metric1Label'), value: tCap('ai.metric1Value') },
        { label: tCap('ai.metric2Label'), value: tCap('ai.metric2Value') },
      ],
    },
    {
      icon: <Target size={24} />,
      title: tCap('discovery.title'),
      subtitle: tCap('discovery.subtitle'),
      description: tCap('discovery.description'),
      color: 'green' as const,
      metrics: [
        { label: tCap('discovery.metric1Label'), value: tCap('discovery.metric1Value') },
        { label: tCap('discovery.metric2Label'), value: tCap('discovery.metric2Value') },
      ],
    },
    {
      icon: <ShieldAlert size={24} />,
      title: tCap('shield.title'),
      subtitle: tCap('shield.subtitle'),
      description: tCap('shield.description'),
      color: 'red' as const,
      metrics: [
        { label: tCap('shield.metric1Label'), value: tCap('shield.metric1Value') },
        { label: tCap('shield.metric2Label'), value: tCap('shield.metric2Value') },
      ],
    },
  ];

  // ─── 工作流步骤 ───
  const workflow = [
    {
      step: '01',
      icon: <Globe size={28} />,
      title: tWorkflow('step1.title'),
      description: tWorkflow('step1.description'),
      color: 'cyan' as const,
    },
    {
      step: '02',
      icon: <Layers size={28} />,
      title: tWorkflow('step2.title'),
      description: tWorkflow('step2.description'),
      color: 'gold' as const,
    },
    {
      step: '03',
      icon: <Brain size={28} />,
      title: tWorkflow('step3.title'),
      description: tWorkflow('step3.description'),
      color: 'green' as const,
    },
    {
      step: '04',
      icon: <Bell size={28} />,
      title: tWorkflow('step4.title'),
      description: tWorkflow('step4.description'),
      color: 'cyan' as const,
    },
  ];

  // ─── 安全特性 ───
  const securityFeatures = [
    { icon: <Lock size={20} />, title: tSecurity('e2e.title'), description: tSecurity('e2e.description') },
    { icon: <Eye size={20} />, title: tSecurity('readonly.title'), description: tSecurity('readonly.description') },
    { icon: <KeyRound size={20} />, title: tSecurity('noKeys.title'), description: tSecurity('noKeys.description') },
  ];

  // ─── 统计数据 ───
  const stats = [
    { value: tStats('latencyValue'), label: tStats('latencyLabel'), sub: tStats('latencySub') },
    { value: tStats('walletsValue'), label: tStats('walletsLabel'), sub: tStats('walletsSub') },
    { value: tStats('uptimeValue'), label: tStats('uptimeLabel'), sub: tStats('uptimeSub') },
    { value: tStats('reliabilityValue'), label: tStats('reliabilityLabel'), sub: tStats('reliabilitySub') },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-smr-bg">
      <GridBackground />

      {/* ═══════════════════════════════════════════
          顶部导航栏
      ═══════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 border-b border-[var(--smr-glass-border)] backdrop-blur-xl" style={{ background: 'var(--smr-nav-bg)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--smr-accent-cyan)]/10">
              <Radar size={18} className="text-[var(--smr-accent-cyan)]" />
            </div>
            <span className="text-lg font-bold text-smr-text">
              <span className="text-[var(--smr-accent-cyan)]">SMR</span>
              <span className="ml-1.5 hidden text-sm font-normal text-smr-text-muted sm:inline">Smart Money Radar</span>
            </span>
          </Link>
          <nav className="flex items-center gap-5">
            <a href="#capabilities" className="hidden cursor-pointer text-sm text-smr-text-secondary transition hover:text-smr-text md:block" style={{ transition: 'color var(--smr-transition-fast)' }}>{tNav('capabilities')}</a>
            <a href="#workflow" className="hidden cursor-pointer text-sm text-smr-text-secondary transition hover:text-smr-text md:block" style={{ transition: 'color var(--smr-transition-fast)' }}>{tNav('howItWorks')}</a>
            <Link href="/pricing" className="hidden cursor-pointer text-sm text-smr-text-secondary transition hover:text-smr-text md:block" style={{ transition: 'color var(--smr-transition-fast)' }}>{tNav('pricing')}</Link>
            <LocaleToggle />
            <ThemeToggle size={16} />
            <SignedOut>
              <Link href="/sign-in" className="cursor-pointer text-sm text-smr-text-secondary transition hover:text-smr-text" style={{ transition: 'color var(--smr-transition-fast)' }}>{tCommon('signIn')}</Link>
              <Link
                href="/sign-up"
                className="cursor-pointer rounded-lg bg-[var(--smr-accent-cyan)] px-4 py-2 text-sm font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
                style={{ boxShadow: 'var(--smr-glow-cyan)', transition: 'all var(--smr-transition-normal)' }}
              >
                {tCommon('startTracking')}
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="cursor-pointer rounded-lg bg-[var(--smr-accent-cyan)] px-4 py-2 text-sm font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
                style={{ boxShadow: 'var(--smr-glow-cyan)', transition: 'all var(--smr-transition-normal)' }}
              >
                {tCommon('enterDashboard')}
              </Link>
            </SignedIn>
          </nav>
        </div>
      </header>

      {/* ═══════════════════════════════════════════
          Hero 区 — 居中大标题 + 实时数据面板
      ═══════════════════════════════════════════ */}
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-16 md:pt-24">
        {/* 粒子背景 */}
        <ParticleField count={35} className="opacity-60" />
        {/* 鼠标跟随光晕 */}
        <GlowCursor />

        {/* 多层背景光晕 */}
        <div aria-hidden className="pointer-events-none absolute -left-40 -top-20 h-[500px] w-[500px] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, var(--smr-accent-cyan) 0%, transparent 70%)', opacity: 'var(--smr-glow-hero-opacity)' }} />
        <div aria-hidden className="pointer-events-none absolute -right-20 top-20 h-[300px] w-[300px] rounded-full blur-[100px]" style={{ background: 'radial-gradient(circle, var(--smr-accent-gold) 0%, transparent 70%)', opacity: 'var(--smr-glow-hero-opacity)' }} />

        {/* 居中文案 */}
        <div className="relative mx-auto max-w-3xl text-center" style={{ animation: 'float-up 800ms ease-out' }}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--smr-glass-border)] bg-[var(--smr-glass-bg)] px-4 py-1.5 backdrop-blur-sm" style={{ animation: 'scale-in 600ms ease-out 200ms both' }}>
            <StatusPulse status="ok" size="sm" />
            <span className="font-data text-xs text-smr-text-secondary">{t('badge')}</span>
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-[1.15] tracking-tight text-smr-text md:text-6xl lg:text-7xl">
            {t('title1')}
            <br />
            <span className="text-[var(--smr-accent-cyan)]" style={{ textShadow: 'var(--smr-text-glow)' }}>
              {t('title2')}
            </span>
          </h1>
          <div className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-smr-text-secondary md:text-lg">
            <TypingText
              text={t('subtitle')}
              speed={30}
              delay={800}
            />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <SignedOut>
              <Link
                href="/sign-up"
                className="group cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[var(--smr-accent-cyan)] px-8 py-3.5 text-base font-semibold text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
                style={{ boxShadow: 'var(--smr-glow-cyan-strong)', transition: 'all var(--smr-transition-normal)' }}
              >
                {t('cta1')}
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#workflow"
                className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-[var(--smr-glass-border)] bg-[var(--smr-glass-bg)] px-8 py-3.5 text-base text-smr-text-secondary backdrop-blur-sm transition hover:border-[var(--smr-border-hover)] hover:text-smr-text"
                style={{ transition: 'all var(--smr-transition-normal)' }}
              >
                {t('cta2')}
              </a>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="group cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[var(--smr-accent-cyan)] px-8 py-3.5 text-base font-semibold text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
                style={{ boxShadow: 'var(--smr-glow-cyan-strong)', transition: 'all var(--smr-transition-normal)' }}
              >
                {tCommon('enterDashboard')}
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </SignedIn>
          </div>
        </div>

        {/* 实时数据面板 — 三列 */}
        <div className="relative mt-16 grid gap-4 md:grid-cols-3">
          {/* 模拟告警轮播 */}
          <AnimateOnScroll animation="fade-up" delay={0} className="h-full">
            <LiveAlertFeed className="h-full" />
          </AnimateOnScroll>

          {/* 价格走势面板 */}
          <AnimateOnScroll animation="fade-up" delay={150} className="h-full">
          <GlassCard className="h-full p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-smr-text-secondary">{tDemoChart('title')}</span>
              <Badge variant="green" size="sm">+23.5%</Badge>
            </div>
            <div className="mb-1 font-data text-2xl font-bold text-smr-text">$0.00847</div>
            <div className="mb-3 font-data text-xs text-smr-text-muted">SOL/USDC · 24h</div>
            <MiniSparkline data={demoPrice} color="var(--smr-accent-green)" width={280} height={80} filled />
            <div className="mt-3 flex justify-between border-t border-[var(--smr-glass-border)] pt-2">
              <div className="text-center">
                <div className="text-[9px] text-smr-text-muted">{tDemoChart('vol')}</div>
                <div className="font-data text-xs font-medium text-smr-text">$12.4M</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-smr-text-muted">{tDemoChart('holders')}</div>
                <div className="font-data text-xs font-medium text-smr-text">1,247</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-smr-text-muted">{tDemoChart('smartMoneyPct')}</div>
                <div className="font-data text-xs font-medium text-[var(--smr-accent-gold)]">8.3%</div>
              </div>
            </div>
          </GlassCard>
          </AnimateOnScroll>

          {/* 钱包评分面板 */}
          <AnimateOnScroll animation="fade-up" delay={300} className="h-full">
          <GlassCard className="h-full p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-smr-text-secondary">{tDemoWallet('title')}</span>
              <Badge variant="gold" size="sm">TOP 10</Badge>
            </div>
            <div className="space-y-3">
              {[
                { addr: '7nYp...x3Kq', score: 0.92, pnl: '+340%', wins: '78%' },
                { addr: 'Dk8m...vR2j', score: 0.85, pnl: '+180%', wins: '71%' },
                { addr: '3xFa...mN9p', score: 0.78, pnl: '+95%', wins: '65%' },
              ].map((w) => (
                <div key={w.addr} className="flex items-center gap-3 rounded-lg bg-[var(--smr-bg-elevated)] px-3 py-2">
                  <ScoreRing score={w.score} size={32} strokeWidth={2} />
                  <div className="flex-1">
                    <div className="font-data text-xs font-medium text-smr-text">{w.addr}</div>
                    <div className="flex gap-3">
                      <span className="font-data text-[10px] text-[var(--smr-accent-green)]">{w.pnl}</span>
                      <span className="font-data text-[10px] text-smr-text-muted">{tDemoWallet('winRate')} {w.wins}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          关键数据指标
      ═══════════════════════════════════════════ */}
      <section className="border-y border-[var(--smr-glass-border)]" style={{ background: 'linear-gradient(180deg, var(--smr-section-gradient-from) 0%, var(--smr-section-gradient-to) 100%)' }}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-10 md:grid-cols-4">
          {stats.map((stat, i) => (
            <AnimateOnScroll key={stat.label} animation="scale-in" delay={i * 100}>
              <div className="text-center">
                <AnimatedCounter value={stat.value} className="font-data text-3xl font-bold text-[var(--smr-accent-cyan)] md:text-4xl" />
                <div className="mt-1 text-sm font-medium text-smr-text">{stat.label}</div>
                <div className="font-data mt-0.5 text-[10px] text-smr-text-muted">{stat.sub}</div>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          核心能力 — 交替左右布局
      ═══════════════════════════════════════════ */}
      <section id="capabilities" className="relative mx-auto max-w-6xl px-6 py-20">
        <div className="mb-4 text-center">
          <Badge variant="cyan" size="md">{tCap('badge')}</Badge>
        </div>
        <h2 className="mb-4 text-center text-3xl font-bold text-smr-text md:text-4xl">
          {tCap('title')}
        </h2>
        <p className="mx-auto mb-16 max-w-lg text-center text-smr-text-secondary">
          {tCap('subtitle')}
        </p>

        <div className="space-y-12">
          {capabilities.map((cap, i) => {
            const c = colorClasses[cap.color];
            const isReversed = i % 2 === 1;
            return (
              <AnimateOnScroll key={cap.title} animation={isReversed ? 'slide-right' : 'slide-left'} delay={100}>
              <div className={`flex flex-col gap-6 md:flex-row md:items-center ${isReversed ? 'md:flex-row-reverse' : ''}`}>
                {/* 文字侧 */}
                <div className="flex-1">
                  <div className={`mb-3 inline-flex items-center gap-2 rounded-full ${c.bg} px-3 py-1`}>
                    <span className={c.text}>{cap.icon}</span>
                    <span className={`font-data text-[10px] font-medium uppercase tracking-wider ${c.text}`}>{cap.subtitle}</span>
                  </div>
                  <h3 className="mb-3 text-2xl font-bold text-smr-text">{cap.title}</h3>
                  <p className="mb-4 leading-relaxed text-smr-text-secondary">{cap.description}</p>
                  <div className="flex gap-4">
                    {cap.metrics.map((m) => (
                      <div key={m.label} className="rounded-lg border border-[var(--smr-glass-border)] bg-[var(--smr-bg-elevated)] px-3 py-2">
                        <div className="text-[10px] text-smr-text-muted">{m.label}</div>
                        <div className={`font-data text-sm font-bold ${c.text}`}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 可视化侧 */}
                <div className="flex flex-1 justify-center">
                  <GlassCard className={`relative w-full max-w-xs overflow-hidden p-5 ${c.border}`}>
                    <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full ${c.glow} blur-2xl`} />
                    <div className="relative">
                      {i === 0 && (
                        <>
                          <div className="mb-2 flex items-center gap-2">
                            <StatusPulse status="ok" size="md" />
                            <span className="font-data text-xs text-smr-text-secondary">{tCapViz('webhookConnected')}</span>
                          </div>
                          <div className="space-y-2">
                            {['Swap: 7nYp → $BONK', 'Swap: Dk8m → $WIF', 'Swap: 3xFa → $JUP'].map((tx) => (
                              <div key={tx} className="flex items-center gap-2 rounded bg-[var(--smr-bg-elevated)] px-2 py-1.5">
                                <div className="h-1.5 w-1.5 rounded-full bg-[var(--smr-accent-cyan)]" />
                                <span className="font-data text-[11px] text-smr-text">{tx}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      {i === 1 && (
                        <>
                          <div className="mb-3 rounded-md bg-[var(--smr-bg-elevated)] px-3 py-2">
                            <div className="mb-1 flex items-center gap-1">
                              <Brain size={12} className="text-[var(--smr-accent-gold)]" />
                              <span className="font-data text-[10px] text-[var(--smr-accent-gold)]">{tCapViz('aiOutput')}</span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-smr-text-secondary">
                              高流动性 meme 代币，该钱包近期胜率 78%，连续盈利 5 笔，或为短线波段布局。建议关注后续加仓动作。
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="gold">{tCapViz('confidence')}</Badge>
                            <Badge variant="green">{tCapViz('lowRisk')}</Badge>
                          </div>
                        </>
                      )}
                      {i === 2 && (
                        <div className="space-y-2">
                          {[
                            { addr: '7nYp...x3Kq', score: 0.92 },
                            { addr: 'Dk8m...vR2j', score: 0.85 },
                            { addr: '3xFa...mN9p', score: 0.71 },
                            { addr: 'Qw4r...j8Lm', score: 0.58 },
                          ].map((w) => (
                            <div key={w.addr} className="flex items-center gap-3">
                              <ScoreRing score={w.score} size={28} strokeWidth={2} />
                              <span className="font-data flex-1 text-xs text-smr-text">{w.addr}</span>
                              {w.score >= 0.8 && <Badge variant="green">{tCapViz('addToMonitor')}</Badge>}
                            </div>
                          ))}
                        </div>
                      )}
                      {i === 3 && (
                        <>
                          <div className="mb-3 flex items-center gap-2 rounded-md bg-[var(--smr-accent-red)]/10 px-3 py-2">
                            <ShieldAlert size={14} className="text-[var(--smr-accent-red)]" />
                            <span className="text-[11px] text-[var(--smr-accent-red)]">{tCapViz('freezeDetected')}</span>
                          </div>
                          <div className="space-y-1.5">
                            {[
                              { label: tCapViz('mintAuthority'), status: tCapViz('revoked'), safe: true },
                              { label: tCapViz('freezeAuthority'), status: tCapViz('exists'), safe: false },
                              { label: tCapViz('liquidityLock'), status: tCapViz('unlocked'), safe: false },
                            ].map((check) => (
                              <div key={check.label} className="flex items-center justify-between rounded bg-[var(--smr-bg-elevated)] px-2 py-1.5">
                                <span className="text-[11px] text-smr-text-muted">{check.label}</span>
                                <span className={`font-data text-[11px] font-medium ${check.safe ? 'text-[var(--smr-accent-green)]' : 'text-[var(--smr-accent-red)]'}`}>
                                  {check.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </GlassCard>
                </div>
              </div>
              </AnimateOnScroll>
            );
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          工作流程 — How it works
      ═══════════════════════════════════════════ */}
      <section id="workflow" className="border-t border-[var(--smr-glass-border)] py-20" style={{ background: 'linear-gradient(180deg, var(--smr-bg-primary) 0%, var(--smr-section-gradient-from) 50%, var(--smr-bg-primary) 100%)' }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-4 text-center">
            <Badge variant="gold" size="md">{tWorkflow('badge')}</Badge>
          </div>
          <h2 className="mb-4 text-center text-3xl font-bold text-smr-text md:text-4xl">
            {tWorkflow('title')}
          </h2>
          <p className="mx-auto mb-16 max-w-md text-center text-smr-text-secondary">
            {tWorkflow('subtitle')}
          </p>

          <div className="relative grid gap-6 md:grid-cols-4">
            {/* 连接线（桌面端） */}
            <div aria-hidden className="pointer-events-none absolute left-0 right-0 top-14 hidden h-px bg-gradient-to-r from-transparent via-[var(--smr-glass-border)] to-transparent md:block" />

            {workflow.map((step, i) => {
              const c = colorClasses[step.color];
              return (
                <AnimateOnScroll key={step.step} animation="fade-up" delay={i * 150}>
                <div className="relative text-center">
                  {/* 步骤编号 */}
                  <div className={`relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${c.bg} ring-4 ring-[var(--smr-bg-primary)]`}>
                    <span className={c.text}>{step.icon}</span>
                  </div>
                  <div className={`font-data mb-1 text-xs font-bold ${c.text}`}>STEP {step.step}</div>
                  <h3 className="mb-2 text-lg font-semibold text-smr-text">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-smr-text-muted">{step.description}</p>
                </div>
                </AnimateOnScroll>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          安全信任区
      ═══════════════════════════════════════════ */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-4 text-center">
          <Badge variant="green" size="md">{tSecurity('badge')}</Badge>
        </div>
        <h2 className="mb-12 text-center text-3xl font-bold text-smr-text">
          {tSecurity('title')}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {securityFeatures.map((item, i) => (
            <AnimateOnScroll key={item.title} animation="fade-up" delay={i * 100} className="h-full">
            <GlassCard className="flex h-full items-start gap-4 p-5" hover>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--smr-accent-green)]/10">
                <span className="text-[var(--smr-accent-green)]">{item.icon}</span>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold text-smr-text">{item.title}</h3>
                <p className="text-sm text-smr-text-muted">{item.description}</p>
              </div>
            </GlassCard>
            </AnimateOnScroll>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          底部 CTA
      ═══════════════════════════════════════════ */}
      <section className="relative mx-auto max-w-6xl px-6 py-20">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-[120px]" style={{ background: 'radial-gradient(circle, var(--smr-accent-cyan) 0%, transparent 70%)' }} />
        <AnimateOnScroll animation="scale-in">
        <GlassCard className="relative mx-auto max-w-2xl overflow-hidden p-10 text-center" hover={false}>
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--smr-accent-cyan)]/5 blur-2xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[var(--smr-accent-gold)]/5 blur-2xl" />
          <div className="relative">
            <h2 className="mb-3 text-3xl font-bold text-smr-text">
              {tCta('title')}
            </h2>
            <p className="mb-8 text-smr-text-secondary">
              {tCta('subtitle')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/pricing"
                className="group cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[var(--smr-accent-cyan)] px-8 py-3.5 text-base font-semibold text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
                style={{ boxShadow: 'var(--smr-glow-cyan-strong)', transition: 'all var(--smr-transition-normal)' }}
              >
                {tCommon('viewPricing')}
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="mt-6 flex items-center justify-center gap-6 text-xs text-smr-text-muted">
              <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[var(--smr-accent-green)]" /> {tCta('trust1')}</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[var(--smr-accent-green)]" /> {tCta('trust2')}</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[var(--smr-accent-green)]" /> {tCta('trust3')}</span>
            </div>
          </div>
        </GlassCard>
        </AnimateOnScroll>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--smr-glass-border)] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="flex items-center gap-2">
            <Radar size={16} className="text-[var(--smr-accent-cyan)]" />
            <span className="text-sm font-medium text-smr-text-muted">Smart Money Radar</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-smr-text-muted">
            <Link href="/terms" className="cursor-pointer transition hover:text-smr-text">{tFooter('terms')}</Link>
            <Link href="/privacy" className="cursor-pointer transition hover:text-smr-text">{tFooter('privacy')}</Link>
            <Link href="/refund" className="cursor-pointer transition hover:text-smr-text">{tFooter('refund')}</Link>
          </div>
          <div className="font-data text-xs text-smr-text-muted">
            {tFooter('copyright')}
          </div>
        </div>
      </footer>
    </div>
  );
}

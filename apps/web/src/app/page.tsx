'use client';

import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';
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
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { GridBackground } from '@/components/ui/grid-background';
import { MiniSparkline } from '@/components/ui/mini-sparkline';

// 模拟价格走势数据
const demoChartData = [
  20, 25, 22, 30, 28, 35, 32, 42, 38, 45, 50, 48, 55, 52, 60, 58, 65, 70, 68, 75,
];

// 信任指标
const stats = [
  { value: '< 5s', label: '告警延迟' },
  { value: '50+', label: '追踪钱包' },
  { value: '24/7', label: '全天候监控' },
  { value: '99.9%', label: '消息可靠性' },
];

// 特性卡片
const features = [
  {
    icon: <Brain size={28} />,
    title: 'AI 告警分析',
    description:
      'Claude AI 自动生成买入理由，50 字精炼归因，快速理解聪明钱每笔交易的真实意图。',
    gradient: 'from-[var(--smr-accent-cyan)]/5 to-transparent',
  },
  {
    icon: <TrendingUp size={28} />,
    title: '聪明钱评分',
    description:
      'Birdeye 评分引擎持续发现新钱包，综合胜率、PNL、交易频率多维评估，自动扩大追踪范围。',
    gradient: 'from-[var(--smr-accent-green)]/5 to-transparent',
  },
  {
    icon: <ShieldCheck size={28} />,
    title: 'Rug 防护盾',
    description:
      '自动检测 Mint/Freeze Authority，过滤高风险代币，让你远离 Rug Pull 陷阱。',
    gradient: 'from-[var(--smr-accent-gold)]/5 to-transparent',
  },
];

// 安全特性
const securityFeatures = [
  {
    icon: <Lock size={22} />,
    title: '端到端加密',
    description: '所有数据传输均通过加密通道，确保你的交易信息安全无虞。',
  },
  {
    icon: <Eye size={22} />,
    title: '只读追踪',
    description: '仅监控链上公开交易，绝不触碰你的钱包资产。',
  },
  {
    icon: <KeyRound size={22} />,
    title: '无需私钥',
    description: '全程无需提交任何私钥或助记词，零风险接入。',
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-smr-bg">
      <GridBackground />

      {/* ─── 顶部导航栏 ─── */}
      <header className="sticky top-0 z-50 border-b border-[var(--smr-glass-border)] backdrop-blur-xl" style={{ background: 'rgba(10, 14, 26, 0.8)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Radar size={24} className="text-[var(--smr-accent-cyan)]" />
            <span className="text-lg font-bold text-[var(--smr-accent-cyan)]" style={{ textShadow: '0 0 20px rgba(0, 240, 255, 0.3)' }}>
              Smart Money Radar
            </span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="cursor-pointer text-sm text-smr-text-secondary transition hover:text-smr-text" style={{ transition: 'color var(--smr-transition-fast)' }}>功能</a>
            <Link href="/pricing" className="cursor-pointer text-sm text-smr-text-secondary transition hover:text-smr-text" style={{ transition: 'color var(--smr-transition-fast)' }}>定价</Link>
            <SignedOut>
              <Link href="/sign-in" className="cursor-pointer text-sm text-smr-text-secondary transition hover:text-smr-text" style={{ transition: 'color var(--smr-transition-fast)' }}>登录</Link>
              <Link
                href="/sign-up"
                className="cursor-pointer rounded-lg bg-[var(--smr-accent-cyan)] px-5 py-2 text-sm font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
                style={{ boxShadow: 'var(--smr-glow-cyan)', transition: 'all var(--smr-transition-normal)' }}
              >
                开始追踪
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="cursor-pointer rounded-lg bg-[var(--smr-accent-cyan)] px-5 py-2 text-sm font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
                style={{ boxShadow: 'var(--smr-glow-cyan)', transition: 'all var(--smr-transition-normal)' }}
              >
                进入控制台
              </Link>
            </SignedIn>
          </nav>
        </div>
      </header>

      {/* ─── Hero 区 ─── */}
      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
        {/* 背景光晕 */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-20 blur-[100px]"
          style={{ background: 'radial-gradient(circle, var(--smr-accent-cyan) 0%, transparent 70%)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 top-40 h-64 w-64 rounded-full opacity-10 blur-[80px]"
          style={{ background: 'radial-gradient(circle, var(--smr-accent-green) 0%, transparent 70%)' }}
        />

        <div className="relative grid gap-12 md:grid-cols-2 md:items-center">
          {/* 左侧文案 */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--smr-glass-border)] bg-[var(--smr-glass-bg)] px-4 py-1.5 text-sm text-smr-text-secondary backdrop-blur-sm">
              <Zap size={14} className="text-[var(--smr-accent-cyan)]" />
              Solana 链上聪明钱追踪器
            </div>
            <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-smr-text md:text-5xl lg:text-6xl">
              聪明钱动向
              <br />
              <span className="text-[var(--smr-accent-cyan)]" style={{ textShadow: '0 0 30px rgba(0, 240, 255, 0.2)' }}>
                尽在掌握
              </span>
            </h1>
            <p className="mb-10 max-w-lg text-lg leading-relaxed text-smr-text-secondary">
              追踪 Solana 链上顶级交易者，比散户快 10 分钟收到买入信号。AI 分析 + Rug 防护，让你不再做最后接盘侠。
            </p>
            <div className="flex flex-wrap gap-4">
              <SignedOut>
                <Link
                  href="/sign-up"
                  className="group cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[var(--smr-accent-cyan)] px-8 py-3 font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
                  style={{ boxShadow: 'var(--smr-glow-cyan-strong)', transition: 'all var(--smr-transition-normal)' }}
                >
                  免费注册
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/sign-in"
                  className="cursor-pointer rounded-lg border border-[var(--smr-glass-border)] bg-[var(--smr-glass-bg)] px-8 py-3 text-smr-text-secondary backdrop-blur-sm transition hover:border-[var(--smr-border-hover)] hover:text-smr-text"
                  style={{ transition: 'all var(--smr-transition-normal)' }}
                >
                  登录
                </Link>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/dashboard"
                  className="group cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[var(--smr-accent-cyan)] px-8 py-3 font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
                  style={{ boxShadow: 'var(--smr-glow-cyan-strong)', transition: 'all var(--smr-transition-normal)' }}
                >
                  进入控制台
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </SignedIn>
            </div>
          </div>

          {/* 右侧图表预览 */}
          <div className="flex justify-center md:justify-end">
            <GlassCard className="w-full max-w-sm p-6" glow="cyan">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-smr-text-secondary">实时走势</span>
                <span className="font-data text-xs text-[var(--smr-accent-green)]">+12.5%</span>
              </div>
              <div className="mb-2 font-data text-3xl font-bold text-[var(--smr-accent-cyan)]">
                $0.00847
              </div>
              <MiniSparkline
                data={demoChartData}
                color="var(--smr-accent-cyan)"
                width={300}
                height={100}
                filled
              />
              <div className="mt-3 grid grid-cols-3 gap-3 border-t border-[var(--smr-glass-border)] pt-3">
                <div>
                  <div className="text-[10px] text-smr-text-muted">流动性</div>
                  <div className="font-data text-xs font-medium text-smr-text">$2.4M</div>
                </div>
                <div>
                  <div className="text-[10px] text-smr-text-muted">FDV</div>
                  <div className="font-data text-xs font-medium text-smr-text">$8.5M</div>
                </div>
                <div>
                  <div className="text-[10px] text-smr-text-muted">24h Vol</div>
                  <div className="font-data text-xs font-medium text-smr-text">$1.2M</div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* ─── 信任指标栏 ─── */}
      <section className="border-y border-[var(--smr-glass-border)] bg-[var(--smr-glass-bg)] backdrop-blur-sm">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-6 py-8 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center text-center">
              <span className="font-data text-2xl font-bold text-[var(--smr-accent-cyan)] md:text-3xl">
                {stat.value}
              </span>
              <span className="mt-1 text-sm text-smr-text-muted">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── 功能特性区 ─── */}
      <section id="features" className="relative mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-4 text-center text-3xl font-bold text-smr-text">
          核心能力
        </h2>
        <p className="mx-auto mb-12 max-w-lg text-center text-smr-text-secondary">
          三重引擎驱动，让你在链上博弈中占据信息优势
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <GlassCard
              key={feature.title}
              className={`cursor-pointer bg-gradient-to-br ${feature.gradient} p-6 transition-transform hover:scale-[1.02]`}
              hover
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--smr-bg-elevated)]">
                <span className="text-[var(--smr-accent-cyan)]">{feature.icon}</span>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-smr-text">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-smr-text-secondary">
                {feature.description}
              </p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* ─── 安全信任区 ─── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-4 text-center text-3xl font-bold text-smr-text">
          安全至上
        </h2>
        <p className="mx-auto mb-12 max-w-lg text-center text-smr-text-secondary">
          你的资产安全是我们的底线，全程零风险接入
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {securityFeatures.map((item) => (
            <GlassCard key={item.title} className="flex items-start gap-4 p-6" hover>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--smr-accent-green)]/10">
                <span className="text-[var(--smr-accent-green)]">{item.icon}</span>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold text-smr-text">{item.title}</h3>
                <p className="text-sm leading-relaxed text-smr-text-muted">{item.description}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* ─── 底部 CTA ─── */}
      <section className="relative mx-auto max-w-6xl px-6 py-20 text-center">
        {/* 背景光晕 */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15 blur-[100px]"
          style={{ background: 'radial-gradient(circle, var(--smr-accent-cyan) 0%, transparent 70%)' }}
        />
        <h2 className="relative mb-4 text-3xl font-bold text-smr-text">
          准备好追踪聪明钱了吗？
        </h2>
        <p className="relative mb-8 text-smr-text-secondary">
          Pro 计划 $100/月，解锁全部功能
        </p>
        <Link
          href="/pricing"
          className="group relative inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--smr-accent-cyan)] px-8 py-3 font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
          style={{ boxShadow: 'var(--smr-glow-cyan-strong)', transition: 'all var(--smr-transition-normal)' }}
        >
          查看定价
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[var(--smr-glass-border)] py-8 text-center text-xs text-smr-text-muted">
        © 2026 Smart Money Radar. All rights reserved.
      </footer>
    </div>
  );
}

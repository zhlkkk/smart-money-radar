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

// ─── 模拟数据 ───
const demoPrice = [20, 25, 22, 30, 28, 35, 32, 42, 38, 45, 50, 48, 55, 52, 60, 58, 65, 70, 68, 75];
const demoVolume = [5, 8, 6, 12, 9, 15, 11, 18, 14, 20, 16, 22, 19, 25, 21, 28, 24, 30, 26, 32];

// ─── 核心能力数据 ───
const capabilities = [
  {
    icon: <Radio size={24} />,
    title: '链上信号捕获',
    subtitle: 'On-chain Signal Capture',
    description: '通过 Helius Enhanced Webhooks 实时监听 Solana 链上交易，毫秒级捕获聪明钱的每一笔 swap 操作。',
    color: 'cyan' as const,
    metrics: [
      { label: '监听延迟', value: '< 500ms' },
      { label: '交易类型', value: 'DEX Swap' },
    ],
  },
  {
    icon: <Cpu size={24} />,
    title: 'AI 归因引擎',
    subtitle: 'AI Attribution Engine',
    description: 'Claude AI 深度分析每笔交易的上下文——代币基本面、流动性变化、历史模式，生成 50 字精炼买入理由。',
    color: 'gold' as const,
    metrics: [
      { label: '分析模型', value: 'Claude 3.5' },
      { label: '输出格式', value: '50 字摘要' },
    ],
  },
  {
    icon: <Target size={24} />,
    title: '智能钱包发现',
    subtitle: 'Smart Wallet Discovery',
    description: 'Birdeye 评分引擎持续扫描链上活跃地址，多维度评估胜率、PNL、交易频率，自动将高评分钱包纳入监控。',
    color: 'green' as const,
    metrics: [
      { label: '评分维度', value: '5 项指标' },
      { label: '发现频率', value: '每日更新' },
    ],
  },
  {
    icon: <ShieldAlert size={24} />,
    title: 'Rug Pull 防护',
    subtitle: 'Rug Protection Shield',
    description: '自动检测代币的 Mint Authority 和 Freeze Authority 状态，在告警中标注风险等级，帮你避开高危代币。',
    color: 'red' as const,
    metrics: [
      { label: '检测项', value: 'Mint + Freeze' },
      { label: '风险标注', value: '实时告警' },
    ],
  },
];

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

// ─── 工作流步骤 ───
const workflow = [
  {
    step: '01',
    icon: <Globe size={28} />,
    title: '链上监听',
    description: 'Helius Webhook 实时接收 Solana 链上聪明钱交易事件',
    color: 'cyan' as const,
  },
  {
    step: '02',
    icon: <Layers size={28} />,
    title: '多维富集',
    description: 'DexScreener 流动性 + Solana RPC Authority 检查，2 秒内完成',
    color: 'gold' as const,
  },
  {
    step: '03',
    icon: <Brain size={28} />,
    title: 'AI 分析',
    description: 'Claude AI 生成买入理由归因，附带风险评级',
    color: 'green' as const,
  },
  {
    step: '04',
    icon: <Bell size={28} />,
    title: '即时推送',
    description: 'Telegram + Web Dashboard 双通道告警，延迟 < 5 秒',
    color: 'cyan' as const,
  },
];

// ─── 安全特性 ───
const securityFeatures = [
  { icon: <Lock size={20} />, title: '端到端加密', description: '所有数据传输均通过 TLS 加密通道' },
  { icon: <Eye size={20} />, title: '只读追踪', description: '仅监控链上公开交易，不触碰资产' },
  { icon: <KeyRound size={20} />, title: '无需私钥', description: '全程零私钥提交，零资产风险' },
];

export default function HomePage() {
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
            <a href="#capabilities" className="hidden cursor-pointer text-sm text-smr-text-secondary transition hover:text-smr-text md:block" style={{ transition: 'color var(--smr-transition-fast)' }}>核心能力</a>
            <a href="#workflow" className="hidden cursor-pointer text-sm text-smr-text-secondary transition hover:text-smr-text md:block" style={{ transition: 'color var(--smr-transition-fast)' }}>工作原理</a>
            <Link href="/pricing" className="hidden cursor-pointer text-sm text-smr-text-secondary transition hover:text-smr-text md:block" style={{ transition: 'color var(--smr-transition-fast)' }}>定价</Link>
            <ThemeToggle size={16} />
            <SignedOut>
              <Link href="/sign-in" className="cursor-pointer text-sm text-smr-text-secondary transition hover:text-smr-text" style={{ transition: 'color var(--smr-transition-fast)' }}>登录</Link>
              <Link
                href="/sign-up"
                className="cursor-pointer rounded-lg bg-[var(--smr-accent-cyan)] px-4 py-2 text-sm font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
                style={{ boxShadow: 'var(--smr-glow-cyan)', transition: 'all var(--smr-transition-normal)' }}
              >
                开始追踪
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="cursor-pointer rounded-lg bg-[var(--smr-accent-cyan)] px-4 py-2 text-sm font-medium text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
                style={{ boxShadow: 'var(--smr-glow-cyan)', transition: 'all var(--smr-transition-normal)' }}
              >
                进入控制台
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
            <span className="font-data text-xs text-smr-text-secondary">实时监控中 · Solana Mainnet</span>
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-[1.15] tracking-tight text-smr-text md:text-6xl lg:text-7xl">
            链上聪明钱
            <br />
            <span className="text-[var(--smr-accent-cyan)]" style={{ textShadow: 'var(--smr-text-glow)' }}>
              实时追踪引擎
            </span>
          </h1>
          <div className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-smr-text-secondary md:text-lg">
            <TypingText
              text="Webhook 监听 → 多维富集 → AI 归因 → 即时推送。端到端 < 5 秒，让你比散户快 10 分钟收到买入信号。"
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
                免费注册
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#workflow"
                className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-[var(--smr-glass-border)] bg-[var(--smr-glass-bg)] px-8 py-3.5 text-base text-smr-text-secondary backdrop-blur-sm transition hover:border-[var(--smr-border-hover)] hover:text-smr-text"
                style={{ transition: 'all var(--smr-transition-normal)' }}
              >
                了解工作原理
              </a>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="group cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[var(--smr-accent-cyan)] px-8 py-3.5 text-base font-semibold text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
                style={{ boxShadow: 'var(--smr-glow-cyan-strong)', transition: 'all var(--smr-transition-normal)' }}
              >
                进入控制台
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </SignedIn>
          </div>
        </div>

        {/* 实时数据面板 — 三列 */}
        <div className="relative mt-16 grid gap-4 md:grid-cols-3">
          {/* 模拟告警轮播 */}
          <AnimateOnScroll animation="fade-up" delay={0}>
            <LiveAlertFeed />
          </AnimateOnScroll>

          {/* 价格走势面板 */}
          <AnimateOnScroll animation="fade-up" delay={150}>
          <GlassCard className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-smr-text-secondary">追踪钱包动态</span>
              <Badge variant="green" size="sm">+23.5%</Badge>
            </div>
            <div className="mb-1 font-data text-2xl font-bold text-smr-text">$0.00847</div>
            <div className="mb-3 font-data text-xs text-smr-text-muted">SOL/USDC · 24h</div>
            <MiniSparkline data={demoPrice} color="var(--smr-accent-green)" width={280} height={80} filled />
            <div className="mt-3 flex justify-between border-t border-[var(--smr-glass-border)] pt-2">
              <div className="text-center">
                <div className="text-[9px] text-smr-text-muted">24h Vol</div>
                <div className="font-data text-xs font-medium text-smr-text">$12.4M</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-smr-text-muted">持仓钱包</div>
                <div className="font-data text-xs font-medium text-smr-text">1,247</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-smr-text-muted">聪明钱占比</div>
                <div className="font-data text-xs font-medium text-[var(--smr-accent-gold)]">8.3%</div>
              </div>
            </div>
          </GlassCard>
          </AnimateOnScroll>

          {/* 钱包评分面板 */}
          <AnimateOnScroll animation="fade-up" delay={300}>
          <GlassCard className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-smr-text-secondary">钱包评分</span>
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
                      <span className="font-data text-[10px] text-smr-text-muted">胜率 {w.wins}</span>
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
          {[
            { value: '< 5s', label: '端到端延迟', sub: 'Webhook → Telegram' },
            { value: '50+', label: '追踪钱包', sub: '自动发现 + 人工标记' },
            { value: '24/7', label: '全天候监控', sub: '零停机运行' },
            { value: '99.9%', label: '消息可靠性', sub: 'Graceful Degradation' },
          ].map((stat, i) => (
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
          <Badge variant="cyan" size="md">CORE CAPABILITIES</Badge>
        </div>
        <h2 className="mb-4 text-center text-3xl font-bold text-smr-text md:text-4xl">
          四大核心引擎
        </h2>
        <p className="mx-auto mb-16 max-w-lg text-center text-smr-text-secondary">
          从链上数据捕获到风险防护，全链路自动化处理
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
                            <span className="font-data text-xs text-smr-text-secondary">Helius Webhook 连接中</span>
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
                              <span className="font-data text-[10px] text-[var(--smr-accent-gold)]">AI 分析输出</span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-smr-text-secondary">
                              高流动性 meme 代币，该钱包近期胜率 78%，连续盈利 5 笔，或为短线波段布局。建议关注后续加仓动作。
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="gold">置信度 85%</Badge>
                            <Badge variant="green">低风险</Badge>
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
                              {w.score >= 0.8 && <Badge variant="green">纳入监控</Badge>}
                            </div>
                          ))}
                        </div>
                      )}
                      {i === 3 && (
                        <>
                          <div className="mb-3 flex items-center gap-2 rounded-md bg-[var(--smr-accent-red)]/10 px-3 py-2">
                            <ShieldAlert size={14} className="text-[var(--smr-accent-red)]" />
                            <span className="text-[11px] text-[var(--smr-accent-red)]">Freeze Authority 检测到</span>
                          </div>
                          <div className="space-y-1.5">
                            {[
                              { label: 'Mint Authority', status: '已放弃', safe: true },
                              { label: 'Freeze Authority', status: '存在', safe: false },
                              { label: '流动性锁定', status: '未锁定', safe: false },
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
            <Badge variant="gold" size="md">HOW IT WORKS</Badge>
          </div>
          <h2 className="mb-4 text-center text-3xl font-bold text-smr-text md:text-4xl">
            从链上事件到你的手机
          </h2>
          <p className="mx-auto mb-16 max-w-md text-center text-smr-text-secondary">
            全自动四步管道，端到端延迟 &lt; 5 秒
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
          <Badge variant="green" size="md">SECURITY</Badge>
        </div>
        <h2 className="mb-12 text-center text-3xl font-bold text-smr-text">
          安全是底线，不是卖点
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {securityFeatures.map((item, i) => (
            <AnimateOnScroll key={item.title} animation="fade-up" delay={i * 100}>
            <GlassCard className="flex items-start gap-4 p-5" hover>
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
              开始你的信息优势
            </h2>
            <p className="mb-8 text-smr-text-secondary">
              Pro 计划 $100/月 · 全部功能 · 随时取消
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/pricing"
                className="group cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[var(--smr-accent-cyan)] px-8 py-3.5 text-base font-semibold text-[var(--smr-bg-primary)] transition hover:bg-[var(--smr-accent-cyan)]/80"
                style={{ boxShadow: 'var(--smr-glow-cyan-strong)', transition: 'all var(--smr-transition-normal)' }}
              >
                查看定价
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="mt-6 flex items-center justify-center gap-6 text-xs text-smr-text-muted">
              <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[var(--smr-accent-green)]" /> 无需信用卡试用</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[var(--smr-accent-green)]" /> Stripe 安全支付</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[var(--smr-accent-green)]" /> 随时取消</span>
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
          <div className="font-data text-xs text-smr-text-muted">
            © 2026 Smart Money Radar · Built on Solana
          </div>
        </div>
      </footer>
    </div>
  );
}

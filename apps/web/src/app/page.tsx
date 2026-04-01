import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';

// 特性卡片数据
const features = [
  {
    icon: '⚡',
    title: '实时告警',
    description:
      'Helius webhook 监听链上交易，Telegram 即时推送，延迟 < 5 秒',
  },
  {
    icon: '🧠',
    title: 'AI 归因分析',
    description: 'Claude AI 自动生成 50 字买入理由，快速理解聪明钱意图',
  },
  {
    icon: '🛡️',
    title: '防 Rug 保护',
    description: '自动检测 Mint/Freeze Authority，过滤高风险代币',
  },
  {
    icon: '📡',
    title: '智能发现',
    description: 'Birdeye 评分引擎自动发现新聪明钱包，持续扩大监控范围',
  },
];

// 数据亮点
const stats = [
  { value: '< 5s', label: '告警延迟' },
  { value: '50+', label: '追踪钱包' },
  { value: '24/7', label: '全天候监控' },
  { value: '99.9%', label: '消息可靠性' },
];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-16">
      {/* Hero 区域 */}
      <section className="flex max-w-3xl flex-col items-center text-center">
        <div className="mb-6 inline-block rounded-full border border-zinc-800 bg-[#111111] px-4 py-1.5 text-sm text-zinc-400">
          Solana 链上聪明钱追踪器
        </div>
        <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight text-white md:text-6xl">
          聪明钱动向
          <br />
          <span className="text-[#00F0FF]">尽在掌握</span>
        </h1>
        <p className="mb-10 max-w-lg text-lg leading-relaxed text-zinc-400">
          追踪 Solana 链上顶级交易者，比散户快 10
          分钟收到买入信号。AI 分析 + Rug 防护，让你不再做最后接盘侠。
        </p>
        <div className="flex gap-4">
          <SignedOut>
            <Link
              href="/sign-up"
              className="rounded-md bg-[#00F0FF] px-8 py-3 font-medium text-black transition hover:bg-[#00F0FF]/80"
            >
              免费注册
            </Link>
            <Link
              href="/sign-in"
              className="rounded-md border border-zinc-700 bg-[#111111] px-8 py-3 text-zinc-300 transition hover:border-zinc-600 hover:text-white"
            >
              登录
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="rounded-md bg-[#00F0FF] px-8 py-3 font-medium text-black transition hover:bg-[#00F0FF]/80"
            >
              进入控制台
            </Link>
          </SignedIn>
        </div>
      </section>

      {/* 数据亮点 */}
      <section className="mt-24 grid w-full max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center rounded-lg border border-zinc-800 bg-[#111111] p-6"
          >
            <span className="text-2xl font-bold text-[#00F0FF]">
              {stat.value}
            </span>
            <span className="mt-1 text-sm text-zinc-500">{stat.label}</span>
          </div>
        ))}
      </section>

      {/* 特性展示 */}
      <section className="mt-24 w-full max-w-4xl">
        <h2 className="mb-12 text-center text-3xl font-bold text-white">
          核心能力
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-zinc-800 bg-[#111111] p-6 transition hover:border-zinc-700"
            >
              <div className="mb-3 text-3xl">{feature.icon}</div>
              <h3 className="mb-2 text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="mt-24 flex flex-col items-center text-center">
        <h2 className="mb-4 text-2xl font-bold text-white">
          准备好追踪聪明钱了吗？
        </h2>
        <p className="mb-8 text-zinc-400">
          Pro 计划 $100/月，解锁全部功能
        </p>
        <Link
          href="/pricing"
          className="rounded-md bg-[#00F0FF] px-8 py-3 font-medium text-black transition hover:bg-[#00F0FF]/80"
        >
          查看定价
        </Link>
      </section>
    </main>
  );
}

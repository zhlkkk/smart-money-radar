import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { GridBackground } from '@/components/ui/grid-background';

export const metadata = {
  title: '隐私政策 - Smart Money Radar',
};

export default function PrivacyPage() {
  return (
    <main className="relative min-h-screen px-4 py-16">
      <GridBackground />
      <div className="relative mx-auto max-w-3xl">
        <Link href="/" className="mb-8 inline-flex cursor-pointer items-center gap-1 text-sm text-smr-text-muted transition hover:text-smr-text">
          <ArrowLeft size={14} /> 返回首页
        </Link>

        <h1 className="mb-8 text-3xl font-bold text-smr-text">隐私政策</h1>
        <p className="mb-4 text-sm text-smr-text-muted">最后更新：2026 年 4 月 2 日</p>

        <div className="space-y-6 text-sm leading-relaxed text-smr-text-secondary">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-smr-text">1. 我们收集的信息</h2>
            <ul className="ml-4 list-disc space-y-1">
              <li><strong>账户信息：</strong>注册时提供的邮箱地址，通过 Clerk 认证服务管理。</li>
              <li><strong>付款信息：</strong>由第三方支付处理商处理，我们不直接存储信用卡信息。</li>
              <li><strong>使用数据：</strong>页面访问记录、功能使用频率等匿名统计数据。</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-smr-text">2. 我们不收集的信息</h2>
            <ul className="ml-4 list-disc space-y-1">
              <li>钱包私钥或助记词 — 绝不要求、绝不存储。</li>
              <li>用户的链上资产余额或交易历史。</li>
              <li>本服务仅监控公开的链上交易数据。</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-smr-text">3. 信息使用方式</h2>
            <ul className="ml-4 list-disc space-y-1">
              <li>提供和维护本服务。</li>
              <li>处理订阅付款和管理账户。</li>
              <li>发送服务相关通知（如告警推送、账单提醒）。</li>
              <li>改善服务质量和用户体验。</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-smr-text">4. 数据安全</h2>
            <ul className="ml-4 list-disc space-y-1">
              <li>所有数据传输使用 TLS 加密。</li>
              <li>数据库采用加密存储。</li>
              <li>认证服务由 Clerk 提供，符合 SOC 2 标准。</li>
              <li>支付处理由 PCI DSS 合规的第三方服务商完成。</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-smr-text">5. 第三方服务</h2>
            <p>本服务使用以下第三方服务提供商：</p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li><strong>Clerk：</strong>用户认证和账户管理。</li>
              <li><strong>Paddle/Stripe：</strong>支付处理。</li>
              <li><strong>Vercel：</strong>Web 应用托管。</li>
              <li><strong>Railway：</strong>后端服务托管。</li>
              <li><strong>Neon：</strong>数据库托管。</li>
              <li><strong>Sentry：</strong>错误监控（不含个人信息）。</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-smr-text">6. 用户权利</h2>
            <ul className="ml-4 list-disc space-y-1">
              <li>您可以随时访问和更新您的账户信息。</li>
              <li>您可以请求删除您的账户和相关数据。</li>
              <li>您可以选择退出非必要的通知。</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-smr-text">7. 联系方式</h2>
            <p>如有隐私相关问题，请通过 Telegram 联系我们。</p>
          </section>
        </div>
      </div>
    </main>
  );
}

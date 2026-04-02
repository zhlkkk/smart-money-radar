import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { GridBackground } from '@/components/ui/grid-background';
import { getTranslations } from 'next-intl/server';
import { getLocale } from 'next-intl/server';

export const metadata = {
  title: '隐私政策 - Smart Money Radar',
};

export default async function PrivacyPage() {
  const t = await getTranslations();
  const locale = await getLocale();

  return (
    <main className="relative min-h-screen px-4 py-16">
      <GridBackground />
      <div className="relative mx-auto max-w-3xl">
        <Link href="/" className="mb-8 inline-flex cursor-pointer items-center gap-1 text-sm text-smr-text-muted transition hover:text-smr-text">
          <ArrowLeft size={14} /> {t('common.backToHome')}
        </Link>

        <h1 className="mb-8 text-3xl font-bold text-smr-text">{t('privacy.title')}</h1>
        <p className="mb-4 text-sm text-smr-text-muted">{t('privacy.lastUpdated')}</p>

        <div className="space-y-6 text-sm leading-relaxed text-smr-text-secondary">
          {locale === 'en' ? (
            <>
              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">1. Information We Collect</h2>
                <ul className="ml-4 list-disc space-y-1">
                  <li><strong>Account information:</strong> Email address provided at registration, managed through the Clerk authentication service.</li>
                  <li><strong>Payment information:</strong> Processed by third-party payment processors; we do not directly store credit card information.</li>
                  <li><strong>Usage data:</strong> Anonymous statistics such as page visit records and feature usage frequency.</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">2. Information We Do Not Collect</h2>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Wallet private keys or seed phrases — never requested, never stored.</li>
                  <li>Users&apos; on-chain asset balances or transaction history.</li>
                  <li>The Service only monitors publicly available on-chain transaction data.</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">3. How We Use Information</h2>
                <ul className="ml-4 list-disc space-y-1">
                  <li>To provide and maintain the Service.</li>
                  <li>To process subscription payments and manage accounts.</li>
                  <li>To send service-related notifications (e.g., alert pushes, billing reminders).</li>
                  <li>To improve service quality and user experience.</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">4. Data Security</h2>
                <ul className="ml-4 list-disc space-y-1">
                  <li>All data is transmitted using TLS encryption.</li>
                  <li>Databases use encrypted storage.</li>
                  <li>Authentication services are provided by Clerk, compliant with SOC 2 standards.</li>
                  <li>Payment processing is handled by PCI DSS-compliant third-party service providers.</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">5. Third-Party Services</h2>
                <p>The Service uses the following third-party service providers:</p>
                <ul className="ml-4 mt-2 list-disc space-y-1">
                  <li><strong>Clerk:</strong> User authentication and account management.</li>
                  <li><strong>Paddle/Stripe:</strong> Payment processing.</li>
                  <li><strong>Vercel:</strong> Web application hosting.</li>
                  <li><strong>Railway:</strong> Backend service hosting.</li>
                  <li><strong>Neon:</strong> Database hosting.</li>
                  <li><strong>Sentry:</strong> Error monitoring (no personal information included).</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">6. User Rights</h2>
                <ul className="ml-4 list-disc space-y-1">
                  <li>You may access and update your account information at any time.</li>
                  <li>You may request deletion of your account and associated data.</li>
                  <li>You may opt out of non-essential notifications.</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">7. Contact</h2>
                <p>For privacy-related questions, please contact us via Telegram.</p>
              </section>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </main>
  );
}

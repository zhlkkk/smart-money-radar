import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { GridBackground } from '@/components/ui/grid-background';
import { getTranslations } from 'next-intl/server';
import { getLocale } from 'next-intl/server';

export const metadata = {
  title: '退款政策 - Smart Money Radar',
};

export default async function RefundPage() {
  const t = await getTranslations();
  const locale = await getLocale();

  return (
    <main className="relative min-h-screen px-4 py-16">
      <GridBackground />
      <div className="relative mx-auto max-w-3xl">
        <Link href="/" className="mb-8 inline-flex cursor-pointer items-center gap-1 text-sm text-smr-text-muted transition hover:text-smr-text">
          <ArrowLeft size={14} /> {t('common.backToHome')}
        </Link>

        <h1 className="mb-8 text-3xl font-bold text-smr-text">{t('refund.title')}</h1>
        <p className="mb-4 text-sm text-smr-text-muted">{t('refund.lastUpdated')}</p>

        <div className="space-y-6 text-sm leading-relaxed text-smr-text-secondary">
          {locale === 'en' ? (
            <>
              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">Refund Conditions</h2>
                <p>We want every user to be satisfied with Smart Money Radar. The following is our refund policy:</p>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">7-Day No-Questions-Asked Refund</h2>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Within 7 days of your initial subscription, if you are unsatisfied with the service, you may request a full refund.</li>
                  <li>Refunds will be returned via the original payment method; processing time is 5–10 business days.</li>
                  <li>Each user may use the 7-day no-questions-asked refund only once.</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">Cancellation</h2>
                <ul className="ml-4 list-disc space-y-1">
                  <li>You may cancel your subscription at any time without providing a reason.</li>
                  <li>After cancellation, your service will continue until the end of the current billing cycle.</li>
                  <li>No further charges will be made after the billing cycle ends.</li>
                  <li>Past billing cycles are non-refundable (except during the 7-day refund window).</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">Service Outage Refunds</h2>
                <p>If the service is continuously unavailable for more than 48 hours due to our fault, you are entitled to request a pro-rated refund.</p>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">How to Request a Refund</h2>
                <p>Please contact us using one of the following methods to request a refund:</p>
                <ul className="ml-4 mt-2 list-disc space-y-1">
                  <li>Contact the support team via Telegram.</li>
                  <li>Provide your registered email address and subscription information.</li>
                  <li>We will process your refund request within 2 business days.</li>
                </ul>
              </section>
            </>
          ) : (
            <>
              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">退款条件</h2>
                <p>我们希望每位用户都对 Smart Money Radar 的服务满意。以下是我们的退款政策：</p>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">7 天无理由退款</h2>
                <ul className="ml-4 list-disc space-y-1">
                  <li>首次订阅后 7 天内，如果您对服务不满意，可以申请全额退款。</li>
                  <li>退款将通过原支付方式退回，处理时间为 5-10 个工作日。</li>
                  <li>每位用户仅限使用一次 7 天无理由退款。</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">取消订阅</h2>
                <ul className="ml-4 list-disc space-y-1">
                  <li>您可以随时取消订阅，无需说明理由。</li>
                  <li>取消后，您的服务将持续到当前计费周期结束。</li>
                  <li>计费周期结束后不再收取费用。</li>
                  <li>已过的计费周期不予退款（7 天无理由退款期除外）。</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">服务中断退款</h2>
                <p>如果因我们的原因导致服务持续中断超过 48 小时，您有权申请按比例退款。</p>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-smr-text">如何申请退款</h2>
                <p>请通过以下方式联系我们申请退款：</p>
                <ul className="ml-4 mt-2 list-disc space-y-1">
                  <li>通过 Telegram 联系支持团队。</li>
                  <li>提供您的注册邮箱和订阅信息。</li>
                  <li>我们将在 2 个工作日内处理您的退款请求。</li>
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

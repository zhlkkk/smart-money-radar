import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { GridBackground } from '@/components/ui/grid-background';

export const metadata = {
  title: '退款政策 - Smart Money Radar',
};

export default function RefundPage() {
  return (
    <main className="relative min-h-screen px-4 py-16">
      <GridBackground />
      <div className="relative mx-auto max-w-3xl">
        <Link href="/" className="mb-8 inline-flex cursor-pointer items-center gap-1 text-sm text-smr-text-muted transition hover:text-smr-text">
          <ArrowLeft size={14} /> 返回首页
        </Link>

        <h1 className="mb-8 text-3xl font-bold text-smr-text">退款政策</h1>
        <p className="mb-4 text-sm text-smr-text-muted">最后更新：2026 年 4 月 2 日</p>

        <div className="space-y-6 text-sm leading-relaxed text-smr-text-secondary">
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
        </div>
      </div>
    </main>
  );
}

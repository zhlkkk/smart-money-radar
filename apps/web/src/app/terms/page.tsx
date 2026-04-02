import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { GridBackground } from '@/components/ui/grid-background';

export const metadata = {
  title: '服务条款 - Smart Money Radar',
};

export default function TermsPage() {
  return (
    <main className="relative min-h-screen px-4 py-16">
      <GridBackground />
      <div className="relative mx-auto max-w-3xl">
        <Link href="/" className="mb-8 inline-flex cursor-pointer items-center gap-1 text-sm text-smr-text-muted transition hover:text-smr-text">
          <ArrowLeft size={14} /> 返回首页
        </Link>

        <h1 className="mb-8 text-3xl font-bold text-smr-text">服务条款</h1>
        <p className="mb-4 text-sm text-smr-text-muted">最后更新：2026 年 4 月 2 日</p>

        <div className="space-y-6 text-sm leading-relaxed text-smr-text-secondary">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-smr-text">1. 服务概述</h2>
            <p>Smart Money Radar（以下简称"本服务"）是一个 Solana 链上聪明钱追踪工具，提供实时交易告警、AI 分析和钱包评分功能。本服务通过 Telegram 推送和 Web Dashboard 向订阅用户提供信息。</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-smr-text">2. 使用条件</h2>
            <p>使用本服务，即表示您同意以下条款：</p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>您必须年满 18 岁。</li>
              <li>您需提供准确的注册信息。</li>
              <li>您不得将本服务用于任何违反当地法律法规的活动。</li>
              <li>您理解本服务提供的信息仅供参考，不构成投资建议。</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-smr-text">3. 订阅与付款</h2>
            <ul className="ml-4 list-disc space-y-1">
              <li>本服务采用月度订阅制，费用为 $100/月。</li>
              <li>订阅在每个计费周期开始时自动续费。</li>
              <li>您可以随时取消订阅，取消后将在当前计费周期结束时生效。</li>
              <li>付款通过第三方支付处理商安全处理。</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-smr-text">4. 免责声明</h2>
            <p>本服务提供的所有信息（包括但不限于交易告警、AI 分析、钱包评分）仅供参考，不构成任何形式的投资建议、财务建议或交易推荐。</p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>加密货币市场具有高度波动性和不确定性。</li>
              <li>过往表现不代表未来收益。</li>
              <li>用户应自行评估风险并对自己的投资决策负责。</li>
              <li>本服务不对因使用本平台信息而导致的任何损失承担责任。</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-smr-text">5. 数据与安全</h2>
            <ul className="ml-4 list-disc space-y-1">
              <li>本服务仅监控链上公开交易数据，不接触用户资产。</li>
              <li>不要求、不存储用户的私钥或助记词。</li>
              <li>用户账号数据通过加密传输和存储。</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-smr-text">6. 服务变更与终止</h2>
            <p>我们保留随时修改、暂停或终止本服务的权利。重大变更将提前通知用户。如因服务终止需退款，将按照退款政策处理。</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-smr-text">7. 联系方式</h2>
            <p>如有任何问题，请通过 Telegram 联系我们的支持团队。</p>
          </section>
        </div>
      </div>
    </main>
  );
}

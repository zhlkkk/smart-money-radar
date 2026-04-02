---
title: "Payment Provider Migration: Stripe → Helio Pay for China-Based Developers"
date: 2026-04-02
category: best-practices
module: payments
problem_type: best_practice
component: payment_integration
severity: high
applies_when:
  - "China mainland developer selecting a payment processor for SaaS"
  - "Building crypto-native SaaS with subscription billing"
  - "Need to support multiple payment providers with clean abstraction"
  - "Integrating webhook handlers from multiple payment processors in Fastify"
tags:
  - payment-migration
  - stripe-alternatives
  - helio-pay
  - paddle
  - china-developer
  - crypto-payments
  - solana
  - webhook-isolation
  - fastify-plugin
---

# Payment Provider Migration: Stripe → Helio Pay for China-Based Developers

## Context

Smart Money Radar（Solana 聪明钱追踪器）在 Phase 2 需要上线订阅支付功能。作为中国大陆开发者，在选择支付处理商时遇到了连续的地域限制问题：

| 提供商 | 结果 | 原因 |
|--------|------|------|
| **Stripe** | ❌ 失败 | 不支持中国大陆商户注册 |
| **LemonSqueezy** | ❌ 失败 | 底层用 Stripe 做支付处理，继承相同限制 |
| **Paddle** | ⏳ 待定 | Merchant of Record 模式，提交审核中，前端标记"即将开放" |
| **Helio Pay** | ✅ 成功 | Solana 原生加密支付，无地域限制，目标用户是 crypto 交易者（产品-市场匹配） |

核心教训：**不要假设"全球化"支付处理商真的全球化** —— 在注册前先验证你的国家/地区是否在支持列表中。

## Guidance

### 1. 后端稳定 API 契约：隔离支付提供商细节

无论使用哪个提供商，后端 checkout 端点保持相同的接口契约：

```typescript
// POST /api/v1/checkout
// 入参：{ clerkUserId: string, email: string }
// 返回：{ url: string }  ← 结账页面 URL

// Paddle 实现
const transaction = await paddle.transactions.create({
  items: [{ priceId: config.priceId, quantity: 1 }],
  customData: { clerkUserId: body.clerkUserId },
});
return { url: transaction.checkoutUrl };

// Helio 实现
// Helio 使用前端 widget 直接发起支付，不需要后端创建 checkout
// 但 webhook 回调仍走后端
```

**好处：** 前端 Server Action 调用 `POST /api/v1/checkout` 得到 URL，不关心底层是 Paddle 还是其他。切换提供商时前端零修改。

### 2. Webhook 路由隔离：Fastify 插件封装

每个支付提供商的 webhook 需要 raw body 来验证签名，但 Fastify 全局 JSON parser 会解析 body。**必须用独立插件隔离 raw body parser**：

```typescript
// ❌ 错误：全局覆盖 JSON parser，影响所有路由
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, ...);

// ✅ 正确：用 Fastify 插件隔离
export function registerHelioWebhookRoutes(app: FastifyInstance, config: HelioWebhookConfig) {
  app.register(async function helioWebhookPlugin(instance) {
    // raw body parser 只在此插件内生效
    instance.addContentTypeParser('application/json', { parseAs: 'buffer' },
      (_req, body, done) => { done(null, body); }
    );

    instance.post('/webhooks/helio', async (request, reply) => {
      const rawBody = request.body as Buffer;
      // HMAC-SHA256 签名验证...
    });
  });
}
```

**关键：** 如果不用插件隔离，raw body parser 会污染全局，导致 `POST /api/v1/checkout` 和其他 API 路由收到 Buffer 而非 parsed JSON。

### 3. 环境变量可选验证：Phase 1 不破坏

支付相关的环境变量用 optional 验证，Phase 1 部署不受影响：

```typescript
// env.ts — 支付变量全部 optional
PADDLE_API_KEY: z.string().min(1).optional().or(z.literal('')).transform((v) => v || undefined),
HELIO_WEBHOOK_SHARED_TOKEN: z.string().min(1).optional().or(z.literal('')).transform((v) => v || undefined),

// index.ts — 有变量才注册路由
if (env.PADDLE_API_KEY && env.PADDLE_WEBHOOK_SECRET && db) {
  registerCheckoutRoutes(app, { paddle, priceId, appUrl });
  registerPaddleWebhookRoutes(app, { paddle, webhookSecret, db });
}
if (env.HELIO_WEBHOOK_SHARED_TOKEN && db) {
  registerHelioWebhookRoutes(app, { sharedToken, db });
}
```

### 4. Helio Pay 订阅模型的关键差异

Helio 是**非托管（non-custodial）**模式 —— 不能像信用卡那样静默扣款，用户必须手动批准每次续费：

```
首次支付 → subscription ACTIVE
  ↓ 30 天后
Helio 发送续费提醒邮件（含 nextChargeUrl）
  ↓ 用户点击并在钱包中批准
subscription 续期 → ACTIVE
  ↓ 如果用户未在宽限期内批准
subscription → ENDED
```

**Webhook 事件映射：**
- `SUBSCRIPTION_STARTED` → DB status = `active`
- `SUBSCRIPTION_PENDING_PAYMENT` → DB status = `past_due`（宽限期）
- `SUBSCRIPTION_ENDED` → DB status = `canceled`

### 5. 前端禁用入口模式

Paddle 审核中时，按钮保留但 disabled + badge 提示：

```tsx
{/* 加密支付 — 主要 */}
<HelioCheckoutButton />

{/* 法币支付 — 待开放 */}
<button disabled className="opacity-50 cursor-not-allowed">
  信用卡 / PayPal（审核中）
</button>
<Badge variant="muted"><Clock size={10} /> 即将开放</Badge>
```

## Why This Matters

1. **中国大陆开发者的常见坑：** Stripe → LemonSqueezy → 发现都不行，浪费了大量时间。提前知道限制可以避免无效尝试。

2. **产品-用户匹配：** 对于 crypto 工具的用户，USDC/SOL 支付比信用卡更自然。Helio 不是 Plan B，它是 Plan A。

3. **架构韧性：** Webhook 插件隔离 + 可选环境变量 = 新增/移除支付提供商不影响现有功能，CI/CD 不因缺少 API key 而失败。

4. **非托管续费：** 这是 crypto 支付的本质限制（用户必须签名授权每笔交易），产品设计、用户引导、续费提醒都需要适配这个模型。

## When to Apply

- 中国大陆/受限地区开发者选择 SaaS 支付处理商时
- 目标用户是加密货币交易者的产品
- 需要同时支持法币和加密货币两种支付方式
- 在 Fastify 中集成多个 webhook 提供商时（需要 raw body 隔离）
- Phase 1 MVP 不含支付，但需要为 Phase 2 预留扩展空间

## Examples

**提供商选型决策矩阵：**

| 维度 | Stripe | LemonSqueezy | Paddle | Helio Pay |
|------|--------|-------------|--------|-----------|
| 中国商户 | ❌ | ❌ | ⏳ 待审核 | ✅ |
| 费率 | 2.9% + $0.30 | 5% | 5% | 2% |
| 订阅模式 | 托管（自动扣款） | 托管 | 托管 | 非托管（用户审批） |
| 支付方式 | 信用卡/ACH | 信用卡/PayPal | 信用卡/PayPal | USDC/SOL/SPL tokens |
| 接入速度 | 分钟（如果支持） | 分钟 | 3-5 天审核 | 即时 |
| 适合场景 | 全球 SaaS | 独立开发者 | 全球 SaaS | Crypto 原生产品 |

**文件变更清单（从 Stripe 迁移到 Paddle + Helio 双轨）：**

```
修改：
  apps/backend/src/env.ts                    — 环境变量从 STRIPE_* 改为 PADDLE_* + HELIO_*
  apps/backend/src/index.ts                  — 路由注册条件判断
  apps/backend/src/stripe/checkout.ts        — Paddle SDK 创建 transaction
  apps/backend/src/stripe/webhook.ts         — Paddle webhooks.unmarshal() 签名验证
  apps/web/src/app/pricing/page.tsx          — 双支付入口 UI

新增：
  apps/backend/src/helio/webhook.ts          — Helio HMAC-SHA256 + Bearer 双重验证
  apps/web/src/components/helio-checkout.tsx  — @heliofi/checkout-react 动态加载
  apps/web/src/app/terms/page.tsx            — 服务条款（支付处理商要求）
  apps/web/src/app/privacy/page.tsx          — 隐私政策
  apps/web/src/app/refund/page.tsx           — 退款政策

删除：
  apps/web/src/components/pricing-card.tsx    — 旧 Stripe PricingCard
  apps/web/src/app/pricing/actions.ts        — 旧 Stripe Server Action
```

## Related

- [Fire-and-Forget Webhook Graceful Degradation](fire-and-forget-webhook-graceful-degradation-2026-03-31.md) — Webhook 处理的优雅降级原则（同样适用于支付 webhook）
- [Unwired Modules First Deployment Pattern](unwired-modules-first-deployment-pattern-2026-04-01.md) — 模块注册检查清单（新 webhook handler 需显式注册）
- [Drizzle Dual Client Soft Delete Schema](drizzle-dual-client-soft-delete-schema-2026-04-01.md) — 订阅表结构设计
- [Phase 2 Web Dashboard Plan](../../plans/2026-03-31-002-feat-phase2-web-dashboard-plan.md) — 原始 Stripe 集成计划（已被替代）

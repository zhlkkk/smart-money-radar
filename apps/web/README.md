# Smart Money Radar Web

这是 Smart Money Radar 的 Next.js 16 App Router 前端，负责公开 Landing、Pricing、Checkout 入口、Clerk 鉴权、订阅态 Dashboard、Telegram 绑定 UI 和管理员回测控制台。

## 路由

| 路由 | 用途 |
| --- | --- |
| `/` | 中英文 Landing page，包含方法论和产品能力展示 |
| `/pricing` | 订阅方案和 checkout CTA |
| `/checkout` | Paddle checkout handoff |
| `/dashboard` | 付费总览页，展示最近告警、钱包数量和 Telegram 绑定 |
| `/dashboard/alerts` | 告警历史和实时流 |
| `/dashboard/wallets` | 监控钱包列表 |
| `/dashboard/wallets/[address]` | 钱包详情和最近告警 |
| `/admin/backtest` | 管理员回测控制台 |
| `/api/alerts` | 转发到后端告警 API |
| `/api/alerts/stream` | 转发到后端 SSE 告警流 |
| `/api/checkout` | 转发到后端 Paddle checkout |
| `/api/admin/backtest*` | 转发到后端管理员回测 API |
| `/api/telegram/*` | 转发 Telegram 绑定相关请求 |
| `/api/webhooks/clerk` | Clerk 用户同步 webhook |

## 本地开发

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm --filter web dev -- --port 3001
```

后端需要单独运行，默认是 `http://localhost:3000`。

## 必要环境变量

完整清单见 [../../docs/plans/production-env-checklist.md](/Users/longkai/workspace/smart-money-radar/docs/plans/production-env-checklist.md)。

本地最小配置：

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
BACKEND_API_URL=http://localhost:3000
BACKEND_API_KEY=dev-shared-secret
DATABASE_URL=postgresql://...
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

可选 UI 和支付配置：

```bash
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox
NEXT_PUBLIC_HELIO_PAYLINK_ID=
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=SmartMoneyRadarBot
```

## 鉴权模型

- `src/proxy.ts` 通过 Clerk 保护所有非公开路由。
- Dashboard 访问要求 `user.publicMetadata.subscriptionStatus === "active"`。
- Admin 访问要求 `user.publicMetadata.role === "admin"`。
- Clerk webhook 将用户写入 PostgreSQL，并在 `user.deleted` 时软删除。

## 后端访问

Server Components 和 Route Handlers 通过 `BACKEND_API_URL` 与 `BACKEND_API_KEY` 调用 Fastify 后端。共享密钥必须与后端 `BACKEND_API_KEY` 一致。

## 常用命令

```bash
pnpm --filter web dev
pnpm --filter web lint
pnpm --filter web build
```

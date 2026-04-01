# Vercel 部署清单

## 环境变量

### Clerk
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk Dashboard → API Keys
- `CLERK_SECRET_KEY` — Clerk Dashboard → API Keys
- `CLERK_WEBHOOK_SECRET` — Clerk Dashboard → Webhooks → Signing Secret

### Stripe
- `STRIPE_SECRET_KEY` — Stripe Dashboard → API Keys
- `STRIPE_WEBHOOK_SECRET` — (后端使用，前端不需要)

### Database
- `DATABASE_URL` — Neon 数据库连接字符串（HTTP 模式，适合 serverless）

### Backend API
- `BACKEND_API_URL` — Railway 生产地址 (如 `https://xxx.railway.app`)
- `BACKEND_API_KEY` — 与后端 `BACKEND_API_KEY` 环境变量一致

### App
- `NEXT_PUBLIC_APP_URL` — Vercel 生产域名 (如 `https://xxx.vercel.app`)

## Webhook 配置

### Clerk Webhook
- **URL**: `https://<vercel-domain>/api/webhooks/clerk`
- **Events**: `user.created`, `user.deleted`
- **签名验证**: Svix（自动，已在 route handler 中实现）

### Stripe Webhook
- **URL**: `https://<railway-domain>/webhooks/stripe`（发送到后端 Fastify 服务）
- **Events**: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`

## 部署步骤

1. Vercel 导入 GitHub repo，设置 **Root Directory** 为 `apps/web`
2. Framework Preset 选择 **Next.js**
3. 在 Vercel Dashboard → Settings → Environment Variables 注入所有环境变量
4. 触发部署
5. 在 Clerk Dashboard → Webhooks 配置 endpoint 指向 `https://<vercel-domain>/api/webhooks/clerk`
6. 端到端测试：
   - 注册新用户 → 检查 DB users 表是否有新记录
   - 删除用户 → 检查 `deleted_at` 字段是否已设置
   - 访问 `/dashboard` 未登录 → 应跳转到登录页
   - 访问 `/api/webhooks/clerk` 不带签名 → 应返回 400

## 注意事项

- Monorepo 结构下 Vercel 需要 Root Directory 设为 `apps/web`，`vercel.json` 已放置在该目录
- 前端使用 `@radar/db` 的 HTTP 客户端（`createHttpClient`），无需连接池
- Clerk middleware 已保护所有非公开路由，无需额外鉴权配置

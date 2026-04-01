---
title: "Phase 2b 详细开发计划：REST API + Web Dashboard + 部署"
type: plan
status: active
date: 2026-04-01
---

# Phase 2b 详细开发计划

## 🎯 阶段目标 (Phase 2b)
在 Phase 2a (基础设施 + 支付闭环) 验证通过的基础上，为付费用户提供完整的只读 Web Dashboard，实现告警历史查询、被监控钱包列表展示，并完成前端的生产环境部署。

## 📋 依赖关系与前置条件
- **前置条件**：Phase 2a (Unit 1, 2, 3, 4, 6, 7, 10a) 已全部完成并部署。
- **启动 Gate**：支付自动化上线后前 10 个用户在 2 周内要求 Dashboard 功能（假设已满足）。

---

## 🛠️ Unit 5: Fastify REST API 层

**目标**：为前端提供数据接口（告警分页列表、钱包列表及详情）。
**依赖**：Unit 2 (DB), Unit 4 (DB 写入)

### 详细执行步骤 (1-2 天)
1. **API 路由与鉴权脚手架**
   - 创建 `apps/backend/src/api/auth.ts`，实现基于 `X-API-Key` header 的鉴权插件。
   - 验证环境变量 `BACKEND_API_KEY`。
   - 引入 `@fastify/rate-limit`，配置 60 req/min/IP。
2. **GET /api/v1/alerts (告警列表)**
   - 创建 `apps/backend/src/api/alerts.ts`。
   - 实现基于游标 (`cursor`) 的分页查询，按 `createdAt DESC` 排序。
   - 限制单次最大返回数 (`limit` max 100)。
   - 返回格式严格对齐 `@radar/shared` 的 `PaginatedResponse<AlertData>`。
3. **GET /api/v1/wallets (钱包列表)**
   - 创建 `apps/backend/src/api/wallets.ts`。
   - 查询 `tracked_wallets` 表中 `isActive = true` 的记录。
   - 包含评分、来源、胜率等关键字段。
4. **GET /api/v1/wallets/:address (钱包详情)**
   - 查询单个钱包的详细信息。
   - 聚合查询该钱包最近的 N 条告警历史。
5. **增强 Health Check**
   - 修改 `apps/backend/src/api/health.ts`，加入 DB 连接状态检查。
6. **测试与验证 (TDD)**
   - 编写 `auth.test.ts` 验证 401 拦截。
   - 编写 `alerts.test.ts` 验证游标分页逻辑。
   - 编写 `wallets.test.ts` 验证路由和数据组装。
   - 确保 `pnpm test` 零回归。

---

## 🛠️ Unit 8: Dashboard 页面 (告警与钱包)

**目标**：实现核心 Dashboard 页面（告警历史、钱包列表、钱包详情），遵循暗色终端风格。
**依赖**：Unit 5 (REST API), Unit 6 (Next.js + Clerk), Unit 7 (Stripe)

### 详细执行步骤 (2-3 天)
1. **基础设施与组件准备**
   - 运行 `/frontend-design` 确认并固化 Tailwind 暗色终端主题配置（背景 `#0A0A0A`，JetBrains Mono 字体，荧光强调色）。
   - 创建 `SubscriptionGuard` 组件，拦截未订阅用户，显示 blur 遮罩和付费引导。
   - 封装 `BackendClient` (`apps/web/src/lib/backend-client.ts`)，处理 API Key 注入和 Next.js 缓存 (`revalidate: 30`)。
2. **告警历史页 (`/dashboard/alerts`)**
   - 实现 `AlertCard` 组件，展示单条告警（时间、代币、流动性、AI 摘要等）。
   - 实现游标分页组件 `Pagination`。
   - 页面集成 `BackendClient.getAlerts()`，渲染告警 Feed。
3. **钱包列表页 (`/dashboard/wallets`)**
   - 实现 `WalletCard` 组件，展示地址、标签、评分、活跃状态。
   - 页面集成 `BackendClient.getWallets()`，网格化渲染。
4. **钱包详情页 (`/dashboard/wallets/[address]`)**
   - 顶部展示钱包详细指标（胜率、PNL、交易次数）。
   - 底部复用 `AlertCard` 展示该钱包关联的最近告警。
5. **测试与验证**
   - 验证无权限用户的 Paywall 拦截。
   - 验证暗色终端 UI 规范。
   - 验证 SSR 和 ISR 缓存行为（付款后 `?checkout=success` 强制刷新）。

---

## 🛠️ Unit 9: Pricing 页面 + Landing Page

**目标**：实现公开的极简 Landing Page 和 Pricing 页面，打通获客到支付的转化漏斗。
**依赖**：Unit 7 (Stripe)

### 详细执行步骤 (1 天)
1. **Landing Page (`/`)**
   - 极简设计：一句话价值主张 + 核心数据展示 + CTA 按钮。
   - CTA 逻辑：未登录跳转 `/sign-up`，已登录跳转 `/pricing` 或直接 Checkout。
2. **Pricing 页面 (`/pricing`)**
   - 从 `@radar/shared/constants/plans.ts` 读取套餐常量（$100/月）。
   - 实现 `PricingCard` 组件，列出核心 Feature（实时告警、防 Rug、AI 归因、Dashboard）。
   - 集成 Stripe Checkout Server Action。
3. **测试与验证**
   - 验证未登录和已登录状态下的路由跳转逻辑。
   - 验证移动端响应式布局。

---

## 🛠️ Unit 10b: 前端部署 (Vercel)

**目标**：将前端应用部署到 Vercel，配置生产环境 Webhook，完成端到端闭环。
**依赖**：Unit 8, Unit 9, Unit 10a (后端已部署)

### 详细执行步骤 (1 天)
1. **Vercel 项目配置**
   - 在 Vercel 导入 `apps/web` 目录。
   - 配置 Framework 为 Next.js。
2. **环境变量注入**
   - 配置 `DATABASE_URL` (Neon HTTP endpoint)。
   - 配置 `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`。
   - 配置 `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`。
   - 配置 `BACKEND_API_URL` (Railway 生产地址), `BACKEND_API_KEY`。
   - 配置 `NEXT_PUBLIC_APP_URL`。
3. **Webhook 生产环境配置**
   - 在 Stripe Dashboard 将 Webhook 指向 Vercel 生产域名 `/api/webhooks/stripe`。
   - 在 Clerk Dashboard 将 Webhook 指向 Vercel 生产域名 `/api/webhooks/clerk`。
4. **端到端验证 (生产环境)**
   - 注册新账号 -> 触发 Clerk Webhook -> DB 创建用户。
   - 访问 Pricing -> 唤起 Stripe Checkout -> 完成支付。
   - 触发 Stripe Webhook -> DB 创建订阅记录。
   - 访问 Dashboard -> 成功绕过 Paywall -> 查看到 Railway 后端返回的真实告警数据。

---

## 🔄 知识复合与复盘 (Compound)
在 Phase 2b 的每个 Unit 完成后，必须执行 `/ce:compound`：
- **Unit 5**: 沉淀 Fastify 与 Next.js 跨服务 API 鉴权的最佳实践。
- **Unit 8**: 沉淀 Next.js App Router 下 SSR + ISR 结合 Paywall 的缓存失效策略。
- **Unit 10b**: 沉淀 Vercel + Railway + Neon 多云环境下的环境变量与网络连通性排坑指南。

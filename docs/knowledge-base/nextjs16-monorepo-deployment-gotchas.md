---
title: "Next.js 16 + pnpm Monorepo 部署排坑指南"
type: knowledge
unit: "Phase 2b - Unit 9, 10b"
date: 2026-04-01
tags: [nextjs16, monorepo, vercel, deployment, clerk, stripe]
---

# Next.js 16 + pnpm Monorepo 部署排坑指南

## 坑 1：middleware.ts 已更名为 proxy.ts（Breaking Change）

Next.js 16 将 `middleware.ts` 更名为 `proxy.ts`，导出函数从 `middleware` 改为 `proxy`。

**错误**：创建 `middleware.ts` → 构建报错 "Both middleware and proxy detected"

**正确**：
```typescript
// src/proxy.ts
export const proxy = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});
```

**注意**：Clerk SDK 的函数仍叫 `clerkMiddleware`（SDK 还没跟进重命名），但 Next.js 文件必须叫 `proxy.ts`。

## 坑 2：Monorepo workspace 包的 .js 扩展名

**现象**：`@radar/shared` 和 `@radar/db` 的 `import ... from './foo.js'` 在 Next.js bundler 中报 "Module not found"。

**根因**：
- TypeScript ESM 规范要求 import 用 `.js` 扩展名（因为 tsc 不重写扩展名）
- workspace 包的 `package.json` 用 `"main": "./src/index.ts"` 直接指向源码
- Next.js bundler（Turbopack）从 `.ts` 源码解析时找不到 `.js` 文件

**解决**：去掉所有 workspace 包内部 import 的 `.js` 扩展名，让 bundler 自动解析。

```diff
- export { users } from './users.js';
+ export { users } from './users';
```

**影响范围**：`@radar/shared`（index.ts, constants/index.ts）+ `@radar/db`（index.ts, schema/index.ts, client.ts, client.pool.ts, schema/alerts.ts, schema/subscriptions.ts）

**教训**：monorepo 中通过 bundler 直接消费 TS 源码时，不要用 `.js` 扩展名。如果包需要编译输出才用。

## 坑 3：Next.js 16 的 params 和 searchParams 是 Promise

```typescript
// Next.js 15: 同步
export default function Page({ params }: { params: { id: string } }) {}

// Next.js 16: 必须 await
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
}
```

`searchParams` 同理。忘记 await 会导致类型错误或运行时 `[object Promise]`。

## Server Action 作为 BFF 层

Pricing 页面的 Stripe Checkout 集成使用 Server Action 而非 API Route：

```typescript
// app/pricing/actions.ts
'use server';

export async function createCheckoutSession(clerkUserId: string, email: string) {
  const res = await fetch(`${process.env.BACKEND_API_URL}/api/v1/checkout`, {
    headers: { 'X-API-Key': process.env.BACKEND_API_KEY! },
    // ...
  });
}
```

**优势**：
- API Key 永远不出现在客户端 bundle
- 自动 RPC 调用，无需手动写 Route Handler
- TypeScript 端到端类型安全

**注意**：Server Action 中不能用 `redirect()`，需要返回 URL 让客户端 `window.location.href` 跳转。

## Clerk Webhook 签名验证

Clerk 底层使用 **Svix** 作为 webhook 基础设施，验签用 `svix` 包：

```typescript
import { Webhook } from 'svix';

const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
const payload = wh.verify(body, {
  'svix-id': headers.get('svix-id')!,
  'svix-timestamp': headers.get('svix-timestamp')!,
  'svix-signature': headers.get('svix-signature')!,
});
```

**不是**用 Clerk SDK 验签，而是用 `svix` 包。

## Vercel Monorepo 部署配置

```json
// apps/web/vercel.json
{
  "framework": "nextjs",
  "installCommand": "pnpm install",
  "buildCommand": "pnpm --filter web build"
}
```

Vercel Dashboard 中需设置 Root Directory 为 `apps/web`。

## 环境变量清单

详见 `docs/plans/vercel-deploy-checklist.md`，共需配置 7 个环境变量（3 Clerk + 1 DB + 2 Backend + 1 App URL）。

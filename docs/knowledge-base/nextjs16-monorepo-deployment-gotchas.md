---
title: "Next.js 16 + pnpm Monorepo 部署排坑指南"
type: knowledge
unit: "Phase 2b - Unit 9, 10b"
date: 2026-04-01
last_updated: 2026-04-05
tags: [nextjs16, monorepo, vercel, deployment, clerk, stripe, turbopack, moduleResolution]
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

## 坑 2：Monorepo workspace 包的 .js 扩展名（⚠️ 已二次踩坑）

**现象**：`@radar/shared` 和 `@radar/db` 的 `import ... from './foo.js'` 在 Turbopack 构建中报 "Module not found"。

**Vercel 构建日志**：
```
Error: Turbopack build failed with 6 errors:
Module not found: Can't resolve './client.js'       (packages/db/src/index.ts:3)
Module not found: Can't resolve './client.pool.js'  (packages/db/src/index.ts:5)
Module not found: Can't resolve './schema/index.js' (packages/db/src/index.ts:2)
Module not found: Can't resolve './constants/index.js' (packages/shared/src/index.ts:24)
```

**根因**：TypeScript `moduleResolution: Node16` 与 Turbopack 源码解析的根本不兼容：

| 工具 | 解析策略 | `from './client.js'` |
|------|---------|---------------------|
| **tsc (Node16)** | 模拟 Node.js ESM 行为，要求 `.js` 后缀 | ✅ 映射到 `client.ts` |
| **Turbopack** | 直接读 `.ts` 源码，查找字面文件 | ❌ 找不到 `client.js` |
| **Node.js ESM** | 加载编译后的 `.js` 文件 | ✅ 文件真实存在 |

关键条件：workspace 包用 `"main": "./src/index.ts"` 直接暴露源码（无构建步骤），所以不存在 `.js` 输出文件。

**2026-04-05 二次踩坑经过**（commit `09d3f51` → `399ce33`）：

为修复 `tsc --noEmit` 的 TS2835 错误，给 9 个文件加上了 `.js` 后缀 → 本地 typecheck 通过 → 推送后 Vercel 部署失败。

尝试过但失败的修复路径：
1. **`moduleResolution: Bundler`** — shared/db 的 tsconfig 改为 Bundler 模式，去掉 `.js` 后缀 → Turbopack 能构建了，但 backend（Node16 模式）通过 workspace 引用检查这些包的源码时又报 TS2835
2. **Turbopack `resolveExtensions`** — 在 next.config.ts 添加 `turbopack: { resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'] }` → 无效，Turbopack 仍然无法将 `.js` 映射到 `.ts`

**最终解决**：恢复无后缀导入（原始状态），接受 `tsc` 的 TS2835 警告。Vercel 运行 `next build` 不运行 `tsc`，所以这些警告不影响部署。

```diff
- export { createHttpClient } from './client.js';
+ export { createHttpClient } from './client';
```

**影响范围**：`@radar/shared`（index.ts, constants/index.ts）+ `@radar/db`（index.ts, schema/index.ts, client.ts, client.pool.ts, schema/alerts.ts, schema/subscriptions.ts, schema/telegram-bindings.ts）

**防止回归**：
1. **导入路径变更后必须跑 `pnpm --filter web build`** — 不能只靠 `tsc` 通过就推送
2. **绝不在 workspace 源码包中加 `.js` 后缀** — 即使 tsc 报警。只有当包有编译步骤输出 `.js` 文件时才需要
3. **长期方案**：给 shared/db 加构建步骤（`tsc` 输出到 `dist/`，`main` 指向 `dist/index.js`），或等 backend 也能用 `moduleResolution: Bundler` 时统一切换

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

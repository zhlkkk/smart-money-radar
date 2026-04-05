---
title: "Turbopack 构建失败：workspace 包 .js 扩展名导致 Module not found"
module: "@radar/shared, @radar/db"
date: 2026-04-05
problem_type: build_error
component: tooling
severity: high
symptoms:
  - "Vercel deployment ERROR: Turbopack build failed with 6 errors"
  - "Module not found: Can't resolve './client.js' in packages/db/src/index.ts"
  - "Module not found: Can't resolve './constants/index.js' in packages/shared/src/index.ts"
  - "Import trace points to apps/web/src/app/api/webhooks/clerk/route.ts and apps/web/src/app/pricing/page.tsx"
root_cause: config_error
resolution_type: config_change
tags:
  - turbopack
  - moduleResolution
  - node16
  - pnpm-monorepo
  - workspace-packages
  - vercel
related_components:
  - "@radar/shared"
  - "@radar/db"
  - "Turbopack bundler"
  - "TypeScript Node16"
---

# Turbopack 构建失败：workspace 包 .js 扩展名导致 Module not found

## Problem

为修复 TypeScript TS2835 typecheck 错误，给 pnpm workspace 包（`@radar/shared`、`@radar/db`）的内部导入加上 `.js` 后缀。本地 typecheck 通过但 Vercel 部署失败 — Turbopack 无法将 `.js` 导入映射到 `.ts` 源文件。

## Symptoms

Vercel 构建日志：
```
Error: Turbopack build failed with 6 errors:
./packages/db/src/index.ts:3:1
Module not found: Can't resolve './client.js'

./packages/db/src/index.ts:5:1
Module not found: Can't resolve './client.pool.js'

./packages/shared/src/index.ts:24:1
Module not found: Can't resolve './constants/index.js'
```

Import trace 指向消费这些包的 web 路由（`clerk/route.ts`、`pricing/page.tsx`）。

## What Didn't Work

1. **`moduleResolution: Bundler`** — 将 shared/db 的 tsconfig 改为 `module: ESNext, moduleResolution: Bundler` 并去掉 `.js` → Turbopack 能构建，但 backend（Node16 模式）通过 workspace 引用检查这些包时又报 TS2835。两种 moduleResolution 模式无法在同一 monorepo 中共存于同一源文件。

2. **Turbopack `resolveExtensions`** — 在 `next.config.ts` 添加 `turbopack: { resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'] }` → 无效。Turbopack 的 resolve 仍然是字面匹配，不会自动将 `.js` 后缀映射到 `.ts` 文件。

## Solution

恢复无后缀导入（部署前的原始状态）：

```diff
// packages/db/src/index.ts
- export * from './schema/index.js';
- export { createHttpClient } from './client.js';
- export { createPoolClient } from './client.pool.js';
+ export * from './schema/index';
+ export { createHttpClient } from './client';
+ export { createPoolClient } from './client.pool';
```

tsconfig 保持 `moduleResolution: Node16` 不变。接受 `tsc --noEmit` 对这些包的 TS2835 警告 — 它们不影响 `next build`。

## Why This Works

根本原因是 TypeScript Node16 module resolution 与 Turbopack 源码解析的不兼容：

- **TypeScript Node16**：模拟 Node.js ESM 行为，要求 `.js` 后缀（因为 tsc 不重写扩展名，编译后需要 `.js` 文件存在）
- **Turbopack**：直接读取 `.ts` 源码（不经过编译），看到 `./client.js` 就查找字面的 `client.js` 文件
- **Workspace 包无构建步骤**：`"main": "./src/index.ts"` 直接暴露源码，不存在 `.js` 输出文件

无后缀导入 `from './client'` 可以工作，因为 Turbopack 的 resolver 自动尝试 `.ts`、`.tsx`、`.js` 等扩展名。TypeScript Node16 模式会对此报 TS2835 警告，但 Vercel 只运行 `next build`（Turbopack），不运行 `tsc`。

## Prevention

1. **导入路径变更后必须跑 `pnpm --filter web build`** — 不能只靠 `tsc --noEmit` 就认为安全
2. **绝不在无构建步骤的 workspace 包中加 `.js` 后缀** — 即使 tsc 报 TS2835 警告
3. **长期方案**：给 shared/db 加编译步骤（`tsc` 输出到 `dist/`，`main` 指向 `dist/index.js`），或统一迁移到 `moduleResolution: Bundler`

## Related

- `docs/knowledge-base/nextjs16-monorepo-deployment-gotchas.md` — 坑 2（本问题的综述版本）
- `docs/solutions/build-errors/esbuild-template-literal-backtick-escape-2026-04-02.md` — Railway 构建失败的类似排查模式
- Commits: `09d3f51`（加 .js，破坏部署）→ `399ce33`（恢复无后缀，修复部署）

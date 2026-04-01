---
title: "跨服务 API 鉴权模式：Fastify + Next.js + Clerk"
type: knowledge
unit: "Phase 2b - Unit 5"
date: 2026-04-01
tags: [auth, fastify, nextjs, clerk, api-key]
---

# 跨服务 API 鉴权模式

## 问题背景

Monorepo 中前端（Next.js on Vercel）需要安全调用后端（Fastify on Railway）的 REST API。API Key 不能暴露到浏览器。

## 最终模式：三层鉴权

```
浏览器 ──→ Next.js Proxy (Clerk auth) ──→ Route Handler ──→ Fastify (X-API-Key)
  │                                           │
  │ 1. Clerk session cookie                   │ 2. server-only fetch
  │    (自动携带)                              │    (API Key 注入)
  │                                           │
  └── 无 API Key 暴露                          └── X-API-Key header
```

### 第 1 层：Clerk Proxy（原 middleware）
- Next.js 16 已将 `middleware.ts` 更名为 `proxy.ts`（导出 `proxy` 函数）
- `createRouteMatcher` 定义公开路由（/、/pricing、/sign-in、/sign-up、/api/webhooks/**）
- 非公开路由自动 `auth.protect()` 跳转登录

### 第 2 层：Route Handler 鉴权
- `/api/alerts` 等客户端可调用的代理路由内部用 `auth()` 验证用户身份
- 确保即使绕过 Proxy 也无法未登录获取数据

### 第 3 层：Fastify X-API-Key
- `onRequest` hook 检查 `X-API-Key` header
- 仅保护 `/api/v1/*` 路径，不影响 `/webhook`、`/health`

## 关键决策

| 决策 | 理由 |
|------|------|
| API Key 存 server-only 模块 | `import 'server-only'` 确保 bundler 不打包到客户端 |
| Route Handler 作代理 | 客户端分页需要 fetch，但不能直接携带 API Key |
| Clerk auth() 在 Route Handler 内 | 防止未登录用户通过直接 URL 调用代理获取数据 |

## 游标分页最佳实践

```typescript
// 后端：多查 1 条来判断 hasMore，比 COUNT(*) 快
const rows = await db.select().from(table).limit(limit + 1);
const hasMore = rows.length > limit;
const data = hasMore ? rows.slice(0, limit) : rows;
const cursor = data.at(-1)?.id ?? null;
```

- 前端传 `cursor` + `limit`，后端用 `WHERE id < cursor` + `ORDER BY createdAt DESC`
- 比 offset 分页更适合实时数据流（新数据插入不导致重复/跳过）

## 踩坑记录

1. **limit 上限校验要双层**：前端代理层 `Math.min(limit, 100)` + 后端也有 `Math.min`，防御纵深
2. **Fastify URL 前缀匹配**：`request.url.startsWith('/api/v1')` 简单有效，但注意 query string 不影响匹配

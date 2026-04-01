---
title: "Next.js 16 App Router 下的 SSR Paywall 模式"
type: knowledge
unit: "Phase 2b - Unit 8"
date: 2026-04-01
tags: [nextjs, paywall, ssr, clerk, subscription]
---

# SSR Paywall 模式

## 核心教训

**客户端 blur 遮罩不是 Paywall，是安全剧场。**

### 错误做法（QA 驳回）

```tsx
// SubscriptionGuard — Client Component
// 问题：数据已经 SSR 渲染到 HTML，查看源码即可获取
<div className="blur-sm pointer-events-none">
  {children}  {/* 数据已在 HTML 中！ */}
</div>
```

### 正确做法（服务端拦截）

```tsx
// dashboard/layout.tsx — async Server Component
export default async function DashboardLayout({ children }) {
  const user = await currentUser();  // Clerk 服务端 API
  const isSubscribed = user?.publicMetadata?.subscriptionStatus === 'active';

  if (!isSubscribed) {
    return <Paywall />;  // children 根本不渲染 → 不触发数据请求
  }

  return <div>{children}</div>;
}
```

**关键差异**：Server Component 中不渲染 children = 子页面的 `fetch()` 不会执行 = 数据不会出现在 HTML 中。

## Server/Client 组件分界原则

| 组件 | 类型 | 原因 |
|------|------|------|
| AlertCard | Server | 纯展示，无交互 |
| WalletCard | Server | 纯展示，Link 组件不需要 'use client' |
| SidebarNav | Client | 需要 `usePathname()` 高亮当前路由 |
| LoadMoreAlerts | Client | 需要 `useState` + `fetch` 处理分页 |
| SubscriptionGuard | ~~Client~~ | 已废弃，改用 layout.tsx 服务端检查 |
| PricingCard | Client | 需要 `useUser()` + 点击事件 |

**原则**：尽量保持 Server Component，只在需要 hooks/事件/浏览器 API 时才加 `'use client'`。

## API 代理路由模式

客户端组件（如 LoadMoreAlerts）需要 fetch 后端数据，但不能直接调用后端（API Key 会暴露）。

```
LoadMoreAlerts (client) → /api/alerts (Route Handler) → Backend /api/v1/alerts
                              │
                              ├── auth() 验证 Clerk session
                              └── server-only 注入 API Key
```

## ISR 与 force-dynamic 的选择

- 所有 Dashboard 页面用 `export const dynamic = 'force-dynamic'`（每次请求都 SSR）
- `BackendClient` 内部的 fetch 用 `next: { revalidate: 30 }` 做数据层 ISR
- 效果：页面始终 SSR（保证订阅状态实时），但后端数据有 30 秒缓存

## formatRelativeTime 的 SSR 注意事项

在 Server Component 中使用 `new Date()` 计算相对时间（"3 分钟前"），时间是服务端渲染时刻的。
- `force-dynamic` 模式下可接受（每次请求都重新计算）
- 如果改为 ISR 缓存页面，需要把时间展示改为 Client Component

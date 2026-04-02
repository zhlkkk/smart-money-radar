---
title: "feat: Dashboard 订阅状态展示"
type: feat
status: completed
date: 2026-04-02
---

# feat: Dashboard 订阅状态展示

## Overview

在 Dashboard 侧边栏和总览页展示用户当前的订阅状态（Pro / 未订阅 / 续费提醒），让用户随时知道自己的订阅情况。

## Problem Frame

当前用户订阅成功后，Dashboard 上没有任何地方展示订阅状态。用户无法确认自己是否已订阅、订阅是否到期。对于 Helio 非托管续费模式，`past_due` 状态需要醒目提醒用户手动续费。

## Requirements Trace

- R1. 已订阅用户在侧边栏底部能看到 "Pro" 状态标签
- R2. 未订阅用户在侧边栏底部能看到 "Free" 状态 + 升级入口
- R3. `past_due` 用户看到续费提醒（警告色）+ 跳转 Pricing 入口
- R4. 所有文案支持中英文 i18n
- R5. 侧边栏折叠时仍能展示简洁状态（图标 + 颜色）

## Scope Boundaries

- 不新增后端 API — 订阅状态完全从 Clerk `publicMetadata.subscriptionStatus` 读取
- 不改变 Paywall 拦截逻辑 — layout.tsx 的服务端拦截保持不变
- 不处理 `trialing` / `paused` 等 DB-only 状态 — 当前 Helio 只同步 `active` 和 `canceled` 到 Clerk

## Context & Research

### Relevant Code and Patterns

- `apps/web/src/app/dashboard/layout.tsx` — 已读取 `publicMetadata.subscriptionStatus`，判断 `isSubscribed`
- `apps/web/src/components/sidebar-nav.tsx` — Client Component，底部有系统状态 + UserButton + 工具栏
- `apps/web/src/components/telegram-bind.tsx` — 状态型 Client Component 的参考模式（按状态分支渲染）
- `apps/web/src/components/ui/badge.tsx` — 现有 Badge 组件
- `apps/web/messages/en.json` / `zh.json` — i18n 翻译文件

### Institutional Learnings

- Helio 是非托管模式，用户必须手动续费 → `past_due` 需要醒目 UI 提醒（见 `docs/solutions/best-practices/payment-provider-migration-china-developer-2026-04-02.md`）
- 后端枚举 + 前端 i18n 标签模式 — 与 confidence level 展示一致（见 confidence-scoring 文档）

## Key Technical Decisions

- **状态数据传递方式**：Dashboard layout（Server Component）已读取 `publicMetadata`，通过 prop 传递 `subscriptionStatus` 到 `SidebarNav`（Client Component），避免客户端额外调用 `useUser()`。这比在 SidebarNav 内部用 `useUser()` 更高效（零客户端请求）。
- **展示位置**：侧边栏底部"系统状态"区域上方，新增一行订阅状态。侧边栏是全局可见的，比放在 Dashboard 总览页更好（总览页只是子路由之一）。
- **状态映射**：`active` → Pro（绿色），`past_due` → 续费提醒（金色/警告），其他/undefined → Free（灰色 muted）。

## Implementation Units

- [ ] **Unit 1: 侧边栏订阅状态展示**

  **Goal:** 在侧边栏底部展示订阅状态标签，支持三种状态和折叠模式。

  **Requirements:** R1, R2, R3, R4, R5

  **Dependencies:** None

  **Files:**
  - Modify: `apps/web/src/app/dashboard/layout.tsx` — 传递 `subscriptionStatus` prop 给 SidebarNav
  - Modify: `apps/web/src/components/sidebar-nav.tsx` — 新增订阅状态展示区域
  - Modify: `apps/web/messages/en.json` — 添加 `subscription` namespace 翻译键
  - Modify: `apps/web/messages/zh.json` — 添加 `subscription` namespace 翻译键

  **Approach:**
  - layout.tsx 将 `metadata?.subscriptionStatus` 作为 prop 传给 `<SidebarNav subscriptionStatus={...} />`
  - SidebarNav 在"系统状态"区域上方新增一个订阅状态行：
    - `active`: 绿色 `Crown` 图标 + "Pro" 文字 + 绿色小圆点
    - `past_due`: 金色 `AlertTriangle` 图标 + "续费" 文字 + 链接到 `/pricing`
    - 其他/undefined: muted `Sparkles` 图标 + "Free" + "升级" 链接到 `/pricing`
  - 折叠时只显示图标（带 title tooltip），展开时显示图标 + 文字
  - 使用项目现有 CSS 变量体系（`--smr-accent-green`, `--smr-accent-gold`, muted）

  **Patterns to follow:**
  - `sidebar-nav.tsx` 现有的折叠/展开模式（`!collapsed && label`）
  - `StatusPulse` 组件的状态指示模式
  - Lucide 图标一致使用 `size={16}`

  **Test scenarios:**
  - Happy path: `subscriptionStatus='active'` 时渲染 Pro 标签（绿色）
  - Happy path: `subscriptionStatus=undefined` 时渲染 Free + 升级链接
  - Edge case: `subscriptionStatus='past_due'` 时渲染续费提醒（金色）+ pricing 链接
  - Edge case: `subscriptionStatus='canceled'` 时等同 Free 状态
  - Edge case: 侧边栏折叠时只渲染图标，无文字

  **Verification:**
  - `pnpm --filter web build` 构建成功
  - 手动验证三种状态的渲染效果（通过 Clerk Dashboard 修改 publicMetadata 测试）

## System-Wide Impact

- **Interaction graph:** layout.tsx → SidebarNav 新增一个 prop，影响面小
- **API surface parity:** 无新 API，纯前端展示
- **Unchanged invariants:** Paywall 拦截逻辑不变，后端订阅同步逻辑不变

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Clerk `publicMetadata` 同步延迟导致状态不一致 | 已知限制，Helio webhook 已做 fire-and-forget 同步，用户刷新页面即可看到最新状态 |
| `past_due` 状态未同步到 Clerk（当前行为） | 当前 Helio webhook 只同步 `active`/`canceled`，`past_due` 仅在 DB。短期仅展示 active/free 两态，后续可补全 |

## Sources & References

- 相关文件: `apps/web/src/app/dashboard/layout.tsx`, `apps/web/src/components/sidebar-nav.tsx`
- 相关文档: `docs/solutions/best-practices/payment-provider-migration-china-developer-2026-04-02.md`

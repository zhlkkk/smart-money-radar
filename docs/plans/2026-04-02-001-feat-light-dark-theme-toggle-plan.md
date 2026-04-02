---
title: "feat: 明暗模式切换 + Dashboard 层次感优化"
type: feat
status: active
date: 2026-04-02
origin: user-spec-2026-04-02-theme-toggle
---

# 明暗模式切换 + Dashboard 层次感优化

## Overview

为整站添加明暗模式切换功能，同时优化 Dashboard 控制台在暗色模式下的视觉层次。当前控制台页面太黑、缺少层次梯度，需要通过更丰富的背景色阶和卡片阴影来增加深度感。

## Problem Frame

1. **Dashboard 太黑无层次**：当前所有背景都是 `#0a0e1a` ~ `#111827` 的窄色阶，卡片与背景几乎融为一体
2. **不支持明暗模式切换**：用户在明亮环境下使用时体验差，竞品（Dexscreener、Birdeye）都支持模式切换

## Requirements Trace

- R1. 支持 Dark / Light 模式切换，用户偏好持久化到 localStorage
- R2. 跟随系统偏好 `prefers-color-scheme` 作为默认值
- R3. 切换按钮放在侧边栏底部（Dashboard）和导航栏（Landing Page）
- R4. Dark 模式优化：增加背景色阶梯度，卡片加微妙阴影/边框提亮，拉开层次
- R5. Light 模式设计：白/浅灰底，深色文字，保持 crypto 专业感（不是消费 SaaS 白）
- R6. Clerk 主题跟随切换（dark theme ↔ 默认）
- R7. 所有现有页面和组件正确响应主题切换
- R8. 过渡动画平滑（`transition: background-color, color`）

## Scope Boundaries

**在范围内**：主题令牌系统（dark/light 两套）、切换组件、Clerk 主题适配、Dashboard 层次优化、所有页面响应

**不在范围内**：自定义主题色、第三个主题（如 midnight blue）、后端任何变更

## Key Technical Decisions

- **CSS 变量 + `html.dark` / `html.light` 类选择器**：在 `:root` 定义 light 默认值，`.dark` 覆盖为暗色值。Tailwind v4 的 `@theme inline` 自动跟随 CSS 变量变化。理由：最简实现，零 JS 运行时开销，SSR 兼容。

- **ThemeProvider 客户端组件**：读取 localStorage + `prefers-color-scheme`，在 `<html>` 上设置类名。用 `useEffect` 避免 SSR hydration mismatch。理由：Next.js App Router 中 `<html>` 需要在客户端动态设置类名。

- **Clerk 主题动态切换**：根据当前主题传入 `dark` 或 `undefined` baseTheme。需要将 ClerkProvider 包裹在 ThemeProvider 内。

- **Dashboard 暗色层次优化**：拉大背景色阶间距，卡片加 `box-shadow` + 更亮的边框，侧边栏背景独立色值。

## Implementation Units

- [ ] **Unit 1: 双模式设计令牌 + ThemeProvider**

**Goal:** 建立 light/dark 双套 CSS 变量，创建主题切换基础设施

**Dependencies:** 无

**Files:**
- Modify: `apps/web/src/app/globals.css` — light/dark 双套令牌
- Create: `apps/web/src/components/theme-provider.tsx` — ThemeProvider 客户端组件
- Create: `apps/web/src/components/ui/theme-toggle.tsx` — 切换按钮组件
- Modify: `apps/web/src/app/layout.tsx` — 集成 ThemeProvider

**Approach:**
- `:root` 定义 light 模式默认值（白/浅灰背景、深色文字、降低强调色饱和度）
- `.dark` 选择器覆盖为当前暗色值
- ThemeProvider: `useEffect` 读取 `localStorage.theme` → 如无则读 `prefers-color-scheme` → 设置 `<html>` className
- ThemeToggle: Sun/Moon 图标切换，`onClick` 更新 localStorage + className
- `globals.css` 的 `.glass-card` 和其他工具类也需要在 light 模式下有合适的样式
- `body` 和 `@theme inline` 引用 CSS 变量，自动跟随切换

**Test expectation:** none — 纯 UI 基础设施

**Verification:**
- 点击切换按钮，整站背景/文字/卡片颜色正确切换
- 刷新页面后主题持久化
- 新开页面时跟随系统偏好

---

- [ ] **Unit 2: Dashboard 暗色层次优化**

**Goal:** 增加 Dashboard 在暗色模式下的视觉层次和深度

**Dependencies:** Unit 1

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx` — 卡片样式增强
- Modify: `apps/web/src/app/dashboard/layout.tsx` — 侧边栏/主区域背景梯度
- Modify: `apps/web/src/components/sidebar-nav.tsx` — 侧边栏层次优化
- Modify: `apps/web/src/components/ui/glass-card.tsx` — 暗色模式 shadow 增强

**Approach:**
- Dark 模式背景色阶拉大：`primary: #060a14`(最深) → `card: #0f1629`(中) → `elevated: #1a2540`(亮) → `hover: #243050`(最亮)
- GlassCard 在 dark 模式加 `box-shadow: 0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)`
- 侧边栏背景比主区域略浅，形成视觉分层
- Dashboard 主区域加微妙渐变底色，从左上到右下

**Test expectation:** none — 纯视觉优化

**Verification:**
- Dashboard 卡片与背景有明显层次区分
- 侧边栏与主区域有视觉分界

---

- [ ] **Unit 3: 全站组件 Light 模式适配**

**Goal:** 确保所有页面和组件在 Light 模式下正确渲染

**Dependencies:** Unit 1

**Files:**
- Modify: `apps/web/src/app/page.tsx` — Landing Page light 适配 + 导航栏加切换按钮
- Modify: `apps/web/src/app/pricing/page.tsx` — 定价页 light 适配
- Modify: `apps/web/src/components/alert-card.tsx` — 告警卡片 light 适配
- Modify: `apps/web/src/components/wallet-card.tsx` — 钱包卡片 light 适配
- Modify: `apps/web/src/components/wallet-list-client.tsx` — 筛选栏 light 适配
- Modify: `apps/web/src/components/pricing-card.tsx` — 定价卡片 light 适配
- Modify: `apps/web/src/components/subscription-guard.tsx` — 付费墙 light 适配
- Modify: `apps/web/src/components/sidebar-nav.tsx` — 加切换按钮

**Approach:**
- Light 模式色板：bg `#f8fafc` → card `#ffffff` → elevated `#f1f5f9` → text `#0f172a`
- 强调色在 light 模式降低饱和度/加深：cyan → `#0891b2`，green → `#059669`
- Landing Page 导航栏 + 侧边栏底部各放一个 ThemeToggle
- 所有硬编码的 `var(--smr-*)` 引用已通过 CSS 变量，自动跟随切换
- 需要单独处理的：背景光晕透明度、粒子颜色、玻璃效果参数

**Test expectation:** none — 纯视觉适配

**Verification:**
- Light 模式下所有页面文字可读、卡片有边框/阴影区分
- 切换按钮在 Landing Page 和 Dashboard 都可见

---

- [ ] **Unit 4: Clerk 主题动态切换**

**Goal:** Clerk 登录/注册组件跟随明暗模式切换

**Dependencies:** Unit 1

**Files:**
- Modify: `apps/web/src/app/layout.tsx` — ClerkProvider 动态 theme

**Approach:**
- 将 ClerkProvider 的 `appearance.baseTheme` 从固定 `dark` 改为根据当前主题动态选择
- 创建一个 `ClerkThemeWrapper` 客户端组件，读取当前主题状态，传递给 ClerkProvider
- Dark 模式：`baseTheme: dark, colorBackground: '#0a0e1a'`
- Light 模式：`baseTheme: undefined, colorBackground: '#ffffff'`

**Test expectation:** none — 纯 Clerk UI 适配

**Verification:**
- 登录/注册页面在 light 模式下显示浅色 Clerk 组件
- Dark 模式下 Clerk 保持暗色

## System-Wide Impact

- **Interaction graph:** ThemeProvider 在 `<html>` 层级设置 className，所有 CSS 变量自动级联到所有子组件
- **State lifecycle:** 主题状态存储在 localStorage，SSR 时可能闪烁（flash of wrong theme）— 通过在 `<head>` 注入同步脚本解决
- **Unchanged invariants:** 所有 API 调用、认证流程、数据获取逻辑不变

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| SSR hydration mismatch（服务端 dark，客户端 light） | 在 `<head>` 注入同步脚本读取 localStorage，在 React hydrate 前设置 className |
| Clerk 动态主题需要客户端组件 | 用 ClerkThemeWrapper 包裹 |
| Light 模式下粒子/光晕太亮 | Light 模式降低粒子和光晕的 opacity |

---
title: "feat: 中英文多语言支持 (next-intl)"
type: feat
status: active
date: 2026-04-02
---

# 中英文多语言支持 (next-intl)

## Overview

为 Smart Money Radar 网站添加中英文双语支持。使用 `next-intl` 库（Next.js App Router 官方推荐的 i18n 方案），通过 JSON 消息文件管理翻译文本，URL 路径不变（通过 cookie/header 检测语言偏好）。

## Problem Frame

当前网站所有文案硬编码为中文。目标用户是全球加密货币交易者，英文支持是基础需求。

## Requirements Trace

- R1. 支持中文（zh）和英文（en）两种语言
- R2. 默认语言：英文（面向全球用户）
- R3. 语言切换按钮在导航栏和侧边栏可见
- R4. 语言偏好持久化到 cookie
- R5. 翻译文件集中管理（JSON），不散落在组件中
- R6. 所有页面：Landing、Dashboard、Wallets、Alerts、Pricing、Terms、Privacy、Refund
- R7. 组件级文案：sidebar、alert-card、wallet-card、empty-state 等

## Scope Boundaries

不在范围内：URL 路径国际化（`/en/dashboard`）、RTL 语言、SEO hreflang 标签、日期/数字格式本地化

## Key Technical Decisions

- **next-intl（非路由方式）**：使用 `NextIntlClientProvider` + `useTranslations()` hook。不做 URL 路径级 i18n（`/en/...` / `/zh/...`），通过 cookie 持久化语言偏好。理由：最小侵入性，不需要重构路由结构。

- **消息文件结构**：`apps/web/messages/en.json` + `apps/web/messages/zh.json`，按页面/组件命名空间组织。

- **Server Component 支持**：next-intl 原生支持 RSC，通过 `getTranslations()` 获取翻译。

## Implementation Units

- [ ] **Unit 1: next-intl 基础设施**

**Goal:** 安装配置 next-intl，建立翻译文件结构

**Dependencies:** 无

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/messages/en.json`
- Create: `apps/web/messages/zh.json`
- Create: `apps/web/src/i18n/request.ts` — next-intl 请求配置
- Create: `apps/web/src/components/ui/locale-toggle.tsx` — 语言切换按钮
- Modify: `apps/web/src/app/layout.tsx` — 集成 NextIntlClientProvider

**Test expectation:** none — 基础设施配置

---

- [ ] **Unit 2: Landing Page + Footer 国际化**

**Goal:** Landing Page 所有文案提取到翻译文件

**Dependencies:** Unit 1

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/zh.json`

---

- [ ] **Unit 3: Dashboard 页面国际化**

**Goal:** Dashboard 总览、侧边栏、layout 文案国际化

**Dependencies:** Unit 1

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx`
- Modify: `apps/web/src/app/dashboard/layout.tsx`
- Modify: `apps/web/src/components/sidebar-nav.tsx`

---

- [ ] **Unit 4: 钱包 + 告警页面国际化**

**Goal:** 钱包列表/详情、告警历史、卡片组件文案国际化

**Dependencies:** Unit 1

**Files:**
- Modify: `apps/web/src/app/dashboard/wallets/page.tsx`
- Modify: `apps/web/src/app/dashboard/wallets/[address]/page.tsx`
- Modify: `apps/web/src/app/dashboard/alerts/page.tsx`
- Modify: `apps/web/src/components/wallet-card.tsx`
- Modify: `apps/web/src/components/wallet-list-client.tsx`
- Modify: `apps/web/src/components/alert-card.tsx`
- Modify: `apps/web/src/components/load-more-alerts.tsx`

---

- [ ] **Unit 5: Pricing + 法律页面国际化**

**Goal:** 定价、Terms、Privacy、Refund 页面国际化

**Dependencies:** Unit 1

**Files:**
- Modify: `apps/web/src/app/pricing/page.tsx`
- Modify: `apps/web/src/app/terms/page.tsx`
- Modify: `apps/web/src/app/privacy/page.tsx`
- Modify: `apps/web/src/app/refund/page.tsx`
- Modify: `apps/web/src/components/helio-checkout.tsx`
- Modify: `apps/web/src/components/subscription-guard.tsx`

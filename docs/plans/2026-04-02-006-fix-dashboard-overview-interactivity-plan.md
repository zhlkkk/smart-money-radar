---
title: "fix: Dashboard 总览页交互优化 — 统计卡片可点击 + 移除重复导航"
type: fix
status: active
date: 2026-04-02
---

# fix: Dashboard 总览页交互优化

## Overview

Dashboard 总览页存在三层重复导航（统计卡片纯展示 + Bento Grid 快速导航 + 侧边栏），同时最近告警列表条目不可点击。优化方案：统计卡片变为可点击链接，移除 Bento Grid 快速导航（消除重复），最近告警条目可点击跳转。

## Requirements Trace

- R1. 统计卡片（活跃钱包、告警状态）变为可点击，跳转到对应页面
- R2. 移除 Bento Grid 快速导航区块（与统计卡片+侧边栏三重重复）
- R3. 最近告警列表条目可点击，跳转到告警历史页
- R4. 所有可点击元素有 hover 视觉反馈

## Scope Boundaries

- 不新增页面或路由
- 不改变数据获取逻辑
- 系统状态卡片保持不可点击（无对应跳转页面）

## Implementation Units

- [ ] **Unit 1: 统计卡片可点击 + 移除 Bento Grid + 告警条目可点击**

**Goal:** 一次性修改 dashboard/page.tsx，统计卡片包裹 Link，删除 Bento Grid，告警条目包裹 Link

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx`

**Approach:**
- 活跃钱包卡片：外层包裹 `<Link href="/dashboard/wallets">`，移除 `hover={false}`
- 告警状态卡片：外层包裹 `<Link href="/dashboard/alerts">`，移除 `hover={false}`
- 系统状态卡片：保持不变（无跳转目标）
- 删除整个"快速导航"section（h2 + grid + 两个 Link GlassCard）
- 最近告警条目：GlassCard 包裹 `<Link href="/dashboard/alerts">`，添加 hover 效果
- 删除不再需要的 import（ArrowRight、TrendingUp）

**Test scenarios:**
- Happy path: 点击活跃钱包卡片跳转 /dashboard/wallets
- Happy path: 点击告警状态卡片跳转 /dashboard/alerts
- Happy path: 点击最近告警条目跳转 /dashboard/alerts
- Happy path: hover 时有视觉反馈
- Edge case: 系统状态卡片不可点击

**Verification:**
- next build 成功
- 三个统计卡片中两个可点击
- Bento Grid 区块完全移除
- 最近告警条目可点击

---
title: "feat: SSE 实时告警推送 — Dashboard 实时显示新告警"
type: feat
status: active
date: 2026-04-02
---

# SSE 实时告警推送

## Overview

通过 Server-Sent Events (SSE) 将后端新告警实时推送到 Dashboard，用户无需刷新即可看到最新交易。

## Key Technical Decisions

- **SSE 而非 WebSocket**：告警是单向推送（服务端→客户端），SSE 更简单、HTTP 原生、自动重连、Railway/Vercel 都支持。WebSocket 适合双向通信，这里不需要。

- **架构：后端 SSE 端点 + 前端 EventSource 客户端**
  - 后端：Fastify 注册 `GET /api/v1/alerts/stream` SSE 端点
  - Pipeline 发送告警时，通过内存事件总线广播给所有 SSE 连接
  - 前端：客户端组件用 `EventSource` 监听，新告警插入列表顶部带入场动画

## Implementation Units

- [ ] **Unit 1: 后端 SSE 端点 + 事件总线**

**Files:**
- Create: `apps/backend/src/api/alerts-stream.ts` — SSE 路由
- Create: `apps/backend/src/events.ts` — 内存事件总线 (EventEmitter)
- Modify: `apps/backend/src/pipeline.ts` — 告警持久化后广播事件
- Modify: `apps/backend/src/index.ts` — 注册 SSE 路由

- [ ] **Unit 2: 前端实时告警组件**

**Files:**
- Create: `apps/web/src/components/realtime-alerts.tsx` — EventSource 客户端
- Modify: `apps/web/src/app/dashboard/alerts/page.tsx` — 集成实时组件
- Modify: `apps/web/src/app/dashboard/page.tsx` — Dashboard 总览也显示实时告警

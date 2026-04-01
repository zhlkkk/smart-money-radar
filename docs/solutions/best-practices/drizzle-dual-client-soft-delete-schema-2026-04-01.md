---
title: "Drizzle 双客户端架构 + 软删除 Schema 设计"
date: 2026-04-01
category: best-practices
module: database
problem_type: best_practice
component: schema_design
severity: medium
applies_when:
  - "使用 Neon PostgreSQL 同时服务 Vercel 无服务器环境和长运行后端"
  - "设计 SaaS 用户/订阅/支付相关的数据库 schema"
  - "在 pnpm monorepo 中共享数据库包"
  - "需要支付审计的场景下处理用户删除"
tags:
  - drizzle
  - neon
  - postgresql
  - dual-client
  - soft-delete
  - schema
  - saas
  - subscription
---

# Drizzle 双客户端架构 + 软删除 Schema 设计

## Context

Smart Money Radar Phase 2 引入了 Web Dashboard（Vercel）和 Fastify 后端（Railway），两者需要访问同一个 Neon PostgreSQL 数据库。Neon 的 HTTP endpoint 和 Pooler endpoint 是不同的 URL，需要不同的驱动方式。同时，用户/订阅系统需要支持支付审计，不能硬删除用户记录。

## Guidance

### 1. Neon 双客户端模式

Neon 提供两种连接方式，适用于不同的运行时环境：

| 客户端 | 驱动 | 环境变量 | 适用场景 |
|--------|------|----------|----------|
| HTTP Client | `@neondatabase/serverless` 的 `neon()` | `DATABASE_URL` | Vercel 无服务器函数（无连接池开销，每次请求独立） |
| Pool Client | `@neondatabase/serverless` 的 `Pool` | `DATABASE_POOL_URL` | Railway 长运行服务（WebSocket 持久连接，支持事务） |

**关键区别**：这是两个不同的环境变量和不同的 Neon endpoint URL。HTTP endpoint 和 Pooler endpoint 格式不同，不能混用。

```typescript
// packages/db/src/client.ts — Vercel 用
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

export function createHttpClient(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle({ client: sql, schema });
}

// packages/db/src/client.pool.ts — Railway 用
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

export function createPoolClient(databasePoolUrl: string) {
  const pool = new Pool({ connectionString: databasePoolUrl });
  return drizzle({ client: pool, schema });
}
```

**注意**：Drizzle 对两种驱动使用不同的导入路径（`drizzle-orm/neon-http` vs `drizzle-orm/neon-serverless`）。

### 2. 软删除 + 无级联约束

支付相关系统中，用户删除不能使用 `onDelete: cascade`，否则订阅记录丢失会导致审计断链。

**设计决策**：
- `users` 表使用 `deletedAt` nullable timestamp 实现软删除
- `subscriptions` 表的 `userId` FK 引用 `users.id`，**不设 cascade**
- 用户删除时：先调 `stripe.subscriptions.cancel()` → 再 `UPDATE subscriptions SET status = 'canceled'` → 最后 `UPDATE users SET deleted_at = now()`
- 订阅记录永久保留用于审计

```typescript
// users 表 — 软删除
deletedAt: timestamp('deleted_at', { withTimezone: true }),

// subscriptions 表 — 不级联
userId: text('user_id').notNull().references(() => users.id),  // 无 onDelete
```

### 3. 告警去重 — signature 唯一约束

Helius 提供 at-least-once 投递。Phase 1 用内存 LRU 去重，Phase 2 在 DB 层增加了 `signature` 唯一约束作为第二层防护。

```typescript
signature: text('signature').notNull().unique(),
```

写入时使用 `INSERT ... ON CONFLICT (signature) DO NOTHING`，保证幂等。

### 4. 预留字段策略

`alerts_history.userId` 在 Phase 2 始终为 `null`（单一频道，所有用户看同样告警），为 Phase 3 多租户预留。scope-guardian 审查指出这是"投机性预留"，但 nullable FK 的成本极低（一行 DDL），且避免了 Phase 3 的 breaking migration。

## Why This Matters

- **双客户端是 Vercel + 独立后端架构的必要模式**：用错驱动会导致无服务器环境中的连接泄漏（Pool）或长运行服务中的性能问题（每请求 HTTP）
- **硬删除 + cascade 在支付系统中是危险操作**：Stripe 订阅取消和数据库删除不是原子的。级联删除后，如果 Stripe 取消失败，会出现用户被删但仍被扣款的孤立状态
- **DB 层去重是内存去重的安全网**：进程重启后内存 LRU 清空，DB 唯一约束仍能防止重复

## When to Apply

- 任何使用 Neon PostgreSQL 的项目，同时服务无服务器和长运行环境
- SaaS 应用中涉及用户删除和支付记录保留的场景
- Webhook 消费者需要幂等写入的场景
- pnpm monorepo 中需要前后端共享数据库包的场景

## Related

- [Fire-and-Forget Webhook Pattern](fire-and-forget-webhook-graceful-degradation-2026-03-31.md) — DB 写入作为管道的非阻断分支
- [Auto Wallet Discovery Architecture](auto-wallet-discovery-architecture-2026-03-31.md) — tracked_wallets 表的前身（JSON 持久化）
- [Phase 2 Plan](../../plans/2026-03-31-002-feat-phase2-web-dashboard-plan.md) — 完整计划

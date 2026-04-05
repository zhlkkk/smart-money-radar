---
title: "fix: 修复钱包列表不自动更新的问题"
type: fix
status: completed
date: 2026-04-05
---

# fix: 修复钱包列表不自动更新的问题

## Overview

钱包列表（`tracked_wallets` 表）的 `updated_at` 时间戳停滞在 4 月 4 日之前。根因是 Drizzle ORM 的 `$onUpdate` 回调不会在 `INSERT ... ON CONFLICT DO UPDATE` 路径中触发，同时 discovery cycle 的运行状态缺乏可观测性，导致无法确认周期是否正常执行。

## Problem Frame

用户在数据库中观察到 `tracked_wallets.updated_at` 字段停留在旧时间。可能的原因有两层：

1. **显示层**：`syncTrackedWallets` 使用 `.insert().onConflictDoUpdate()`，Drizzle 的 `$onUpdate` 回调只在 `.update()` 中生效，因此即使 discovery cycle 正常运行，`updated_at` 也不会被刷新
2. **调度层**：Railway 容器部署使用临时文件系统，`discovered-wallets.json` 状态文件在 redeploy 后丢失。但 discovery 有 fallback 逻辑（30s 启动延迟后执行首次 cycle），所以状态文件丢失不会阻止 discovery 运行

## Requirements Trace

- R1. `syncTrackedWallets` 的 upsert 操作必须正确更新 `updated_at` 字段
- R2. Discovery cycle 的执行状态可观测（日志/健康检查可以确认是否正常运行）
- R3. `lastDiscoveredAt` 字段在每次 discovery upsert 时也应被正确更新

## Scope Boundaries

- 不改变 discovery 的调度逻辑（`setInterval` 6小时间隔）
- 不改变 Birdeye API 调用逻辑
- 不改变前端展示逻辑
- 不引入外部定时任务调度器（如 cron、BullMQ）

## Context & Research

### Relevant Code and Patterns

- `apps/backend/src/persistence/wallets.ts` — `syncTrackedWallets` 函数，使用 Drizzle `insert().onConflictDoUpdate()` 但 `set` 中未包含 `updatedAt`
- `packages/db/src/schema/wallets.ts` — `trackedWallets` schema，`updatedAt` 使用 `$onUpdate(() => new Date())` 但该回调不在 ON CONFLICT 路径生效
- `apps/backend/src/discovery/orchestrator.ts` — `createDiscovery` 函数，`setInterval` 调度，`runCycle` 核心逻辑
- `apps/backend/src/discovery/persistence.ts` — 状态文件的读写

### Institutional Learnings

- 项目使用 graceful degradation 模式：外部 API 失败不应阻塞核心功能
- `Promise.allSettled` 用于并行请求的错误隔离

## Key Technical Decisions

- **手动设置 `updatedAt` 而非依赖 `$onUpdate`**：Drizzle ORM 的 `$onUpdate` 是应用层 hook，不会在 `onConflictDoUpdate`（SQL 级别）中触发。最可靠的做法是在 `set` 中显式包含 `updatedAt: new Date()`
- **同时修复 `lastDiscoveredAt` 的传递**：当前 `onConflictDoUpdate` 已包含 `lastDiscoveredAt`，但只在 `source === 'discovered'` 时设置。对于 pinned 钱包的 upsert 更新，应保留原有值（使用 `undefined` 让 Drizzle 跳过该字段）。当前逻辑正确，无需修改
- **增加 discovery cycle 日志**：在 `start()` 和每次 `runCycle` 入口添加更多结构化日志，方便在 Railway 日志中排查

## Open Questions

### Resolved During Planning

- **Q: `$onUpdate` 是否在 `onConflictDoUpdate` 中工作？** → 不工作。Drizzle 的 `$onUpdate` 只在 `.update()` API 中注入，`INSERT ... ON CONFLICT DO UPDATE` 生成的 SQL 不包含该逻辑
- **Q: Railway 容器重启后 discovery 是否会恢复？** → 会。`start()` 检测到无状态文件时，30秒后启动首次 cycle。但 `HELIUS_API_KEY`、`BIRDEYE_API_KEY`、`HELIUS_WEBHOOK_ID` 三个环境变量必须全部存在

### Deferred to Implementation

- 是否需要数据库级别的 trigger 来保证 `updated_at` 一致性（当前用应用层修复即可）

## Implementation Units

- [ ] **Unit 1: 修复 syncTrackedWallets 的 updatedAt 更新**

**Goal:** 确保每次 upsert 都正确更新 `updated_at` 字段

**Requirements:** R1, R3

**Dependencies:** None

**Files:**
- Modify: `apps/backend/src/persistence/wallets.ts`
- Test: `apps/backend/test/persistence/wallets.test.ts`

**Approach:**
- 在 `onConflictDoUpdate` 的 `set` 对象中显式添加 `updatedAt: new Date()`
- 这样无论 `$onUpdate` 是否生效，`updated_at` 都会在每次 upsert 时被刷新

**Patterns to follow:**
- 项目中其他 upsert 操作的模式

**Test scenarios:**
- Happy path: upsert 一个已存在的 discovered 钱包，验证 `updated_at` 字段被更新为新时间
- Happy path: upsert 一个新钱包（INSERT 路径），验证 `updated_at` 为 `defaultNow()` 值
- Edge case: 连续两次 upsert 同一地址，验证第二次的 `updated_at` 晚于第一次

**Verification:**
- 单元测试通过
- 可以在数据库中观察到 `updated_at` 随 discovery cycle 刷新

- [ ] **Unit 2: 增强 discovery cycle 可观测性**

**Goal:** 在 discovery cycle 的关键节点添加结构化日志，便于排查问题

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `apps/backend/src/discovery/orchestrator.ts`
- Test: `apps/backend/test/discovery/orchestrator.test.ts`

**Approach:**
- 在 `start()` 中记录 discovery 配置（intervalMs, walletCap, 是否有 DB）
- 在 `runCycle` 开始时记录 cycle 编号（用计数器）
- 在数据库同步成功后记录同步的钱包数量
- 在 `catch` 块中记录完整错误栈（当前只记录 message）

**Patterns to follow:**
- 项目中已有的 `console.info('[discovery] ...')` 日志格式

**Test scenarios:**
- Happy path: 成功的 cycle 输出包含钱包同步数量的日志
- Error path: Birdeye API 失败时输出包含错误详情的日志

**Verification:**
- 测试中可以验证日志输出包含预期字段
- Railway 日志中能看到 discovery cycle 的执行记录

## System-Wide Impact

- **Interaction graph:** `syncTrackedWallets` 被 `orchestrator.runCycle` 和 `index.ts` 初始化时调用。修改 upsert 行为影响这两个调用点
- **Error propagation:** 数据库同步失败已在 orchestrator 中被 catch 并记为 non-fatal，不影响其他逻辑
- **State lifecycle risks:** 无。`updatedAt` 的修改是幂等的，不会影响数据一致性
- **API surface parity:** `/api/v1/wallets` 返回的 `updatedAt` 字段将正确反映最近更新时间，前端无需修改
- **Unchanged invariants:** Helius webhook 更新逻辑、Birdeye API 调用逻辑、scoring 算法不受影响

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 修改 upsert set 可能导致 Drizzle 生成的 SQL 变化 | 通过单元测试验证 upsert 行为正确 |
| Railway 环境变量缺失导致 discovery 不启动 | Unit 2 增加启动日志，明确记录 discovery 是否 enabled |

## Sources & References

- Drizzle ORM `$onUpdate` 文档：仅在 `.update()` 中生效
- 相关代码：`packages/db/src/schema/wallets.ts:23-27`、`apps/backend/src/persistence/wallets.ts:39-50`

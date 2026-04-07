---
title: "fix: 补全钱包详情指标和 alert token symbol"
type: fix
status: active
date: 2026-04-07
---

# fix: 补全钱包详情指标和 alert token symbol

## Overview

修复两个数据流断裂问题：
1. 钱包详情页 Win Rate / PNL / Trades 显示 `-`：Birdeye 返回的原始指标在 scoring 阶段被丢弃，未传递到数据库
2. Alert 中 token 只显示地址没有 symbol：`persistAlert` 只读 `swap.tokenSymbol`，忽略了 enrichment 阶段获取的 symbol

## Problem Frame

**问题 1 — 钱包指标缺失：**
数据流：`Birdeye API (pnl, winRate, tradeCount)` → `WalletCandidate` → `scoreWallets()` → `ScoredWallet`(丢失!) → `orchestrator.dbEntries`(未传递) → `syncTrackedWallets`(收不到) → DB(null)

`ScoredWallet` 接口只包含 `compositeScore`，不保留原始的 `pnl`、`winRate`、`tradeCount`。数据库 schema 和前端已准备好接收这些字段，只是中间管道断了。

**问题 2 — Alert token symbol 缺失：**
数据流：`pipeline.ts` 合并了 `swap.tokenSymbol ?? enrichment.tokenSymbol`(正确!)，但 `persistAlert()` 在第 28 行只读 `input.swap.tokenSymbol`，完全忽略了 enrichment 获取的 symbol。

## Requirements Trace

- R1. `ScoredWallet` 接口必须携带 `pnl`、`winRate`、`tradeCount` 原始指标
- R2. `orchestrator.ts` 构建 `dbEntries` 时必须传递这三个字段
- R3. `persistAlert` 必须优先使用 enrichment 的 tokenSymbol，fallback 到 swap.tokenSymbol
- R4. 现有测试全部通过，新逻辑有测试覆盖

## Scope Boundaries

- 不修改前端（已能正确展示非 null 数据）
- 不修改数据库 schema（字段已存在）
- 不修改 Birdeye API 调用逻辑
- 不回填历史数据（新 discovery cycle 会自动更新）

## Key Technical Decisions

- **在 `ScoredWallet` 中添加可选字段而非必需字段**：grace period 中的钱包没有新的候选数据，使用可选字段避免强制要求
- **`persistAlert` 中使用 enrichment.tokenSymbol 优先**：enrichment 阶段的 DexScreener/Birdeye 数据比 Helius 解析更可靠

## Implementation Units

- [ ] **Unit 1: 扩展 ScoredWallet 接口并传递指标**

**Goal:** 让 Birdeye 原始指标穿透 scoring 到达数据库

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `apps/backend/src/discovery/scoring.ts`
- Modify: `apps/backend/src/discovery/orchestrator.ts`
- Test: `apps/backend/test/discovery/scoring.test.ts`
- Test: `apps/backend/test/discovery/orchestrator.test.ts`

**Approach:**
- 在 `ScoredWallet` 接口添加可选字段 `pnl?: number`、`winRate?: number`、`tradeCount?: number`
- 在 `scoreWallets()` 返回值中从 `WalletCandidate` 携带这些原始值
- 在 `orchestrator.ts` 的 `dbEntries` 映射中传递 `winRate`、`pnl`、`tradeCount`

**Test scenarios:**
- Happy path: scoreWallets 返回的 ScoredWallet 包含原始 pnl/winRate/tradeCount
- Happy path: grace period 钱包保留之前的 pnl/winRate/tradeCount
- Edge case: 候选钱包 pnl=0, winRate=0 时也应正确传递

**Verification:**
- scoring.test.ts 验证字段被保留
- orchestrator.test.ts 验证 dbEntries 包含指标字段

- [ ] **Unit 2: 修复 persistAlert 的 tokenSymbol 来源**

**Goal:** Alert 存储时优先使用 enrichment 获取的 tokenSymbol

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `apps/backend/src/persistence/alerts.ts`
- Test: `apps/backend/test/pipeline.test.ts`

**Approach:**
- 将 `tokenSymbol: input.swap.tokenSymbol ?? null` 改为 `tokenSymbol: input.swap.tokenSymbol ?? input.enrichment.tokenSymbol ?? null`

**Test scenarios:**
- Happy path: swap 有 symbol 时直接使用
- Happy path: swap 无 symbol、enrichment 有 symbol 时使用 enrichment 的
- Edge case: 两者都为 null 时存 null

**Verification:**
- 测试验证 enrichment.tokenSymbol 被正确使用

## System-Wide Impact

- **API surface parity:** `/api/v1/wallets` 返回的 walletRow 自动包含新填充的字段，前端无需修改
- **Telegram alerts:** 格式化器已经使用 `swap.tokenSymbol ?? enrichment.tokenSymbol`，不受影响
- **SSE alerts:** alertBus 事件已使用合并后的 tokenSymbol，不受影响
- **Unchanged invariants:** compositeScore 计算逻辑不变，评分排名不变

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| ScoredWallet 扩展影响 JSON 持久化大小 | 增加 ~30 bytes/wallet，30 钱包 < 1KB，可忽略 |
| grace period 钱包的指标可能过时 | 可接受，grace period 最多 2 cycles，指标仍有参考价值 |

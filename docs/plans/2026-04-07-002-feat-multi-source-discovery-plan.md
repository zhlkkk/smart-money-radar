---
title: "feat: Multi-source wallet discovery with Helius reverse discovery"
type: feat
status: active
date: 2026-04-07
origin: docs/brainstorms/2026-04-07-multi-source-discovery-requirements.md
deepened: 2026-04-07
---

# feat: Multi-source wallet discovery with Helius reverse discovery

## Overview

将发现管线从单一 Birdeye 数据源扩展为多来源架构，新增 Helius 反向发现（从 webhook 交易中提取 swap 对手方），并在评分中引入来源加分机制。多来源交叉验证的钱包获得更高评分。

## Problem Frame

当前发现管线只有 Birdeye 一个数据源，覆盖面有限且无法通过交叉验证提升可信度。Helius webhook 已经在接收大量 swap 交易数据，但这些数据只用于告警推送，未被利用于钱包发现。(see origin: docs/brainstorms/2026-04-07-multi-source-discovery-requirements.md)

## Requirements Trace

- R1. WalletCandidate 引入 `sources: SourceTag[]` 字段
- R2. 来源权重定义为命名常量
- R3. 多来源加分公式：`baseScore × (1 + sourceBonus × SOURCE_BONUS_WEIGHT)`
- R4. Helius 反向发现：从 swap 交易 inner instructions 提取对手方
- R5. 频率阈值：7 天内与 ≥3 个已监控钱包有 swap 交互
- R6. helius-reverse 默认权重 0.5（Birdeye 0.7）
- R7. 增量计数器 + 滑动窗口，接受重启丢失
- R8. scoreWallets() 叠加来源加分
- R9. pinned 钱包 sources 为空数组，加分为 0
- R10. provider 数组模式，添加新来源只需加函数

## Scope Boundaries

- 不实现链上分析平台和社区 KOL 来源
- 不实现回测反馈循环的动态权重更新（Step 2）
- 不改变 DISCOVERY_WALLET_CAP（30）
- 不引入新付费 API
- 前置依赖：2026-04-03 候选池扩充（Birdeye top_traders）需先完成

## Context & Research

### Relevant Code and Patterns

- `packages/shared/src/types/domain.ts:82-88` — `WalletCandidate` 类型定义，需扩展 `sources` 字段
- `apps/backend/src/discovery/scoring.ts:1-13` — `ScoredWallet` 接口 + `scoreWallets()` 函数
- `apps/backend/src/discovery/scoring.ts:141` — label 硬编码为 `Birdeye #${rank}`，多源下需改为动态标签
- `apps/backend/src/discovery/orchestrator.ts:62-95` — `runCycle()` 硬编码 Birdeye 调用 + candidateMap 去重
- `apps/backend/src/discovery/birdeye.ts` — 三个 fetch 函数（fetchTopWallets, fetchHotTokensByVolume, fetchTokenTopTraders）
- `apps/backend/src/webhook/parse.ts` — `parseSwap()` 双路径解析：`events.swap`（Jupiter/Raydium/Orca）+ `tokenTransfers` fallback
- `apps/backend/src/types.ts:61-76` — `HeliusEnhancedTransaction`，含 `events.swap.tokenInputs/tokenOutputs[].userAccount` 和 `tokenTransfers[].fromUserAccount/toUserAccount`
- `apps/backend/src/discovery/rate-limiter.ts` — token bucket RateLimiter，可复用
- `apps/backend/src/discovery/persistence.ts` — 原子写入 DiscoveryState JSON

### Institutional Learnings

- **全链路追踪**（`docs/solutions/best-practices/parallel-subagent-integration-testing-contract-2026-04-03.md`）：修改共享类型时需从定义处追踪到 persistence、scoring、orchestrator、pipeline 全部消费点。三类断路：类型断路、数据断路、调用断路
- **parseSwap 双路径**（`docs/solutions/runtime-errors/parseswap-helius-payload-mismatch-2026-03-31.md`）：永远不要假设 `events.swap` 存在，必须走 tokenTransfers fallback
- **原子交换模式**（`docs/solutions/best-practices/auto-wallet-discovery-architecture-2026-03-31.md`）：`walletStateRef.current = newSnapshot` 一次性交换，不能分源逐步更新
- **Grace period**：仅质量来源（有真实指标的来源如 Birdeye）推荐才阻止 missedCycles 计数，纯行为来源（helius-reverse）不阻止

## Key Technical Decisions

- **反向发现候选的基础分处理**：反向发现候选缺少 PnL/WinRate 数据。百分位排名是相对的，raw value 0.5 不保证中间排名。解决方案：在 `scoreWallets()` 中，先将仅有 helius-reverse 来源的候选排除出 `normalizeMetric()` 输入（使 Birdeye 候选的百分位排名不受干扰），然后为这些候选的 pnl/winRate/tradeCount/recency 四个维度直接赋予归一化后的固定值 0.5。这确保反向候选在每个维度上处于中间位置，同时不污染其他候选的排名。(see origin: R8 deferred question)
- **滑动窗口数据结构**：使用 `Map<counterpartyAddress, { monitoredWallets: Set<string>, lastSeen: number }>`。7 天窗口内预估 ~1000 个对手方地址，每条 ~200 bytes，总内存 ~200KB，远低于需要 LRU 的阈值。在 discovery cycle 时批量清理过期条目。(see origin: R5 deferred question)
- **SOURCE_BONUS_WEIGHT 初始值**：设为 0.2。来源加分仅在 2+ 来源时触发，单来源候选评分不变。被两个来源发现的钱包比单一来源高 ~20%（1.0/1.2 × 0.2 ≈ 0.167），这是一个有意义的信号。(see origin: R3 deferred question)
- **Swap 对手方提取策略**：优先从 `events.swap.tokenInputs/tokenOutputs[].userAccount` 提取，fallback 到 `tokenTransfers[].fromUserAccount/toUserAccount`。三层过滤：(1) 已监控地址 + 系统地址；(2) 已知 DEX 程序地址；(3) 高频地址过滤（出现 >100 次的地址视为 AMM 池 PDA 自动排除）。注意：DEX swap 中 userAccount 可能是 AMM 池的 authority 而非真正交易者，高频过滤是防止误判的关键防线。(see origin: R4 deferred question)
- **Grace period 规则**：仅有质量来源（Birdeye，即带有真实 PnL/WinRate 数据的来源）推荐才视为"未 miss"。helius-reverse 这种纯行为信号来源不阻止 missedCycles 计数。这防止了活跃但表现差的钱包通过持续交易永远占据 cap 位置
- **Label 动态化**：从 `Birdeye #${rank}` 改为 `${primarySource} #${rank}`，primarySource 取权重最高的来源名称

## Open Questions

### Resolved During Planning

- **滑动窗口数据结构**：Map + Set，无需 LRU（见 Key Technical Decisions）
- **SOURCE_BONUS_WEIGHT 初始值**：0.2（见 Key Technical Decisions）
- **Swap 对手方提取**：events.swap + tokenTransfers 双路径（见 Key Technical Decisions）
- **反向发现候选基础分**：缺失指标赋中位数 0.5（见 Key Technical Decisions）
- **Grace period 多源规则**：仅质量来源推荐才阻止 missedCycles，纯行为来源不阻止

### Deferred to Implementation

- Helius Enhanced Transaction 中需排除的 DEX 程序地址（注意：与 parse.ts 的 BASE_TOKEN_MINTS 是不同的集合。DEX 程序地址从 `tx.source` 字段推导，如 'JUPITER'、'RAYDIUM'，或创建 KNOWN_DEX_PROGRAMS 常量）
- SOURCE_BONUS_WEIGHT 的最优值需在实际运行数据中验证，0.2 是初始值

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```mermaid
graph TB
    subgraph "Provider 层"
        BP[Birdeye Provider<br/>gainers + top_traders]
        HP[Helius Reverse Provider<br/>counterparty tracker]
    end

    subgraph "Orchestrator runCycle()"
        PA[并行调用 providers<br/>Promise.allSettled]
        MERGE[合并去重<br/>candidateMap + sources 聚合]
        SCORE[scoreWallets()<br/>基础分 + 来源加分]
        DIFF[Diff + Grace Period]
        UPDATE[Webhook 更新 + 持久化]
    end

    subgraph "Webhook Handler"
        WH[handleWebhook()]
        CT[CounterpartyTracker<br/>增量更新滑动窗口]
    end

    BP --> PA
    HP --> PA
    PA --> MERGE
    MERGE --> SCORE
    SCORE --> DIFF
    DIFF --> UPDATE

    WH -->|每次 swap 事件| CT
    CT -->|discovery cycle 时| HP
```

## Implementation Units

- [ ] **Unit 1: SourceTag 类型 + WalletCandidate 扩展**

**Goal:** 在共享类型中引入 SourceTag 和 sources 字段，为多来源架构提供类型基础

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `packages/shared/src/types/domain.ts`
- Modify: `apps/backend/src/discovery/scoring.ts` (ScoredWallet 类型)
- Test: `apps/backend/test/discovery/scoring.test.ts` (类型兼容性)

**Approach:**
- 在 `domain.ts` 中定义 `SourceTag` 接口（source, weight, discoveredAt）
- `WalletCandidate` 增加 `sources?: SourceTag[]`（可选，保持后向兼容）
- `ScoredWallet` 增加 `sources: SourceTag[]`（必选，scoring 时填充）
- 在 `scoring.ts` 顶部定义 `SOURCE_WEIGHTS` 命名常量和 `SOURCE_BONUS_WEIGHT = 0.2`
- `ScoredWallet.source` 字段保留（'pinned' | 'discovered'），与新的 `sources` 并存，避免破坏下游消费者

**Patterns to follow:**
- `packages/shared/src/types/domain.ts` 现有的 `ParsedSwap`、`EnrichedTrade` 接口风格

**Test scenarios:**
- Happy path: WalletCandidate 带 sources 字段通过类型检查
- Happy path: WalletCandidate 不带 sources 字段（undefined）也通过类型检查（后向兼容）
- Edge case: sources 为空数组时不导致下游错误

**Verification:**
- `pnpm --filter backend typecheck` 和 `pnpm --filter shared typecheck` 均通过
- 现有所有测试不受影响

---

- [ ] **Unit 2: CounterpartyTracker — Helius 反向发现核心模块**

**Goal:** 实现从 swap 交易中提取对手方地址的滑动窗口计数器

**Requirements:** R4, R5, R7

**Dependencies:** Unit 1

**Files:**
- Create: `apps/backend/src/discovery/counterparty-tracker.ts`
- Test: `apps/backend/test/discovery/counterparty-tracker.test.ts`

**Approach:**
- 导出 `createCounterpartyTracker(config)` 闭包工厂函数，返回 `{ recordSwap, getCandidates, getStats }`
- `recordSwap(tx: HeliusEnhancedTransaction, monitoredAddresses: Set<string>)`: 从 events.swap + tokenTransfers 双路径提取对手方，更新 Map 计数器
- 对手方提取逻辑：收集 tokenInputs/tokenOutputs 的 userAccount + tokenTransfers 的 from/toUserAccount，三层过滤：(1) 排除 monitoredAddresses、已知系统地址（System Program, Token Program）；(2) 排除已知 DEX 程序地址；(3) **高频地址过滤**：维护每个地址的全局出现计数，超过阈值（如 >100 笔交易）的地址大概率是 AMM 池/流动性池 PDA，自动排除。这防止 DEX 聚合器的路由账户被误判为聪明钱
- `getCandidates(threshold: number)`: 返回达标的对手方列表（与 ≥threshold 个不同监控钱包有交互），转换为 `WalletCandidate[]` 格式
- 反向发现候选的 pnl/winRate/tradeCount 设为 NaN（标记为缺失数据，非真实值）。scoreWallets() 根据 NaN 标记跳过 normalizeMetric 并赋予 0.5 归一化值。lastActiveTimestamp 使用滑动窗口中的 lastSeen 时间戳
- 滑动窗口清理：getCandidates 调用时批量清除 lastSeen > 7 天的条目
- config 含 windowMs（默认 7 天）、minOverlap（默认 3）

**Patterns to follow:**
- `apps/backend/src/webhook/parse.ts` 的双路径 swap 解析和系统地址过滤
- `apps/backend/src/discovery/orchestrator.ts` 的闭包工厂模式（createDiscovery）

**Test scenarios:**
- Happy path: 3 笔来自不同监控钱包的 swap 中出现同一对手方 → getCandidates 返回该对手方
- Happy path: recordSwap 从 events.swap 路径正确提取 userAccount
- Happy path: recordSwap 从 tokenTransfers fallback 路径正确提取（events.swap 缺失时）
- Edge case: 对手方只与 2 个监控钱包交互（< threshold 3）→ 不输出
- Edge case: 对手方与同一个监控钱包交互 3 次 → 不输出（要求 ≥3 个不同的钱包）
- Edge case: 已监控地址不被记录为对手方
- Edge case: 已知 DEX 程序地址被过滤
- Edge case: 高频地址（出现 >100 次）被自动排除（AMM 池地址防护）
- Edge case: 超过 7 天窗口的条目在 getCandidates 时被清理
- Error path: tx 缺少 events.swap 和 tokenTransfers → 不记录，无异常
- Integration: 连续 recordSwap 多笔交易后 getCandidates 返回正确的聚合结果

**Verification:**
- 全部测试通过
- 使用真实 Helius payload fixture（Jupiter 有 events.swap + Pump.fun 无 events.swap）验证双路径

---

- [ ] **Unit 3: scoreWallets() 来源加分改造**

**Goal:** 在现有评分逻辑基础上叠加多来源加分机制

**Requirements:** R3, R8, R9

**Dependencies:** Unit 1

**Files:**
- Modify: `apps/backend/src/discovery/scoring.ts`
- Modify: `apps/backend/test/discovery/scoring.test.ts`

**Approach:**
- 在 `scoreWallets()` 中，计算 baseScore 后，查看候选的 sources 字段
- 来源加分仅在候选被 2+ 个来源发现时触发（单来源 sourceBonus = 0，评分与改造前一致）
- 多来源时：`sourceBonus = sum(来源权重) / MAX_POSSIBLE_SUM`，其中 `MAX_POSSIBLE_SUM` 从 `SOURCE_WEIGHTS` 动态计算（`Object.values(SOURCE_WEIGHTS).reduce((a, b) => a + b, 0)`），当前为 1.2
- `finalScore = baseScore × (1 + sourceBonus × SOURCE_BONUS_WEIGHT)`（单来源时 finalScore = baseScore）
- 对仅有 helius-reverse 来源的候选：先将其排除出 normalizeMetric() 输入，对 Birdeye 候选独立排名后，为 helius-reverse 候选的四维归一化值直接设为 0.5（确保中间排名且不干扰其他候选排名）
- pinned 钱包不经过此逻辑（sources 为空数组，bonus = 0）
- Label 从 `Birdeye #${rank}` 改为 `${primarySource} #${rank}`，primarySource = 权重最高的来源名称
- Grace period 多来源规则不在此处实现（移至 Unit 4，orchestrator 层面处理）

**Patterns to follow:**
- `scoring.ts` 现有的 `normalizeMetric` 百分位排名模式
- 权重常量定义在文件顶部（与 WEIGHTS 对象并列）

**Test scenarios:**
- Happy path: 单来源（birdeye）候选评分与改造前完全一致（单来源 sourceBonus = 0，无加分）
- Happy path: 双来源（birdeye + helius-reverse）候选比单来源候选评分更高
- Happy path: pinned 钱包 sources 为空 → bonus = 0，评分不变
- Edge case: candidates 为空数组 → 返回空，无异常
- Edge case: sources 为 undefined（后向兼容旧数据）→ 视为空数组，bonus = 0
- Edge case: 仅有 helius-reverse 来源的候选 → 排除出 normalizeMetric 输入，四维归一化值 = 0.5 → 排名处于中间位置
- Happy path: Label 正确反映主要来源名称（现有 'Birdeye #N' 断言需更新为新格式）

**Verification:**
- `pnpm --filter backend test -- scoring` 全部通过
- 现有评分测试在不传 sources 时保持一致行为

---

- [ ] **Unit 4: Orchestrator provider 数组重构**

**Goal:** 将 orchestrator 从硬编码 Birdeye 调用改为可扩展的 provider 数组模式

**Requirements:** R10, R1（合并去重 + 来源标记）

**Dependencies:** Unit 1, Unit 2, Unit 3

**Files:**
- Modify: `apps/backend/src/discovery/orchestrator.ts`
- Modify: `apps/backend/src/discovery/persistence.ts` (loadDiscoveryState 中对旧数据 sources 规范化)
- Modify: `apps/backend/test/discovery/orchestrator.test.ts`

**Approach:**
- 定义 provider 类型：`type DiscoveryProvider = { name: string; source: string; fetch: () => Promise<WalletCandidate[]> }`
- 在 `createDiscovery()` 中构建 provider 数组：birdeyeProvider（包装现有 Birdeye 调用）+ heliusReverseProvider（包装 CounterpartyTracker.getCandidates）
- `runCycle()` 改为 `Promise.allSettled(providers.map(p => p.fetch()))` 并行调用
- 每个 provider 返回的 WalletCandidate 已带 sources 字段（provider 自行打标，orchestrator 不负责标记）
- 合并去重策略改造：同地址出现在多个 provider 时，**保留指标最完整的记录作为基础**（有真实 PnL 的 Birdeye 优先于占位值的 Helius），同时**聚合所有来源的 SourceTag 到 sources 数组**
- Grace period 多来源规则在此实现：仅质量来源（Birdeye，带真实 PnL/WinRate）推荐才视为"未 miss"。helius-reverse 等纯行为来源的推荐不阻止 missedCycles 计数，防止活跃但表现差的钱包永占 cap 位置
- 持久化反序列化旧数据时处理 `sources ?? []`（旧 DiscoveryState 文件不含 sources 字段）
- 保持现有的 diff 对比、mergeWithPinned、webhook 更新、持久化流程不变
- 保持 `walletStateRef.current` 原子交换模式

**Patterns to follow:**
- 现有 `runCycle()` 中的 `Promise.allSettled` + candidateMap 去重模式
- `createDiscovery` 闭包工厂模式，provider 数组作为闭包内部状态

**Test scenarios:**
- Happy path: 两个 provider 返回结果 → 正确合并去重 + sources 聚合
- Happy path: 同一钱包被两个 provider 发现 → sources 包含两个 SourceTag
- Happy path: 单一 provider 返回结果 → 正常工作（与当前行为一致）
- Error path: 一个 provider 失败 → 另一个 provider 结果仍然参与评分（Promise.allSettled）
- Error path: 所有 provider 失败 → 候选池为空，不更新 webhook（现有回滚逻辑）
- Edge case: provider 返回重复地址 → 去重合并
- Integration: 完整 runCycle 流程：provider 调用 → 合并 → 评分 → diff → webhook 更新 → 持久化

**Verification:**
- `pnpm --filter backend test -- orchestrator` 全部通过
- 现有 orchestrator 测试在 provider 数组模式下保持一致行为

---

- [ ] **Unit 5: Webhook handler 集成 CounterpartyTracker**

**Goal:** 在 webhook 事件处理时增量更新反向发现计数器

**Requirements:** R7

**Dependencies:** Unit 2, Unit 4

**Files:**
- Modify: `apps/backend/src/server.ts` (或 processTransaction 闭包组装处)
- Modify: `apps/backend/test/webhook/handler.test.ts` (集成测试)

**Approach:**
- 不直接修改 handler.ts（保持 "handler 只做鉴权 + 分发" 的职责）
- CounterpartyTracker 在 `createDiscovery()` 内部创建，通过返回值暴露 `recordSwap` 方法（如 `discovery.recordSwap`）
- 在 index.ts 中，构建 processTransaction 闭包时包装：先调用 `discovery.recordSwap(tx, monitoredAddresses)`，再调用原有 pipeline.processTransaction(tx)
- 当 discovery 未创建时（缺少 env var），不注入 recordSwap，避免空消耗
- recordSwap 调用是 fire-and-forget，用 try-catch 包裹，异常不影响后续管线
- 获取 monitoredAddresses 从 `walletStateRef.current.watchedAddresses`

**Patterns to follow:**
- `apps/backend/src/webhook/handler.ts` 的 `WebhookHandlerConfig.processTransaction` 回调模式
- fire-and-forget 模式（不影响 webhook 响应延迟）

**Test scenarios:**
- Happy path: swap 交易触发 counterpartyTracker.recordSwap 调用
- Happy path: 非 swap 交易不触发 recordSwap
- Error path: recordSwap 抛出异常 → 不影响后续管线和 webhook 响应（try-catch 静默处理）
- Integration: webhook → processTransaction → recordSwap → 后续 discovery cycle getCandidates 返回达标候选

**Verification:**
- `pnpm --filter backend test -- handler` 全部通过
- webhook 处理延迟不受影响

---

- [ ] **Unit 6: 端到端集成测试**

**Goal:** 验证多来源发现的完整链路：webhook 记录 → 反向发现 → 评分 → 合并 → 更新

**Requirements:** 全部 success criteria

**Dependencies:** Unit 1-5

**Files:**
- Create: `apps/backend/test/discovery/multi-source-integration.test.ts`

**Approach:**
- 模拟完整流程：
  1. 创建 CounterpartyTracker，模拟 N 笔 swap 交易（同一对手方出现在 ≥3 个监控钱包的交易中）
  2. 调用 getCandidates 确认对手方被输出为候选
  3. 同时模拟 Birdeye provider 返回重叠的候选（含同一地址）
  4. 调用 scoreWallets 验证来源加分正确应用
  5. 验证合并后的候选 sources 字段包含正确的来源标记
- 使用真实 Helius payload fixture（Jupiter + Pump.fun 两种）
- 验证 pinned 钱包不受影响

**Patterns to follow:**
- `apps/backend/test/discovery/orchestrator.test.ts` 的 mock 模式和 helper 工厂函数
- 真实 fixture 来自 `docs/solutions/runtime-errors/parseswap-helius-payload-mismatch-2026-03-31.md` 提到的两种 fixture

**Test scenarios:**
- Integration: Helius 反向发现候选 → 评分 → 被 Birdeye 候选同时发现 → sources 正确聚合 → 评分包含来源加分
- Integration: 仅被反向发现的候选 → 中位数默认指标 → 较低但合理的评分
- Integration: pinned 钱包 → sources 为空 → 评分与改造前一致
- Integration: provider 部分失败 → 可用 provider 结果仍然正确参与流程

**Verification:**
- 全部集成测试通过
- `pnpm --filter backend test` 全部通过（包括现有测试回归）

## System-Wide Impact

- **Interaction graph:** webhook handler → CounterpartyTracker（新增调用）。orchestrator → providers 数组（替代硬编码 Birdeye 调用）。scoreWallets → 来源加分（新逻辑）。persistence/DB sync → ScoredWallet 新字段需透传
- **Error propagation:** provider 失败通过 Promise.allSettled 隔离。CounterpartyTracker 异常在 webhook handler 中 try-catch 静默处理。评分层面 sources 为 undefined/空时降级为无加分
- **State lifecycle risks:** CounterpartyTracker 内存状态在进程重启时丢失（设计决策：接受丢失，6 小时后恢复）。walletStateRef 原子交换模式不变
- **API surface parity:** persistence.ts 的 DiscoveryState 序列化需包含新的 sources 字段。DB sync（trackedWallets 表）可能需要新增来源相关列（deferred to implementation，Step 1 可暂不持久化 sources 到 DB）
- **Integration coverage:** Unit 6 覆盖跨模块链路
- **Unchanged invariants:** DISCOVERY_WALLET_CAP（30）不变。webhook 签名验证不变。Telegram 告警格式不变。enrichment 管线不变。walletStateRef 原子交换模式不变

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 反向发现候选因缺少指标数据在评分中长期垫底 | 缺失指标赋中位数 0.5 + SOURCE_BONUS_WEIGHT 提供额外加分。实际运行后观察评分分布，必要时调整 |
| WalletCandidate 类型变更导致下游断路 | sources 字段设为可选（?:），现有消费者无需改动。Unit 6 集成测试覆盖全链路 |
| Helius payload 中对手方提取逻辑遗漏非标准 DEX | 双路径解析（events.swap + tokenTransfers fallback）覆盖绝大多数场景。遗漏的非标 DEX 只影响覆盖面，不影响正确性 |
| 内存中 CounterpartyTracker 数据量过大 | 7 天窗口 + 定期清理。预估 ~1000 条目 ~200KB。如超预期可降低窗口或加 LRU |
| 前置依赖（2026-04-03 候选池扩充）未完成 | Unit 4 的 provider 数组模式可独立实现，Birdeye provider 包装现有调用即可 |
| 频繁部署导致 CounterpartyTracker 7 天窗口无法积累 | Railway 每次部署重启进程。如果部署周期 < 7 天，反向发现功能不可用。可接受：开发活跃期反向发现暂停，稳定后恢复。如需改善可在后续将 tracker 状态纳入 persistence.ts 持久化 |
| AMM 池/流动性池 PDA 被误判为聪明钱候选 | 三层过滤：系统地址 + DEX 程序 + 高频地址（>100 笔）。高频过滤是主要防线，可有效排除池子地址 |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-07-multi-source-discovery-requirements.md](docs/brainstorms/2026-04-07-multi-source-discovery-requirements.md)
- Related code: `apps/backend/src/discovery/` (orchestrator, scoring, birdeye, persistence)
- Related code: `apps/backend/src/webhook/parse.ts` (swap 解析双路径)
- Related learnings: `docs/solutions/best-practices/parallel-subagent-integration-testing-contract-2026-04-03.md` (全链路断路检查)
- Related learnings: `docs/solutions/runtime-errors/parseswap-helius-payload-mismatch-2026-03-31.md` (Helius payload 双路径)
- Related learnings: `docs/solutions/best-practices/auto-wallet-discovery-architecture-2026-03-31.md` (原子交换 + grace period)

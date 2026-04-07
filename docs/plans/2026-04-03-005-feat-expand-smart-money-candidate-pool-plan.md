---
title: "feat: Expand smart money candidate pool via multi-token top_traders aggregation"
type: feat
status: completed
date: 2026-04-03
origin: docs/brainstorms/2026-04-03-expand-smart-money-candidate-pool-requirements.md
---

# feat: Expand Smart Money Candidate Pool

## Overview

当前 `Birdeye /trader/gainers-losers?limit=10` 每次最多返回 10 个候选，
导致回测每组只有 3 个钱包、`scoreWallets()` 可用的候选质量上限极低。

本计划通过新增 Birdeye `/defi/v2/tokens/top_traders` 多 token 聚合来扩充候选池：
对每个高交易量热门 token 查询 top 交易者（limit=50），合并去重后送入现有评分管线。
理论候选上限：20 个热门 token × 50 = 1000（去重后 100–400），回测每组可达 ≥15 个钱包。

## Problem Frame

见 origin 文档。核心约束：
- `gainers-losers` 端点硬限 10 个候选（API 规格，非套餐限制）
- `scoreWallets()` 和 `walletCap=30` 不变
- Birdeye Starter 套餐内解决，不引入新付费依赖

**需求文档偏差（研究发现）：**
需求文档 R3 指定通过 DexScreener 动态获取热门 token。研究发现 DexScreener 公开 API
仅提供付费推广（Boost）列表，不反映有机交易量，会污染候选质量。
**本计划改用 Birdeye `/defi/token_trending?sort_by=volume24hUSD`**，该端点
Starter 套餐可用，返回按真实 24h 交易量排序的 Solana token 列表。

## Requirements Trace

- R1. 每次发现周期内调用 top_traders 获取多个热门 token 的交易者，与 gainers-losers 合并 ✓ Unit 2, 3
- R2. 所有候选去重后送入现有 `scoreWallets()`，不修改评分逻辑和 walletCap ✓ Unit 3
- R3. 动态获取热门 token（**改为 Birdeye token_trending**，非 DexScreener）✓ Unit 1
- R4. 动态获取失败时回落硬编码备用 token 列表，发现周期不中断 ✓ Unit 1
- R5. discovery 管线内新增专用 Birdeye rate limiter，与 backtest rate limiter 隔离 ✓ Unit 3
- R6. 单次 token 调用失败不终止整体周期（Promise.allSettled），备用列表仅在全量失败时触发 ✓ Unit 2, 3
- R7. MIN_CANDIDATES_FAIL 升至 20，MIN_CANDIDATES_WARN 升至 50 ✓ Unit 4

## Scope Boundaries

- `scoreWallets()` 签名和权重不变
- `DISCOVERY_WALLET_CAP=30` 不变（env 配置，无代码改动）
- `gained-losers` 调用继续保留
- 不引入 Dune Analytics、DexScreener trending 或链上自发现
- 不修改 backtest rate limiter 实例

## Context & Research

### Relevant Code and Patterns

- `apps/backend/src/discovery/birdeye.ts`：`fetchTopWallets()`、`normalizeTraderItem()`、`BirdeyeTraderItem`（snake_case）
- `apps/backend/src/discovery/orchestrator.ts`：`runCycle()` 在第 54 行直接调用 `fetchTopWallets()`，**无 rate limiter**
- `apps/backend/src/discovery/scoring.ts`：`scoreWallets(candidates, pinnedAddresses, currentDiscovered, walletCap)`，输入 `WalletCandidate[]`
- `apps/backend/src/discovery/rate-limiter.ts`：`createRateLimiter(maxPerMinute)`，`acquire()` 内置 queue
- `apps/backend/src/enrichment/enrich.ts`：多源 `Promise.allSettled` 聚合模式（直接复用）
- `apps/backend/src/scripts/backtest/cli.ts`：`MIN_CANDIDATES_FAIL=10`、`MIN_CANDIDATES_WARN=20`
- `apps/backend/src/scripts/backtest/runner.ts`：`MIN_CANDIDATES_WARN * 0.6` 阈值

### 字段映射关键差异

| 字段 | gainers-losers | top_traders（实际 API） |
|------|---------------|----------------------|
| 地址 | `address` / `wallet` | `address` ✓ |
| PnL | `pnl`（number） | `pnl`（**string**，需 parseFloat） |
| 胜率 | `win_rate` / `wins+losses` | `winRate`（camelCase，0~1 float） |
| 交易数 | `trade_count` / `total_trades` | `tradeCount`（camelCase） |
| 最后活跃 | `last_active_timestamp` / `last_trade_time` | **不存在**，默认 0 |

`lastActiveTimestamp=0` 的后果：`scoreWallets()` 中 recency 权重（15%）对这批候选失效。
由于同批候选 `lastActiveTimestamp` 全为 0，`normalizeMetric()` 对全零数组返回全零，
该维度权重实际归零。85% 权重（PnL+winRate+tradeCount）仍有效，可接受。

### Institutional Learnings

- `normalizeTraderItem()` 已有 snake_case/camelCase 双映射模式（`pnl ?? realized_pnl` 等），
  新 normalizer 延续该防御性写法

### External References

- Birdeye `/defi/v2/tokens/top_traders`：query param `address`（token mint）、`limit`（≤50）、
  `sort_by=pnl|winRate`；响应 `data.items[].{address, pnl, winRate, tradeCount}`
- Birdeye `/defi/token_trending`：query param `sort_by=volume24hUSD`、`limit`（≤20，需两次调用取 40）；
  响应 `data.tokens[].address`
- DexScreener boost 端点（`/token-boosts/top/v1` 等）反映付费推广而非有机交易量，不适用

## Key Technical Decisions

- **热门 token 来源改为 Birdeye token_trending**：DexScreener 公开端点只有 Boost（付费排名），
  不反映真实交易量，会引入高噪音候选。Birdeye token_trending 按 24h 实际成交量排序，
  且 Starter 套餐已包含，无额外成本。

- **新建独立 BirdeyeTopTraderItem 接口**：top_traders 响应是 camelCase，pnl 为 string，
  与现有 `BirdeyeTraderItem`（snake_case）不兼容。共用接口会使字段访问模糊，新建更清晰。
  新 `normalizeTopTraderItem()` 函数复用 `makeHeaders()`、`checkAuthError()`、`checkRateLimit()`。

- **去重在 orchestrator 层执行**：`birdeye.ts` 各函数只负责单端点调用，
  orchestrator 负责合并多源结果后 `Set<string>` 去重，然后传入 `scoreWallets()`。
  这与现有职责分离一致（orchestrator 是协调层）。

- **rate limiter 在 `createDiscovery()` 内部实例化**：discovery 自己管理生命周期，
  不从外部传入。`createRateLimiter(30)` 放在 `createDiscovery()` 闭包内，
  与 backtest runner 的实例完全隔离。

- **Promise.allSettled + 并发调用**：所有 top_traders 调用以 `Promise.allSettled` 并发触发，
  rate limiter 内置 queue 保证不超速，单个 token 失败不影响其他结果（满足 R6）。

- **热门 token limit=20 × 2 次调用 = 40 个 token**：每个 token 取 top 50 traders，
  理论最大候选：40×50+10（gainers-losers）= 2010，去重后预计 100–400。

## Open Questions

### Resolved During Planning

- **DexScreener vs Birdeye for hot tokens**：DexScreener 无有机交易量端点，改用 Birdeye
  token_trending。需求文档 R3 对应实现调整，不影响其他需求。

- **top_traders 缺少 lastActiveTimestamp**：scoreWallets() 用 `normalizeMetric()` 对全零数组
  自动输出全零，该维度在全为 top_traders 候选时自然退化。混合 gainers-losers
  候选时，gainers-losers 的候选在 recency 维度会得分更高（合理）。

- **pnl 字段类型为 string**：新 normalizer 用 `parseFloat(item.pnl ?? '0')` 处理。

### Deferred to Implementation

- **Birdeye token_trending 实际返回字段名**：研究基于文档，实现时需用真实 API 调用确认
  `data.tokens[].address` 是正确的 mint 地址字段，必要时调整映射。

- **备用 token 列表的完整 mint 地址**：实现时从链上/文档收集 10–15 个长期高流动性
  Solana token 的 mint 地址（SOL wrapped、BONK、WIF、JUP、USDC 等）。

## High-Level Technical Design

> *以下展示各函数的调用关系和数据流，是方向性设计，不是实现规格。*

```
runCycle() [orchestrator.ts]
  │
  ├─── fetchTopWallets()             → WalletCandidate[] (≤10, 现有)
  │
  ├─── fetchHotTokensByVolume()      → string[] mint addresses (新增)
  │      ├─ /defi/token_trending × 2 (取 40 个)
  │      └─ 失败 → FALLBACK_TOKENS[]
  │
  ├─── Promise.allSettled(
  │      hotTokens.map(mint =>
  │        fetchTokenTopTraders(mint, rateLimiter)  → WalletCandidate[]
  │      )
  │    ) → filter fulfilled → flatMap
  │
  ├─── deduplicate(
  │      [...gaineserLosers, ...topTraders]
  │    ) → Set<address>, address→highest-pnl candidate
  │
  └─── scoreWallets(merged, pinnedAddresses, currentDiscovered, walletCap)
         → ScoredWallet[] (≤30, 现有流程不变)
```

## Implementation Units

```mermaid
TB
  U1[Unit 1: fetchHotTokensByVolume] --> U3[Unit 3: orchestrator 多源聚合]
  U2[Unit 2: fetchTokenTopTraders] --> U3
  U3 --> U5[Unit 5: 测试覆盖]
  U4[Unit 4: 阈值常量更新] --> U5
```

---

- [x] **Unit 1: 新增 `fetchHotTokensByVolume()` 到 birdeye.ts**

**Goal:** 通过 Birdeye token_trending 获取当前高交易量 Solana token 列表，失败时回落硬编码备用

**Requirements:** R3, R4

**Dependencies:** 无

**Files:**
- Modify: `apps/backend/src/discovery/birdeye.ts`
- Test: `apps/backend/test/discovery/birdeye.test.ts`

**Approach:**
- 两次调用 `/defi/token_trending?sort_by=volume24hUSD&limit=20&offset=0` 和 `&offset=20`，
  合并取 40 个 token 的 mint 地址
- 单次调用失败时回落到内置 `FALLBACK_TOKENS` 常量（10–15 个知名高流动性 token 的 mint 地址）
- 函数签名：`fetchHotTokensByVolume(apiKey: string, limit?: number): Promise<string[]>`
- 复用 `makeHeaders()`、`checkAuthError()`、`checkRateLimit()` 模式（见现有 `fetchTopWallets`）

**Patterns to follow:**
- `fetchTopWallets()` 的 try/catch + auth/rate-limit re-throw 结构
- `checkAuthError()`、`checkRateLimit()` helper 调用模式

**Test scenarios:**
- Happy path: API 返回 20 个 token，函数提取 mint 地址数组
- Happy path: 两次分页调用合并，返回最多 40 个不重复 mint 地址
- Edge case: API 返回空数组（`tokens: []`），函数返回 `FALLBACK_TOKENS`
- Error path: fetch 超时 → 捕获错误，回落 `FALLBACK_TOKENS`，不抛出
- Error path: 401/403 → re-throw `authentication failed` 错误（中止发现周期）
- Error path: 429 → re-throw `rate limit` 错误

**Verification:**
- `birdeye.test.ts` 中新增的 6 个测试全部通过
- 函数返回值类型是 `string[]`，元素是合法格式的 Solana mint 地址

---

- [x] **Unit 2: 新增 `fetchTokenTopTraders()` 到 birdeye.ts**

**Goal:** 对单个 token mint 地址查询 top 交易者，使用正确的 camelCase 字段映射

**Requirements:** R1, R6（单函数层面的 try/catch）

**Dependencies:** Unit 1（可并行开发）

**Files:**
- Modify: `apps/backend/src/discovery/birdeye.ts`
- Test: `apps/backend/test/discovery/birdeye.test.ts`

**Approach:**
- 新建 `BirdeyeTopTraderItem` interface，字段使用 camelCase：`{ address?, pnl?, winRate?, tradeCount?, volumeUsd? }`
  （pnl 是 string 类型）
- 新建 `normalizeTopTraderItem()` 函数：`parseFloat(item.pnl ?? '0')`、直接用 `item.winRate ?? 0`、
  `item.tradeCount ?? 0`、`lastActiveTimestamp: 0`（top_traders 无此字段）
- 函数签名：`fetchTokenTopTraders(apiKey: string, tokenAddress: string, rateLimiter: RateLimiter, limit?: number): Promise<WalletCandidate[]>`
- 调用前先 `await rateLimiter.acquire()`
- URL：`/defi/v2/tokens/top_traders?address=<mint>&sort_by=pnl&limit=50`
- auth/rate-limit 错误 re-throw，其他错误 catch 后返回 `[]`（不中止 allSettled 的其他 promise）

**Patterns to follow:**
- `collectViaBirdeye()` 在 `collect.ts` 的 catch 重新抛出 auth/rate-limit 错误的模式
- `normalizeTraderItem()` 的防御性写法结构

**Test scenarios:**
- Happy path: 返回包含 pnl/winRate/tradeCount 的 items，normalizeTopTraderItem 正确将 pnl string 转 number
- Happy path: `lastActiveTimestamp` 在结果中为 0
- Edge case: `items` 为 `[]` → 返回 `[]`
- Edge case: item 的 pnl 字段缺失 → 默认 0
- Error path: HTTP 404/500 → catch，返回 `[]`
- Error path: 401 → re-throw `authentication failed`
- Error path: 429 → re-throw `rate limit`
- Integration: `rateLimiter.acquire()` 在每次调用前被调用

**Verification:**
- `birdeye.test.ts` 中 8 个新测试全部通过
- 返回的 `WalletCandidate[]` 中 `lastActiveTimestamp` 全为 0
- `pnl` 字段是 number 类型（已 parseFloat）

---

- [x] **Unit 3: 修改 orchestrator.ts 接入多源聚合**

**Goal:** runCycle() 合并 gainers-losers + 多 token top_traders 候选，新建内部 rate limiter，Promise.allSettled 处理部分失败

**Requirements:** R1, R2, R5, R6

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `apps/backend/src/discovery/orchestrator.ts`
- Test: `apps/backend/test/discovery/orchestrator.test.ts`

**Approach:**
- 在 `createDiscovery()` 闭包顶部实例化 `const birdeyeRateLimiter = createRateLimiter(30)`
- `runCycle()` 中：
  1. 并行调用 `fetchTopWallets()` 和 `fetchHotTokensByVolume()`（无需 rate limiter，单次调用）
  2. 对每个 hot token，在 `Promise.allSettled` 中调用 `fetchTokenTopTraders(token, birdeyeRateLimiter)`
  3. 过滤 `fulfilled` 的结果，flatMap 得到所有候选
  4. 将 gainers-losers 候选 + top_traders 候选合并，按 address 去重（同地址保留 pnl 较高的那条）
  5. 合并结果传入现有 `scoreWallets()` —— **后续流程无任何改动**
- `fetchHotTokensByVolume` 完全失败时（auth/rate-limit 错误），整体 runCycle 中止（与现有行为一致）
- 普通网络错误下 `fetchHotTokensByVolume` 回落到备用列表（在 Unit 1 内部处理），orchestrator 无需额外处理

**Patterns to follow:**
- `enrich.ts` 中的 `Promise.allSettled` 多源聚合模式（直接参考）
- orchestrator.ts 现有的错误日志格式 `[discovery] Cycle failed`

**Test scenarios:**
- Happy path: gainers-losers 返回 10 个候选，hot tokens 返回 20 个，每个 token top_traders 返回 5 个 → 合并去重后 scoreWallets 收到 ~60–110 个候选
- Happy path: 去重逻辑——同一地址在不同 token 的 top_traders 中出现，只保留一条
- Edge case: hot tokens 返回空数组（完全失败 → 备用列表） → 仍能正常运行
- Error path: 单个 token 的 top_traders 返回失败 → 其他 token 的结果不受影响（Promise.allSettled）
- Error path: fetchHotTokensByVolume auth 错误 → runCycle catch，打印错误，running=false
- Integration: rate limiter 在 hot tokens 循环中被调用（`acquire()` 调用次数 = hot token 数量）

**Verification:**
- orchestrator 测试全部通过（含现有测试 + 新增测试）
- `scoreWallets` 在集成测试中收到 >10 个候选

---

- [x] **Unit 4: 更新回测质量阈值常量**

**Goal:** MIN_CANDIDATES_FAIL 升至 20，MIN_CANDIDATES_WARN 升至 50，使回测质量门控与扩充后的候选池规模匹配

**Requirements:** R7

**Dependencies:** 无（独立改动）

**Files:**
- Modify: `apps/backend/src/scripts/backtest/cli.ts`
- Modify: `apps/backend/src/scripts/backtest/runner.ts`（MIN_CANDIDATES_WARN * 0.6 注释更新）
- Test: `apps/backend/test/scripts/backtest/cli.test.ts`（现有 threshold 测试需更新）

**Approach:**
- `cli.ts`：`MIN_CANDIDATES_FAIL = 20`，`MIN_CANDIDATES_WARN = 50`
- `runner.ts` 注释：更新 "20 → threshold=12" 的注释为 "50 → threshold=30"
- `cli.test.ts`：更新涉及旧阈值的测试（N=10 的测试改为预期 fail，N=19 改为 fail，N=20 改为 warn，N=50 为 normal）
- `seedFromDiscoveryState()` 的 `MIN_CANDIDATES_FAIL/WARN` 也通过 import 自动更新

**Patterns to follow:**
- 现有 `cli.test.ts` 中的 threshold 测试结构

**Test scenarios:**
- N=19 候选 → throw `钱包候选数量不足`（< MIN_CANDIDATES_FAIL=20）
- N=20 候选 → WARNING 并继续（≥ FAIL, < WARN=50）
- N=49 候选 → WARNING 并继续
- N=50 候选 → 正常运行，无 WARNING

**Verification:**
- 所有 backtest CLI 测试通过（含更新后的阈值测试）
- `MIN_CANDIDATES_FAIL` 和 `MIN_CANDIDATES_WARN` 的 JSDoc 注释同步更新

---

- [x] **Unit 5: 完整测试通过 & 类型检查**

**Goal:** 确认所有改动不破坏现有 313 个测试，新增测试覆盖新函数

**Requirements:** 全部

**Dependencies:** Unit 1, 2, 3, 4

**Files:**
- Test: `apps/backend/test/discovery/birdeye.test.ts`
- Test: `apps/backend/test/discovery/orchestrator.test.ts`
- Test: `apps/backend/test/scripts/backtest/cli.test.ts`

**Approach:**
- `pnpm --filter backend test`：所有测试通过
- 检查 `packages/shared/src/types/domain.ts` 中 `WalletCandidate` 无改动

**Test expectation:** 依赖 Unit 1–4 的测试覆盖，本单元仅作验证性运行

**Verification:**
- `pnpm --filter backend test` 输出 `Tests: N passed`（N ≥ 313 + 新增测试数）
- 无 TypeScript 编译错误（backendinternal 文件范围内）

## System-Wide Impact

- **Interaction graph:** `runCycle()` 新增对 `fetchHotTokensByVolume` 和 `fetchTokenTopTraders` 的调用；
  `scoreWallets()` 入参候选数量扩大但签名不变；后续 `updateHeliusWebhookAddresses`、
  `saveDiscoveryState`、`syncTrackedWallets` 流程完全不变

- **Error propagation:** `fetchTokenTopTraders` 的单 token 失败在 `Promise.allSettled` 内部被吸收，
  返回 `[]`；`fetchHotTokensByVolume` 的网络错误在函数内部回落备用列表；
  auth/rate-limit 错误从任何函数 re-throw 后在 orchestrator `runCycle()` 的 catch 处被记录

- **State lifecycle risks:** 候选去重时同地址取高 pnl 的候选，防止 `scoreWallets()` 内部评分
  受重复地址影响（scoreWallets 未做去重保护）

- **API surface parity:** `MIN_CANDIDATES_FAIL/WARN` 的更新同时影响 `seedFromBirdeye`
  和 `seedFromDiscoveryState`（两者均 import 这两个常量），回测行为一致变化

- **Unchanged invariants:** `scoreWallets()` 签名、权重、`walletCap`；Helius webhook 更新流程；
  数据库同步流程；backtest collect/track/analyze 管线

- **Integration coverage:** orchestrator 的集成测试需验证 `scoreWallets` 入参数量显著大于 10

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Birdeye token_trending 响应字段与文档不符 | 实现时先做一次真实 curl 验证，字段映射写在 Deferred to Implementation 中 |
| top_traders 在 Starter 套餐下实际被限流 | 已有 rate limiter（30 rpm）保护；auth 错误 re-throw 给运维可见 |
| hot token 列表全为短命 meme coin，候选质量低 | scoreWallets 仍会按 PnL/winRate/tradeCount 过滤；长期监控效果可通过回测验证 |
| 阈值更新使现有回测测试失败 | Unit 4 明确列出需更新的测试文件和场景 |
| discovery 周期时间从 <5s 增长到 ~80s（40 token × 2s rate limit） | 6 小时间隔下完全可接受；首次启动无 debounce 影响 |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-03-expand-smart-money-candidate-pool-requirements.md](../brainstorms/2026-04-03-expand-smart-money-candidate-pool-requirements.md)
- Related code: `apps/backend/src/discovery/birdeye.ts`、`orchestrator.ts`、`scoring.ts`
- Multi-source aggregation pattern: `apps/backend/src/enrichment/enrich.ts` (`Promise.allSettled`)
- Birdeye token_trending API: `GET /defi/token_trending?sort_by=volume24hUSD&limit=20`
- Birdeye top_traders API: `GET /defi/v2/tokens/top_traders?address=<mint>&sort_by=pnl&limit=50`

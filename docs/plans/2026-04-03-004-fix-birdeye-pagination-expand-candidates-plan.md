---
title: "fix: 扩充 Birdeye 候选池提升回测数据充分度"
type: fix
status: active
date: 2026-04-03
---

# fix: 扩充 Birdeye 候选池提升回测数据充分度

## Overview

当前回测管线存在两个数据充分度问题：

1. **聪明钱组样本量不足**：候选池小（观测到 ≤10 个候选），30% 分组后每组只有 3 个钱包，统计无意义。原因待 Unit 0 诊断确认（可能是 limit 参数缺失或 Starter 套餐行为）
2. **SWAP 交易采集效率低**：`/v1/wallet/tx_list` 未传 `tx_type=swap`，采集大量非 SWAP 交易，稀释信号

本计划先做诊断实验（Unit 0）验证根本原因，再为 Birdeye API 调用添加明确的 `limit` 参数和 `tx_type=swap` 过滤，目标使每组钱包数量达到 15+ 个。

## Problem Frame

回测的统计有效性依赖于足够大的样本。在 30/30 分组策略下：

| 候选数 | 聪明钱组 | 基线组 | 统计意义 |
|--------|---------|-------|---------|
| 10（当前）| 3 个 | 3 个 | 极低 |
| 50（目标）| 15 个 | 15 个 | 可接受 |

此外 `collectViaBirdeye` 未加 `tx_type=swap` 过滤，导致抓到 add_liquidity、remove_liquidity 等无关交易，稀释了 SWAP 信号。

## Requirements Trace

- R1. `fetchTopWallets` 显式传 `limit=50`，确保每次获取最大可能候选数
- R2. `collectViaBirdeye` 添加 `tx_type=swap` 过滤，只获取相关交易
- R3. `seedFromBirdeye` 最小候选数阈值从 10 提升到 20，反映新的期望池大小
- R4. 新增 `limit` 参数不超过 Birdeye Starter 套餐的 API 约束（最大 50）
- R5. 不破坏断点续跑、降级链路等现有行为

## Scope Boundaries

- **不在本计划内**：多页分页（pagination loop）获取 50+ 候选——单次 50 已足够满足统计需求
- **不在本计划内**：修改 30/30 分组百分比逻辑
- **不在本计划内**：`/trader/gainers-losers` 的 `sort_type` 参数调整
- **不在本计划内**：Helius 采集层的分页改造

## Context & Research

### 相关代码和模式

- `apps/backend/src/discovery/birdeye.ts:fetchTopWallets`（第 93-123 行）——当前未传任何查询参数
- `apps/backend/src/scripts/backtest/collect.ts:collectViaBirdeye`（第 90-115 行）——当前 URL 未含 `tx_type=swap`
- `apps/backend/src/scripts/backtest/cli.ts:seedFromBirdeye`（第 143-165 行）——最小阈值硬编码为 10
- `apps/backend/src/discovery/rate-limiter.ts`——30 rpm token bucket，所有 Birdeye 调用必须通过

### Birdeye API 能力（已验证）

| 端点 | `limit` 默认 | `limit` 最大 | 分页方式 | 关键过滤参数 |
|------|-------------|-------------|---------|------------|
| `/trader/gainers-losers` | 50 | 50 | `offset` | `sort_type` |
| `/v1/wallet/tx_list` | 50 | 50 | `offset` | `tx_type`（swap/add/remove/all） |

> 来源：docs.birdeye.so/reference/get-trader-gainers-losers 和 get-v1-wallet-tx_list

### 制度性知识

- Birdeye Starter 套餐硬限流 30 rpm（`auto-wallet-discovery-architecture-2026-03-31.md`）
- `fetchTopWallets` 已有认证错误（401/403）和限流（429）处理模式，修改需保留

## Key Technical Decisions

- **Unit 0 诊断先行（而非直接加 limit 参数）**：观测到只返回 10 条，但根本原因尚未确认——可能是缺少 limit 参数，也可能是榜单当天本身只有 10 个活跃钱包（数据稀疏）。如果是后者，加 limit=50 不会改变结果，但阈值提升会让回测从「低质量运行」变成「显式失败」，退步于现状。必须先用对比实验确认原因。

- **显式传 `limit=50`（基于诊断确认后）**：如 Unit 0 确认 limit 参数确实影响结果，则显式传 limit=50 消除歧义，符合 API 约束（最大值 50）。

- **`tx_type=swap` 而非 `all`**：回测的目标是评估聪明钱的代币买卖行为，流动性操作不在分析范围内。过滤可减少无关数据，提高信息密度。注意：Unit 2 实现后需验证 normalizeBirdeyeTrade 的 `side` 字段在 swap-only 数据中的空值率（>10% 则需添加兜底警告）。

- **阈值从 10 提升至 20（保守下限，保留降级而非 throw）**：若候选数 ≥20 则正常运行；若 10~19 则打印 WARNING 但继续（低质量模式）；只有 <10 时才 throw，防止完全无意义统计。这样保留了现有的容错能力，同时设定了新的目标水位。

- **不做多页循环**：单次最多 50 条满足当前需求。若诊断（Unit 0）显示 Starter 套餐硬限 <20，则需新建分页计划，本计划不覆盖该路径。

## Open Questions

### Resolved During Planning

- **Q: Birdeye `/trader/gainers-losers` 是否支持 `limit` 参数？** A: 是，最大 50，默认 50（但实测 Starter 套餐可能不同，需显式传参）
- **Q: `v1/wallet/tx_list` 是否有 `tx_type` 过滤？** A: 是，支持 `swap`/`add`/`remove`/`all`

### Deferred to Implementation

- **Unit 0 诊断后决策**：若实测显示 limit 参数无效（两次返回数相同），整个计划需要重新评估，不应继续执行 Unit 1~4
- **`side` 字段空值率**：Unit 2 实现后需在实测数据中统计 swap-only 响应中 `side` 字段的空值率，>10% 时需要添加兜底逻辑
- **Admin SSE 超时阈值**：候选数增加后采集时间可能超过 2 分钟，需确认 SSE 连接在此期间不会被代理或浏览器断开

## Implementation Units

- [ ] **Unit 0: 诊断实验——验证候选数低的根本原因**

**Goal:** 在修改代码之前，用实测数据确认「limit 参数缺失」是候选数不足的真正原因

**Requirements:** 验证 R1 的前提条件

**Dependencies:** 无

**Files:**
- 无代码修改，仅运行实验

**Approach:**
- 用当前 API Key 调用 `/trader/gainers-losers`（无参数），记录 `data.items.length`
- 再调用 `/trader/gainers-losers?limit=50`，记录 `data.items.length`
- 若两次结果相同（如都是 10）：说明根本原因是榜单数据稀疏，而非 limit 参数，Unit 3 的阈值不应提升，需重新评估方向
- 若两次结果不同（如 10 vs 50）：确认 limit 参数是修复方向，继续 Unit 1-4

**Test scenarios:**
- Test expectation: none — 诊断实验，无代码变更

**Verification:**
- 诊断结果文档化（注释或 PR 描述中记录两次 API 响应的 items 数量）
- 根据结果决定是否继续执行 Unit 1~4，或重新评估计划

---

- [ ] **Unit 1: 为 `fetchTopWallets` 添加 `limit=50` 参数**

**Goal:** 确保每次调用最多获取 50 个候选钱包，消除 Starter 套餐因不传参数导致默认只返回 10 条的问题

**Requirements:** R1, R4

**Dependencies:** 无

**Files:**
- Modify: `apps/backend/src/discovery/birdeye.ts`
- Test: `apps/backend/test/discovery/birdeye.test.ts`

**Approach:**
- 在 `fetch` 调用的 URL 后追加 `?limit=50`（`trader/gainers-losers?limit=50`）
- 保留现有的错误处理模式（checkAuthError、checkRateLimit）
- 无需修改函数签名或返回类型

**Patterns to follow:**
- `discovery/birdeye.ts` 中 `fetchWalletPnL` 的 URL 构建方式（使用模板字符串拼接查询参数）

**Test scenarios:**
- Happy path: mock 返回 50 条 items → 函数返回 50 个 WalletCandidate
- Happy path: mock 返回 10 条 items → 函数返回 10 个 WalletCandidate（向后兼容）
- **Edge case（关键）**: 断言捕获的 fetch 调用的第一个参数（URL）包含 `limit=50` — 具体验证方式：`expect(vi.mocked(fetch).mock.calls[0][0]).toContain('limit=50')`，防止参数名写错（如 size=50）而测试依然通过
- Error path: 429 响应 → 抛出 rate limit 错误（保留现有行为）
- Error path: 401 响应 → 抛出 authentication 错误（保留现有行为）

**Verification:**
- 单元测试全部通过
- 实测 API 调用返回的候选数量 ≥ 20

---

- [ ] **Unit 2: 为 `collectViaBirdeye` 添加 `tx_type=swap&limit=50`**

**Goal:** 过滤掉流动性操作等非 SWAP 交易，提高采集的交易与回测目标的相关性，并显式获取最大条数

**Requirements:** R2, R4

**Dependencies:** 无（独立于 Unit 1）

**Files:**
- Modify: `apps/backend/src/scripts/backtest/collect.ts`
- Test: `apps/backend/test/scripts/backtest/collect.test.ts`

**Approach:**
- 将 URL 从 `...tx_list?wallet=...` 改为 `...tx_list?wallet=...&tx_type=swap&limit=50`
- 保留现有的 HTTP 状态码日志和错误处理逻辑
- `normalizeBirdeyeTrade` 函数保持不变

**Patterns to follow:**
- `collectWalletTrades` 中的 Helius URL 构建方式（使用 `&type=SWAP` 过滤）

**注意（私有函数测试策略）:** `collectViaBirdeye` 未被导出，无法直接单元测试。必须通过 `collectWalletTrades` 的 fallback 路径间接覆盖：在测试中 mock Helius 返回空数组，同时传入 `fallbackApiKey`，再断言 Birdeye 的 fetch 调用 URL。

**Test scenarios:**
- Happy path（通过 fallback 路径）: Helius mock 返回 `[]`，Birdeye mock 返回 50 条 swap 交易 → `collectWalletTrades` 最终返回 50 个 BacktestTrade
- Happy path: mock 返回空 items → 函数返回 `trades: []`
- **Edge case（关键）**: 断言 Birdeye fallback 的 fetch URL 包含 `tx_type=swap` 和 `limit=50`
- Edge case（数据质量）: mock 返回 10 条 `side=null` 的 swap items → 函数返回 10 个 type='buy' 的 trade + 打印 stderr 警告（需在 normalizeBirdeyeTrade 中添加空值检测）
- Error path: Birdeye HTTP 500 → 返回空数组 + 打印 stderr 日志（保留现有行为）
- Error path: 网络超时 → 捕获异常返回空数组（保留现有行为）

**Verification:**
- 单元测试全部通过
- 与 Unit 1 结合后，聪明钱组采集到 SWAP 交易数量有显著提升

---

- [ ] **Unit 3: 更新 `seedFromBirdeye` 最小阈值为 20**

**Goal:** 将候选数量不足的检测阈值从 10 提升到 20，反映新的 API 调用期望（limit=50 时合理预期 ≥ 20 条）

**Requirements:** R3, R5

**Dependencies:** Unit 1（`fetchTopWallets` 已返回更多候选）

**Files:**
- Modify: `apps/backend/src/scripts/backtest/cli.ts`（`seedFromBirdeye` 函数）
- Test: `apps/backend/test/scripts/backtest/cli.test.ts`

**Approach:**
- 将阈值逻辑改为三段式：`<10` → throw（完全无意义）；`10~19` → 打印 WARNING 日志 + 继续执行（低质量模式）；`≥20` → 正常执行
- 这保留了现有的容错能力，同时设定新目标水位，避免将「低质量运行」退化为「显式失败」
- 提取 `MIN_CANDIDATES_WARN = 20` 和 `MIN_CANDIDATES_FAIL = 10` 为具名常量，便于 runner.ts 同步引用
- 其余分组逻辑（30% 上/下分组）保持不变

**Patterns to follow:**
- 现有的 `seedFromBirdeye` 阈值校验模式

**Test scenarios:**
- Happy path: 50 个候选 → 分组成功，smartMoney 15 个，baseline 15 个，无警告
- Happy path: 20 个候选（边界值）→ 分组成功，各 6 个，无警告
- Edge case（低质量模式）: 15 个候选 → 打印 WARNING 日志，但分组成功继续执行（不 throw）
- Edge case（最小可用）: 10 个候选 → 打印 WARNING 日志，继续执行（向后兼容现有行为）
- Edge case（致命失败）: 9 个候选 → 抛出错误（低于 MIN_CANDIDATES_FAIL=10）
- Backward compat: 函数签名不变，调用方无需改动

**Verification:**
- 单元测试全部通过
- 类型检查通过（无新增 `any`）

---

- [ ] **Unit 4: 更新 BacktestRunner 种子阶段注释和日志**

**Goal:** 使 runner.ts 中与候选池大小相关的注释/日志与新阈值一致，避免文档与代码脱节

**Requirements:** R5

**Dependencies:** Unit 3

**Files:**
- Modify: `apps/backend/src/scripts/backtest/runner.ts`

**Approach:**
- 搜索 runner.ts 中任何提到"10 个候选"或最小候选数的注释/日志字符串
- 更新为与新阈值（20）一致的描述
- 如果 runner.ts 硬编码了候选阈值，需与 cli.ts 保持一致（或抽取共享常量）

**Patterns to follow:**
- runner.ts 现有的 phase 日志格式

**Test scenarios:**
- Test expectation: none — 纯注释/日志变更，无行为影响

**Verification:**
- `grep -r "至少 10" apps/backend/src/scripts/backtest/` 无命中
- 日志输出的候选数字描述与实际阈值一致

## System-Wide Impact

- **Interaction graph:** `fetchTopWallets` → `seedFromBirdeye` → `BacktestRunner.run` → Admin API SSE 进度流。Unit 1 的变更会通过此链路传播，导致 seed 阶段返回更多候选，后续采集阶段处理的地址数量增加
- **Error propagation:** `fetchTopWallets` 的认证/限流错误会继续向上抛出，中断整个 BacktestRunner（现有行为不变）
- **State lifecycle risks:** 候选数量增加后，回测采集阶段耗时会增加（每组从 3 个钱包增加到 15 个），admin SSE 进度流的进度粒度需要能容纳更多地址
- **API surface parity:** CLI `--seed-from-birdeye` 标志行为不变，Admin API POST `/api/v1/admin/backtest` 接口不变
- **Integration coverage:** 端到端回测（CLI 触发 → 采集 → 价格追踪 → 报告）应该在 Unit 1-3 完成后重新运行验证
- **Unchanged invariants:** 30/70 分组百分比逻辑、断点续跑机制、Helius 优先降级到 Birdeye 的采集策略，全部保持不变

## Risks & Dependencies

| 风险 | 缓解措施 |
|------|---------|
| 根本原因不是 limit 参数（榜单本身稀疏） | Unit 0 诊断实验先行；若确认后者，重新评估方向，不执行 Unit 1~4 |
| Birdeye Starter 套餐对 `limit=50` 实际只返回 <20 条 | Unit 0 诊断会揭示；若如此，保持阈值在 10 的 throw 边界，不执行 Unit 3 的 WARNING 逻辑提升 |
| 若 <20 条且需要分页才能达到目标 | 本计划不覆盖，新建独立的分页循环计划 |
| `tx_type=swap` 后 `side` 字段空值导致 100% 分类为 buy | Unit 2 增加空值检测 + stderr 警告，Verification 验证实测数据中 side 空值率 <10% |
| `tx_type=swap` 过滤后某些钱包无 SWAP 记录（真实情况） | 不是 bug，返回 `trades: []`；但 collectAllWallets 会将空结果写入 JSON 并标记为 completed，断点续跑时不会重试（已知行为，接受） |
| 候选数增加后 API 调用量翻倍，实际耗时估算 | 最坏情况：30 个钱包 × 2 次调用（Helius + Birdeye fallback）= 60 次，30 rpm 下 collect 阶段 >2 分钟。Admin SSE 连接的超时行为需实测确认是否足够 |
| Unit 4 runner.ts 中阈值可能被多处引用 | Unit 3 提取 `MIN_CANDIDATES_WARN/FAIL` 常量，runner.ts 直接引用同一常量 |

## Documentation / Operational Notes

- 回测结果改善后，建议更新 `docs/plans/2026-04-03-001-feat-backtest-runnable-plan.md` 的"已知问题"小节
- 本次变更不影响生产监控（webhook → Telegram 链路）

## Sources & References

- 相关代码: `apps/backend/src/discovery/birdeye.ts:fetchTopWallets`
- 相关代码: `apps/backend/src/scripts/backtest/collect.ts:collectViaBirdeye`
- 相关代码: `apps/backend/src/scripts/backtest/cli.ts:seedFromBirdeye`
- 外部文档: https://docs.birdeye.so/reference/get-trader-gainers-losers
- 外部文档: https://docs.birdeye.so/reference/get-v1-wallet-tx_list
- 制度知识: `docs/solutions/best-practices/auto-wallet-discovery-architecture-2026-03-31.md`（30 rpm 限制）

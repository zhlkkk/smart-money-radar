---
title: "feat: Phase 3c 数据可靠性提升 — 回测验证 + 缓存加固 + 交叉校验"
type: feat
status: completed
date: 2026-04-02
origin: docs/superpowers/specs/2026-04-02-data-trust-layer-design.md
---

# Phase 3c 数据可靠性提升

## Overview

Phase 3b 建立了用户可见的置信度评分系统（透明化层）。Phase 3c 在此基础上提升底层数据管线的真实可靠性：验证"聪明钱"标签的预测力、降低 DexScreener 单点故障风险、用链上数据交叉校验价格。

## Problem Frame

当前数据管线存在三个未验证的假设（see origin: `docs/superpowers/specs/2026-04-02-data-trust-layer-design.md`）：

1. **Birdeye 评分有效性未验证**: 评分权重（PNL 35%, 胜率 30%, 交易量 20%, 活跃度 15%）是拍脑袋定的，不知道被标记为"聪明钱"的地址是否真的比随机地址表现更好
2. **DexScreener 单点依赖**: 无缓存、无降级，API 超时或限流直接导致告警缺失市场数据
3. **价格数据未校验**: DexScreener 价格可能被假池子污染或因延迟失真，但管线盲目信任

## Requirements Trace

- R1. 回测脚本验证聪明钱标签的真实预测力（24h 胜率、平均回报 vs 随机基线）
- R2. DexScreener 本地缓存降低 API 调用频率和单点故障风险
- R3. 缓存降级策略：API 故障时返回过期数据 + stale 标记
- R4. 链上 AMM 池价格交叉校验 DexScreener 数据
- R5. 置信度权重基于回测结果手动调优（非全自动）

## Scope Boundaries

- **不包含**: Birdeye 评分算法重写（等回测结果决定）
- **不包含**: Webhook HMAC 签名验证（Helius 不支持 HMAC，当前 auth token 方式已是唯一选项，见 `docs/solutions/developer-experience/solana-typescript-implementation-gotchas-2026-03-31.md`）
- **不包含**: 全自动权重调优系统（MVP 阶段手动调整足够）
- **不包含**: 持久化队列或消息中间件

## Context & Research

### Relevant Code and Patterns

- `apps/backend/src/discovery/scoring.ts` — 当前评分系统，percentile rank + 加权求和
- `apps/backend/src/discovery/birdeye.ts` — Birdeye API 客户端，含 auth/rate-limit 错误处理
- `apps/backend/src/discovery/rate-limiter.ts` — 速率限制器模式，可复用于回测脚本
- `apps/backend/src/enrichment/dexscreener.ts` — DexScreener 无缓存直接调用，2s timeout
- `apps/backend/src/enrichment/enrich.ts` — `Promise.allSettled` 并行 enrichment，`withTimeout` 工具函数
- `apps/backend/src/enrichment/confidence.ts` — 置信度计算，纯函数 100 分制
- `apps/backend/src/pipeline.ts` — 完整管线集成链
- `apps/backend/src/webhook/handler.ts` — 当前 auth token 验证（第 14 行）

### Institutional Learnings

- `docs/solutions/best-practices/confidence-scoring-data-trust-layer-2026-04-02.md` — 置信度评分架构决策
- `docs/solutions/best-practices/fire-and-forget-webhook-graceful-degradation-2026-03-31.md` — 外部 API 降级模式
- `docs/solutions/developer-experience/solana-typescript-implementation-gotchas-2026-03-31.md` — Helius 不支持 HMAC

## Key Technical Decisions

- **退市代币处理**: 回测中若 OHLCV 无数据，视为 -100% 亏损（代币归零）。单独统计"无数据比例"，超过 30% 则标记"数据不足，结论不可靠"。避免生存者偏差虚高胜率。
- **缓存 TTL 30 秒**: 同一 webhook 批次内多笔同代币交易共享数据；30 秒后刷新避免过时。`mintAddress` 作为缓存键。
- **Stale-while-revalidate**: API 失败时返回过期缓存数据 + `stale: true` 标记。下游置信度可据此降分。比返回 NULL_RESULT 更友好。
- **手动权重调优**: P0 回测输出各维度预测力数据，开发者据此手动调整 `confidence.ts` 中的权重。4 个维度的手动调优成本远低于构建自动系统。
- **删除 P1 HMAC 任务**: Helius webhook 不发送 HMAC 签名头，当前 auth token 比对已是唯一可行方案。改为加强 auth token 的随机性和轮换提醒。
- **P2 交叉校验精简**: 仅校验 Raydium V4 AMM 池（最常见），偏差阈值 5%。超出预算时跳过校验而非阻塞管线。

## Open Questions

### Resolved During Planning

- **Q: Helius 是否支持 HMAC？** → 不支持。已在 gotchas 文档确认。删除 HMAC 任务。
- **Q: 回测中退市代币如何处理？** → 视为 -100% 亏损 + 单独统计无数据比例。
- **Q: 缓存 TTL 多长？** → 30 秒。平衡去重效率和数据新鲜度。
- **Q: 权重调优自动 vs 手动？** → 手动。回测输出推荐权重，开发者审阅后改代码。

### Deferred to Implementation

- **Birdeye API 速率限制的具体节流策略**: 回测脚本需要大量 API 调用，具体的 delay/batch 参数需要实测调整。
- **Raydium V4 池子账户的 PDA 推导**: 需要查阅 Raydium SDK 文档确认具体的 seed 和 program ID。
- **回测报告的可视化格式**: 输出 JSON 还是 Markdown 表格，实现时决定。

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
P0 回测脚本（离线，独立于线上服务）:
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────────┐
│ Birdeye API │────>│ 交易数据采集  │────>│ 价格追踪     │────>│ 统计分析   │
│ tx_list     │     │ 50 钱包 x N笔│     │ 1h/24h/7d    │     │ + 基线对比 │
└─────────────┘     └──────────────┘     └──────────────┘     └────────────┘
                         ↓ 持久化中间结果（支持断点续跑）           ↓
                                                           ┌────────────┐
                                                           │ 结构化报告 │
                                                           │ pass/fail  │
                                                           └────────────┘

P1 DexScreener 缓存（嵌入线上管线）:
fetchDexScreenerData(mint)
  → cache.get(mint)
    → HIT & 未过期: 返回缓存
    → HIT & 已过期: 尝试 API → 成功则更新缓存 → 失败则返回旧数据 + stale:true
    → MISS: 调用 API → 成功则写入缓存 → 失败则返回 NULL_RESULT

P2 链上交叉校验（嵌入 enrichment 并行阶段）:
enrichToken(mint, rpc)
  → Promise.allSettled([
      fetchDexScreenerData(mint),     // 已有，现在带缓存
      checkAuthorities(rpc, mint),     // 已有
      crossValidatePrice(rpc, mint),   // 新增
    ])
  → 比较 DexScreener 价格 vs AMM 池价格
  → 偏差 > 5%: enrichment 结果标记 priceDeviation
  → 下游置信度可据此降分
```

## Implementation Units

- [x] **Unit 1: 回测数据采集模块**

**Goal:** 从 Birdeye API 批量获取聪明钱历史交易数据，支持断点续跑

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `apps/backend/src/scripts/backtest/collect.ts`
- Create: `apps/backend/src/scripts/backtest/types.ts`
- Test: `apps/backend/test/scripts/backtest/collect.test.ts`

**Approach:**
- 复用 `discovery/birdeye.ts` 的 `makeHeaders` 和错误处理模式
- 使用 Birdeye `/wallet/tx_list` API 获取每个钱包的历史买入交易
- 中间结果持久化到 `data/backtest/` 目录下的 JSON 文件
- 启动时检查已有文件，跳过已采集的钱包（断点续跑）
- 复用 `discovery/rate-limiter.ts` 模式控制请求频率

**Patterns to follow:**
- `apps/backend/src/discovery/birdeye.ts` — API 调用、错误处理、类型定义
- `apps/backend/src/discovery/rate-limiter.ts` — 速率限制

**Test scenarios:**
- Happy path: 给定 mock API 响应，正确解析交易列表并返回标准化格式
- Happy path: 已有持久化文件的钱包被跳过（断点续跑）
- Edge case: API 返回空交易列表 → 返回空数组，不报错
- Edge case: 钱包地址无效或被封禁 → 跳过并记录警告
- Error path: API 429 限流 → 抛出明确错误，由上层处理重试
- Error path: API 401/403 认证失败 → 抛出终止级错误
- Error path: 网络超时 → 跳过当前钱包，继续下一个

**Verification:**
- 脚本可对 mock 数据运行并输出 JSON 文件到 `data/backtest/`
- 中断后重新运行，已采集的钱包被跳过

---

- [x] **Unit 2: 价格追踪与统计分析模块**

**Goal:** 追踪每笔买入后的价格表现，计算胜率/回报等指标，对比随机基线

**Requirements:** R1

**Dependencies:** Unit 1

**Files:**
- Create: `apps/backend/src/scripts/backtest/track-prices.ts`
- Create: `apps/backend/src/scripts/backtest/analyze.ts`
- Create: `apps/backend/src/scripts/backtest/report.ts`
- Test: `apps/backend/test/scripts/backtest/analyze.test.ts`

**Approach:**
- 价格追踪：用 DexScreener OHLCV 或 Birdeye OHLCV 获取买入后 1h/24h/7d 价格
- 退市代币策略：OHLCV 无数据 → 标记为 -100% 亏损，单独统计无数据比例
- 随机基线：从 Birdeye 获取同时段 50 个随机活跃地址（过去 30 天有 >= 10 笔交易），同样追踪价格
- 统计分析：胜率、平均回报、最大回撤、盈利集中度（前 10% 交易贡献利润占比）
- 报告输出：结构化 JSON + 可读 Markdown 表格，含 pass/fail 结论
- Pass 阈值：聪明钱组 24h 胜率 > 55% 且显著高于随机组（差值 > 10pp）

**Patterns to follow:**
- `apps/backend/src/discovery/scoring.ts` — 百分位排名、指标归一化
- `apps/backend/src/enrichment/dexscreener.ts` — API 调用模式

**Test scenarios:**
- Happy path: 给定完整价格数据，正确计算 24h 胜率和平均回报
- Happy path: 聪明钱组 vs 随机组对比结果格式正确
- Edge case: 某笔买入的 OHLCV 无数据 → 标记 -100%，无数据比例统计正确
- Edge case: 无数据比例 > 30% → 报告标记"数据不足，结论不可靠"
- Edge case: 所有买入都盈利（100% 胜率）→ 正常输出，不做特殊处理
- Edge case: 盈利集中度计算，前 10% 交易贡献 > 80% 利润 → 标记"运气成分高"
- Error path: 价格 API 限流 → 重试机制 + 断点续跑

**Verification:**
- 用 mock 数据运行完整回测流程，输出 Markdown 报告
- 报告包含：总交易数、胜率、平均回报、最大回撤、盈利集中度、pass/fail 结论

---

- [x] **Unit 3: DexScreener 本地缓存**

**Goal:** 为 DexScreener API 添加 LRU+TTL 缓存层，支持 stale-while-revalidate 降级

**Requirements:** R2, R3

**Dependencies:** None（可与 Unit 1-2 并行）

**Files:**
- Create: `apps/backend/src/enrichment/dex-cache.ts`
- Modify: `apps/backend/src/enrichment/dexscreener.ts`
- Modify: `apps/backend/src/enrichment/enrich.ts`
- Modify: `apps/backend/src/types.ts` (或 `@radar/shared` 类型)
- Test: `apps/backend/test/enrichment/dex-cache.test.ts`
- Modify: `apps/backend/test/enrichment/dexscreener.test.ts`
- Modify: `apps/backend/test/enrichment/enrich.test.ts`

**Approach:**
- 缓存实现：内存 LRU Map，key = mintAddress，value = { data, timestamp }
- TTL = 30 秒，maxSize = 2000 条
- Stale-while-revalidate：API 失败时若缓存有过期数据，返回该数据 + `stale: true` 标记
- `DexScreenerData` 类型新增可选 `stale?: boolean` 字段
- `fetchDexScreenerData` 函数签名不变，内部透明集成缓存
- 下游 `computeConfidence` 可选择对 stale 数据降分（P2 阶段实现）

**Patterns to follow:**
- `apps/backend/src/webhook/dedup.ts` — LRU 缓存模式（TxDedup 使用 Map + maxSize）
- `apps/backend/src/enrichment/enrich.ts` — `withTimeout` + `Promise.allSettled` 降级模式

**Test scenarios:**
- Happy path: 首次调用走 API 并写入缓存
- Happy path: TTL 内再次调用同一 mint → 返回缓存数据，不调用 API
- Happy path: TTL 过期后调用 → 重新请求 API 并更新缓存
- Edge case: 缓存达到 maxSize → 最旧条目被淘汰
- Edge case: API 失败但缓存有过期数据 → 返回过期数据 + stale: true
- Edge case: API 失败且缓存为空 → 返回 NULL_RESULT（与当前行为一致）
- Error path: API 超时 2s → 降级到缓存或 NULL_RESULT
- Integration: 完整 enrichToken 调用链中，缓存对 pipeline 透明

**Verification:**
- 测试覆盖所有缓存状态（miss/hit/stale/evict）
- enrichToken 的现有测试继续通过
- 可通过日志观察到缓存命中/未命中

---

- [x] **Unit 4: 链上价格交叉校验**

**Goal:** 从 Raydium V4 AMM 池读取链上储备数据，与 DexScreener 价格交叉比较

**Requirements:** R4

**Dependencies:** Unit 3（需要 DexScreener 缓存的 stale 标记基础设施）

**Files:**
- Create: `apps/backend/src/enrichment/cross-validate.ts`
- Modify: `apps/backend/src/enrichment/enrich.ts`
- Modify: `apps/backend/src/types.ts` (或 `@radar/shared` 类型)
- Test: `apps/backend/test/enrichment/cross-validate.test.ts`
- Modify: `apps/backend/test/enrichment/enrich.test.ts`

**Approach:**
- 仅校验 Raydium V4 AMM 池（Solana 上最常见的 DEX）
- 通过 RPC `getAccountInfo` 获取池子账户数据，解析 token reserves
- 计算链上价格 = reserve_quote / reserve_base（需要考虑 decimals）
- 与 DexScreener 返回的隐含价格（FDV / total supply 或 liquidity 相关推算）比较
- 偏差 > 5% → `EnrichmentResult` 新增 `priceDeviation?: number` 字段
- 链上查询与 DexScreener/authority check 并行（在 `Promise.allSettled` 中添加）
- 查询失败或超时 → 跳过校验，不阻塞管线
- 找不到对应池子 → 跳过校验

**Execution note:** 池子 PDA 推导需要查阅 Raydium V4 SDK 文档确认 seed 和 program ID，实现时可能需要调整。

**Patterns to follow:**
- `apps/backend/src/enrichment/authority-check.ts` — RPC 调用 + 数据解析模式
- `apps/backend/src/enrichment/enrich.ts` — `Promise.allSettled` 并行集成

**Test scenarios:**
- Happy path: DexScreener 价格与链上价格偏差 < 5% → priceDeviation 为小数值
- Happy path: 偏差 > 5% → priceDeviation 标记明确值，下游可据此调整置信度
- Edge case: 找不到 Raydium 池子（代币在 Orca 或其他 DEX）→ 跳过校验，priceDeviation 为 undefined
- Edge case: 池子存在但储备为 0 → 跳过校验
- Error path: RPC 调用超时 → 跳过校验，不影响管线
- Error path: RPC 返回格式异常 → 跳过校验并记录警告
- Integration: enrichToken 增加第三个并行调用后，现有测试和端到端延迟不受影响

**Verification:**
- 单元测试覆盖有池/无池/超时/偏差大/偏差小场景
- enrichToken 现有测试继续通过
- 管线端到端延迟仍在 2s 预算内（新增调用在并行中执行）

---

- [x] **Unit 5: 置信度权重调优集成**

**Goal:** 将回测结果和交叉校验信号集成到置信度评分中，手动调优权重

**Requirements:** R4, R5

**Dependencies:** Unit 2（回测结果）, Unit 3（stale 标记）, Unit 4（priceDeviation）

**Files:**
- Modify: `apps/backend/src/enrichment/confidence.ts`
- Modify: `apps/backend/test/enrichment/confidence.test.ts`

**Approach:**
- 根据 P0 回测结果调整四个维度的权重（具体值由回测数据决定）
- 新增可选降分规则：`stale: true` 数据的 DexScreener 完整度降 10 分
- 新增可选降分规则：`priceDeviation > 5%` 时额外降 10 分
- 保持满分 100 分制不变，新降分项从总分中扣除
- 权重以常量定义在文件顶部，便于未来调整

**Patterns to follow:**
- `apps/backend/src/enrichment/confidence.ts` — 当前纯函数 + 布尔判断模式

**Test scenarios:**
- Happy path: stale 数据 → DexScreener 完整度不加满 25 分（减 10 分 → 加 15 分）
- Happy path: priceDeviation > 5% → 总分额外扣 10 分
- Happy path: 无 stale 且无偏差 → 与当前行为一致（回归测试）
- Edge case: stale + priceDeviation 同时存在 → 两个降分叠加
- Edge case: priceDeviation 为 undefined（未做交叉校验）→ 不扣分
- Edge case: 调整权重后的边界阈值测试（high ≥ 80, medium ≥ 45）

**Verification:**
- 所有现有置信度测试继续通过（回归安全）
- 新增降分规则的测试覆盖边界值
- stale 和 priceDeviation 场景下置信度等级正确降级

---

- [x] **Unit 6: 回测 CLI 入口与运行脚本**

**Goal:** 创建可直接运行的回测 CLI 脚本，集成 Unit 1 + Unit 2 的模块

**Requirements:** R1

**Dependencies:** Unit 1, Unit 2

**Files:**
- Create: `apps/backend/src/scripts/backtest/cli.ts`
- Create: `apps/backend/scripts/run-backtest.sh`
- Modify: `apps/backend/package.json` (添加 `backtest` script)

**Approach:**
- CLI 脚本读取环境变量（BIRDEYE_API_KEY）和命令行参数（--wallets-file, --output-dir）
- 默认使用 `config/smart-money-addresses.json` 中的已订阅钱包
- 串联 collect → track-prices → analyze → report 四个阶段
- 支持 `--skip-collect` 跳过采集阶段（已有数据时直接分析）
- 输出到 `data/backtest/report-YYYY-MM-DD.md`

**Test expectation:** none -- 纯 CLI 胶水代码，核心逻辑在 Unit 1/2 中已测试

**Verification:**
- `pnpm --filter backend backtest --help` 显示帮助信息
- 用 mock 环境变量运行 `--skip-collect` 模式，成功输出报告文件

## System-Wide Impact

- **Interaction graph:** DexScreener 缓存层对 `enrichToken` 透明，不影响下游 pipeline.ts 的调用方式。交叉校验作为第三个并行任务加入 `Promise.allSettled`，失败不影响已有两个任务。
- **Error propagation:** 缓存和交叉校验均采用"失败则跳过"策略，不引入新的致命错误路径。回测脚本是离线的，错误不影响线上服务。
- **State lifecycle risks:** 缓存使用内存 Map，进程重启即清空，无持久化状态风险。回测中间数据写入本地 JSON，无并发写入风险。
- **API surface parity:** `DexScreenerData` 新增 `stale` 字段为可选，`EnrichmentResult` 新增 `priceDeviation` 为可选，均向后兼容。前端 AlertCard 和 Telegram format 无需立即改动。
- **Integration coverage:** Unit 3/4 的集成测试需验证 enrichToken 的完整调用链在缓存 hit/miss/stale 和交叉校验 success/fail 的组合场景下表现正确。
- **Unchanged invariants:** pipeline.ts 的调用链不变，Telegram format 和 SSE 推送逻辑不变，webhook handler 不变。

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Birdeye API 速率限制导致回测耗时过长 | 复用 rate-limiter，中间结果持久化支持断点续跑 |
| Birdeye tx_list 或 OHLCV 响应格式与预期不符 | 回测脚本中做防御性解析，字段缺失则跳过记录 |
| Raydium V4 池子 PDA 推导不正确 | 实现时查阅 Raydium SDK 源码确认，失败则跳过校验 |
| 交叉校验增加 enrichment 延迟 | 与已有任务并行，超时则跳过，不增加阻塞路径 |
| 回测结论显示评分模型无效 | 文档中已有行动方案：暂停"聪明钱"标签，重做评分算法 |

## Sources & References

- **Origin document:** [docs/superpowers/specs/2026-04-02-data-trust-layer-design.md](docs/superpowers/specs/2026-04-02-data-trust-layer-design.md) — 回测方法论详细设计
- Related code: `apps/backend/src/enrichment/` — enrichment 管线
- Related code: `apps/backend/src/discovery/` — Birdeye + scoring
- Related learnings: `docs/solutions/best-practices/confidence-scoring-data-trust-layer-2026-04-02.md`
- Related learnings: `docs/solutions/developer-experience/solana-typescript-implementation-gotchas-2026-03-31.md` — Helius 无 HMAC

---
title: "feat: Birdeye Token Metadata Enrichment + Backtest Fallback"
type: feat
status: active
date: 2026-04-03
---

# feat: Birdeye Token Metadata Enrichment + Backtest Fallback

## Overview

告警推送和 Dashboard 页面经常只显示 token 地址掩码（如 `DezX...B263`），因为 DexScreener 对小众/新代币没有 pair 数据，tokenSymbol 为 null。利用已开通的 Birdeye Starter 套餐，新增 token metadata 查询作为 enrichment 管线的补充数据源。同时为回测采集增加 Birdeye `wallet/tx_list` 作为 Helius 的 fallback。

## Problem Frame

1. **告警缺 token 元信息**：pipeline.ts L95 `tokenSymbol = swap.tokenSymbol ?? enrichment.tokenSymbol ?? null`，当 DexScreener 返回 `NULL_RESULT` 时，Telegram 推送和 Dashboard 告警卡片只能显示地址掩码
2. **回测采集单点依赖**：当前只靠 Helius Enhanced TX API，如果 Helius 对某钱包返回空数据，没有 fallback

## Requirements Trace

- R1. 当 DexScreener 未返回 tokenSymbol 时，从 Birdeye 获取 token 名称/符号作为兜底
- R2. Telegram 推送和 Dashboard 告警卡片始终显示 token 符号（极端情况仍可回退到地址掩码）
- R3. 回测 collect 阶段：Helius 采集为空时 fallback 到 Birdeye wallet/tx_list
- R4. 不影响现有 enrichment 管线的 2 秒超时预算
- R5. Birdeye API 调用失败不阻塞告警推送（graceful degradation）

## Scope Boundaries

- 不引入 token logo/图片展示（MVP 只要 symbol 文字）
- 不修改 DexScreener 查询逻辑
- 不修改 Dashboard 告警卡片 UI 组件（只改数据层，UI 已有 tokenSymbol 的展示逻辑）

## Key Technical Decisions

- **Birdeye token metadata 插入位置: enrichment 管线并行调用** — 在 `enrichToken()` 的 `Promise.allSettled` 中新增 Birdeye metadata 查询，与 DexScreener/authority check 并行执行，不增加延迟
- **优先级: DexScreener > Birdeye > 地址掩码** — DexScreener 的 tokenSymbol 通常更准确（来自交易对），Birdeye 作为兜底
- **Birdeye API key 传递: 环境变量** — `BIRDEYE_API_KEY` 已在 env.ts 中定义，enrichToken 新增可选参数
- **回测 fallback: collect 层面** — collectWalletTrades 先试 Helius，无 SWAP 交易时尝试 Birdeye wallet/tx_list

## Implementation Units

- [ ] **Unit 1: Birdeye Token Metadata Fetcher**

**Goal:** 新增 Birdeye token metadata 查询模块，返回 tokenSymbol 和 tokenName

**Requirements:** R1, R5

**Dependencies:** None

**Files:**
- Create: `apps/backend/src/enrichment/birdeye-metadata.ts`
- Test: `apps/backend/test/enrichment/birdeye-metadata.test.ts`

**Approach:**
- 调用 `GET /defi/v3/token/meta-data/single?address={mint}` 端点
- 返回 `{ symbol: string | null, name: string | null }`
- 2 秒超时，失败返回 null（不抛异常）
- 带 LRU 内存缓存（复用 DexCache 的模式，TTL 5 分钟，上限 2000 条）

**Patterns to follow:**
- `enrichment/dexscreener.ts` 的 fetch + 超时 + fallback 模式
- `enrichment/dex-cache.ts` 的 LRU+TTL 缓存模式

**Test scenarios:**
- Happy path: API 返回 `{ data: { symbol: "BONK", name: "Bonk" } }` → 返回 `{ symbol: "BONK", name: "Bonk" }`
- Happy path: 第二次调用同一 mint → 命中缓存，不触发 HTTP
- Edge case: API 返回无 symbol 字段 → 返回 `{ symbol: null, name: null }`
- Error path: HTTP 401 → 返回 null（不抛异常）
- Error path: 网络超时 → 返回 null
- Error path: BIRDEYE_API_KEY 未配置 → 直接返回 null

**Verification:**
- 模块可独立导入和测试
- 失败场景不抛异常

- [ ] **Unit 2: 集成到 Enrichment 管线**

**Goal:** 将 Birdeye metadata 查询并行加入 enrichToken()，tokenSymbol 兜底链路完整

**Requirements:** R1, R2, R4, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `apps/backend/src/enrichment/enrich.ts`
- Modify: `apps/backend/src/pipeline.ts` (传入 birdeyeApiKey)
- Modify: `apps/backend/src/index.ts` (传入 birdeyeApiKey 到 pipeline)
- Test: `apps/backend/test/enrichment/enrich.test.ts` (补充 Birdeye fallback 场景)

**Approach:**
- `enrichToken()` 新增可选参数 `birdeyeApiKey?: string`
- 在 `Promise.allSettled` 中加入 `fetchBirdeyeMetadata(tokenMint, birdeyeApiKey)`（仅当 key 存在时）
- 返回值中 `tokenSymbol` 优先级: DexScreener > Birdeye > null
- 新增 `tokenName` 字段到 `EnrichmentResult`（可选）
- pipeline.ts 从 config 中取 birdeyeApiKey 传给 enrichToken

**Patterns to follow:**
- `enrich.ts` 现有的 `Promise.allSettled` + graceful degradation 模式

**Test scenarios:**
- Happy path: DexScreener 返回 symbol → 用 DexScreener 的，忽略 Birdeye
- Happy path: DexScreener 返回 null + Birdeye 返回 "BONK" → 用 Birdeye 的
- Edge case: 两者都返回 null → tokenSymbol 为 null
- Error path: Birdeye 查询失败 → 不影响其他 enrichment 结果
- Integration: enrichToken 在 2 秒内完成（Birdeye 并行不增加延迟）

**Verification:**
- tokenSymbol 在 DexScreener 无数据时有 Birdeye 兜底
- enrichment 总耗时不超过 2 秒

- [ ] **Unit 3: 回测 Collect Birdeye Fallback**

**Goal:** 回测采集交易时，Helius 返回空 SWAP 数据则 fallback 到 Birdeye wallet/tx_list

**Requirements:** R3

**Dependencies:** None（可与 Unit 1-2 并行）

**Files:**
- Modify: `apps/backend/src/scripts/backtest/collect.ts`
- Modify: `apps/backend/src/scripts/backtest/runner.ts` (传入 birdeyeApiKey)
- Test: `apps/backend/test/scripts/backtest/collect.test.ts` (补充 fallback 场景)

**Approach:**
- `collectWalletTrades` 新增可选第四参数 `fallbackApiKey?: string`（Birdeye key）
- 先走 Helius 采集；若返回的 trades 为空且 fallbackApiKey 存在，尝试 Birdeye `/v1/wallet/tx_list`
- Birdeye 的响应格式与 Helius 不同，需要独立的 normalize 函数（已有旧代码可参考 git history）
- runner.ts 传入 birdeyeApiKey 作为 fallback key

**Patterns to follow:**
- 现有 collect.ts 的 Helius 采集逻辑
- git history 中旧的 Birdeye collect 代码（normalizeTrade 函数）

**Test scenarios:**
- Happy path: Helius 返回 SWAP 数据 → 不调用 Birdeye
- Happy path: Helius 返回空数组 + Birdeye 返回交易 → 用 Birdeye 数据
- Edge case: Helius 返回空 + Birdeye 也返回空 → 返回空 trades
- Edge case: 无 fallbackApiKey → 跳过 Birdeye fallback
- Error path: Birdeye fallback 失败 → 返回 Helius 的空结果（不抛异常）

**Verification:**
- Helius 有数据时不触发 Birdeye 调用
- Helius 无数据时 Birdeye 兜底生效

## System-Wide Impact

- **Interaction graph:** enrichment 管线新增一个并行调用，不影响现有 DexScreener/authority check
- **Error propagation:** Birdeye 失败 → 静默降级，不影响告警推送
- **API 配额:** Birdeye Starter 5M CU/月，每次 metadata 查询消耗极少 CU，回测 fallback 按需调用
- **Unchanged invariants:** DexScreener 查询不变、告警卡片 UI 组件不变（tokenSymbol 有值就展示）

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Birdeye metadata 增加 enrichment 延迟 | 并行执行，不增加总耗时；2 秒超时兜底 |
| Birdeye API 配额超限 | Starter 5M CU/月，metadata 查询 CU 极低；加 LRU 缓存减少重复调用 |
| 回测 fallback 增加运行时间 | 仅在 Helius 返回空时触发，大多数钱包不需要 fallback |

## Sources & References

- Birdeye Token Metadata API: [docs.birdeye.so](https://docs.birdeye.so/reference/get-defi-v3-token-meta-data-single)
- Related code: `apps/backend/src/enrichment/enrich.ts` (并行 enrichment 模式)
- Related code: `apps/backend/src/enrichment/dexscreener.ts` (fetch + cache 模式)
- Related code: `apps/backend/src/scripts/backtest/collect.ts` (Helius 采集)

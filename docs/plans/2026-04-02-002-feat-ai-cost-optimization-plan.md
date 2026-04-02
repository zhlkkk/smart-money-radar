---
title: "feat: AI 调用成本优化 — 缓存 + 低价值跳过"
type: feat
status: active
date: 2026-04-02
---

# AI 调用成本优化 — 缓存 + 低价值跳过

## Overview

通过同代币缓存和低价值交易跳过两个策略，将 AI API 调用量降低 60-80%，显著降低 PoloAPI 消耗。

## Problem Frame

当前每笔通过质量过滤的链上交易都无条件调用 Claude AI 生成摘要。$20.26 / 3981 次请求，平均 $0.005/次。多个聪明钱买同一代币时，每笔都重新分析——但同一代币短时间内的基本面数据相同，AI 输出几乎一样。

## Requirements Trace

- R1. 同一代币 10 分钟内的重复 AI 调用直接返回缓存结果
- R2. 缓存使用 LRU 策略，最大 500 条，避免内存泄漏
- R3. 日志记录缓存命中率，便于监控优化效果
- R4. 现有测试通过，新增缓存逻辑的单元测试

## Scope Boundaries

不在范围内：批量合并（复杂度高、收益边际）、更换模型、修改 prompt

## Key Technical Decisions

- **LRU Cache 在 `generateAttribution` 层实现**：key = `tokenMint`，value = `{ summary, timestamp }`，10 分钟过期。理由：最小侵入性，pipeline.ts 无需修改。

- **不做低价值跳过的独立策略**：`passesQualityFilter` 已经过滤了 < $5K 流动性和 < $50K FDV 的代币。再加一层阈值价值不大，反而增加配置复杂度。

## Implementation Units

- [ ] **Unit 1: AI 归因缓存**

**Goal:** 同一代币 10 分钟内的重复 AI 调用直接返回缓存

**Requirements:** R1, R2, R3

**Dependencies:** 无

**Files:**
- Modify: `apps/backend/src/ai/attribution.ts` — 添加 LRU 缓存逻辑
- Create: `apps/backend/test/ai/attribution-cache.test.ts` — 缓存测试

**Approach:**
- 在 `generateAttribution` 内部维护一个 Map<string, { summary: string; cachedAt: number }>
- 调用前检查：如果 `tokenMint` 在缓存中且未过期（10 分钟），直接返回
- 调用后写入缓存
- LRU 驱逐：当 Map size > 500 时删除最早的条目
- 添加 `cache_hit` / `cache_miss` 日志

**Execution note:** 先写测试再实现

**Test scenarios:**
- Happy path: 相同 tokenMint 第二次调用返回缓存，不触发 HTTP 请求
- Happy path: 不同 tokenMint 各自独立调用
- Edge case: 缓存过期后重新调用 AI
- Edge case: 超过 500 条时最早的条目被驱逐
- Error path: AI 调用失败不缓存空字符串

**Verification:**
- `pnpm --filter backend test` 通过
- 日志中可见 `[attribution] cache hit` 消息

---
title: "并行子代理开发的端到端集成测试契约"
date: "2026-04-03"
category: best-practices
module: "enrichment-pipeline / workflow"
problem_type: "workflow_issue"
component: "testing_framework"
severity: "high"
applies_when:
  - "多个子代理并行实现跨模块功能（3+ 个模块边界转接）"
  - "新增字段到共享数据结构（如 EnrichmentResult、DexScreenerData）"
  - "函数签名扩展（新增可选参数），需要所有调用点同步更新"
  - "数据流式功能：从 API 获取 → 中间转换 → 最终消费"
tags:
  - parallel-sub-agents
  - integration-testing
  - data-flow
  - type-safety
  - end-to-end-validation
  - code-review
  - silent-failure
---

# 并行子代理开发的端到端集成测试契约

## Context

Phase 3c 使用 6 个并行子代理实现数据可靠性提升。每个子代理独立完成模块级 TDD + 测试（56 个新测试全部通过），但 code review 发现**置信度降分功能在生产中完全不生效** — 3 处独立的断路叠加，导致整条数据链静默失效。

这揭示了并行子代理开发模式的核心风险：**每个子代理的 context 被隔离到 1-2 个 Unit，不持有全管线视图**。模块间接口演化时，只有编写方知道变更，消费方不感知。

## Guidance

### 三类断路及其发现时机

| 断路类型 | 特征 | 如何发现 | 修复点 |
|---------|------|---------|--------|
| **类型断路** | 数据结构中途修改，后续消费方缺少对应字段 | 类型检查 + code review | 在所有消费方同步字段 |
| **数据断路** | 字段在数据结构中存在但未被提取、转发到下游 | 集成测试 | 在数据转换函数确认转发逻辑 |
| **调用断路** | 下游函数支持新参数但上游未传递 | 端到端黑盒测试 | 在管线入口验证 options 传递 |

### PM（主进程）在 Review 时必须检查的 3 件事

1. **新增字段是否贯穿全链路**：从定义处 → 每个中间转换函数 → 最终消费函数
2. **函数签名变更是否同步到所有调用点**：`grep` 函数名，逐一确认
3. **可选参数是否有调用者实际传递**：可选参数不传等于功能不存在

### 最小端到端集成测试模板

对于跨 3+ 模块边界的数据流功能，PM 应在所有 Unit 完成后要求补充：

```typescript
// 端到端集成测试：验证 stale 标记从 DexScreener → enrichToken → pipeline → computeConfidence 的完整链路
it('stale DexScreener data reduces confidence score', async () => {
  // 1. 构造触发 stale 的条件（API 失败 + 缓存有过期数据）
  // 2. 调用 enrichToken（或更上层的 pipeline 函数）
  // 3. 验证最终 confidence.score 包含了 stale 降分
});
```

## Why This Matters

**静默失效的代价：**
- 置信度降分在生产中 0% 工作率 — 所有告警都以高置信度推送
- 三处断路各自"不严重"（缺一个可选字段、少一行提取代码、少传一个参数），合在一起导致整条链路失效
- 56 个模块级测试全部通过，给出了虚假的安全感

**为什么模块级测试抓不到：**

```typescript
// Unit 3 子代理测试 — ✅ 通过
expect(fetchDexScreenerData(staleCase)).toHaveProperty('stale', true);

// Unit 5 子代理测试 — ✅ 通过
expect(computeConfidence(enrichment, true, { staleData: true }).score).toBe(90);

// 但没人测试这条链：
// DexScreener 返回 stale:true → enrichToken 提取 stale → pipeline 传递 options → confidence 降分
```

## When to Apply

- **特性涉及 3+ 模块边界转接**（每多一层转接，断路概率倍增）
- **新增字段到共享数据结构**（EnrichmentResult 是 6 个模块的中心枢纽）
- **函数参数扩展**（computeConfidence 从 2 参数升级到 3 参数，旧调用点被遗忘）
- **并行子代理独立开发 + 独立测试**（无跨子代理的集成验证）

## Examples

### 断路 1: 类型断路 — EnrichmentResult 缺少 stale 字段

```typescript
// Unit 3 子代理添加到 DexScreenerData
export interface DexScreenerData {
  stale?: boolean;  // ✅ 已添加
  // ...
}

// ❌ 断路：EnrichmentResult 没有对应字段
export interface EnrichmentResult {
  // ... 7 个字段 ...
  priceDeviation?: number;
  // stale 在哪里？被遗漏了
}

// ✅ 修复：同步添加
export interface EnrichmentResult {
  priceDeviation?: number;
  stale?: boolean;  // 从 DexScreenerData 提升到顶层
}
```

### 断路 2: 数据断路 — enrichToken 未提取 stale

```typescript
// ❌ 断路：dexResult.value 有 stale 但未提取
return {
  tokenSymbol: dexResult.value.tokenSymbol,
  // ... 其他字段 ...
  priceDeviation,
  // stale 未提取！
};

// ✅ 修复：显式提取
return {
  // ... 其他字段 ...
  priceDeviation,
  stale: dexResult.status === 'fulfilled' ? dexResult.value.stale : undefined,
};
```

### 断路 3: 调用断路 — pipeline.ts 未传 options

```typescript
// ❌ 断路：旧调用方式，options 未传递
const confidence = computeConfidence(enrichment, isTopWallet);

// ✅ 修复：传递 stale 和 priceDeviation
const confidence = computeConfidence(enrichment, isTopWallet, {
  staleData: enrichment.stale,
  priceDeviation: enrichment.priceDeviation,
});
```

### 附加案例: copy-paste 三元运算符 bug

```typescript
// ❌ 两个分支都读 item.from?.amount
amount: (type === 'buy' ? item.from?.amount : item.from?.amount) ?? 0

// ✅ sell 应读 item.to?.amount
amount: (type === 'buy' ? item.from?.amount : item.to?.amount) ?? 0
```

## Related

- `docs/solutions/best-practices/fire-and-forget-webhook-graceful-degradation-2026-03-31.md` — Promise.allSettled 降级模式（断路的架构背景）
- `docs/solutions/best-practices/confidence-scoring-data-trust-layer-2026-04-02.md` — 置信度评分设计（被断路影响的功能）
- `docs/solutions/best-practices/multi-layer-ai-workflow-enforcement-pattern-2026-03-31.md` — 子代理工作流纪律（可补充集成测试契约）
- `docs/solutions/runtime-errors/parseswap-helius-payload-mismatch-2026-03-31.md` — 同类"模块通过但管线静默失效"的案例

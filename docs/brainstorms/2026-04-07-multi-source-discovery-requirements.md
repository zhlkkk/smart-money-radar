---
date: 2026-04-07
topic: multi-source-discovery-architecture
---

# 多来源钱包发现 + 反向发现架构

## Problem Frame

当前发现管线只有一个数据源（Birdeye），且候选池扩充计划（2026-04-03）虽然增加了 top_traders 端点，但仍然是单一来源。这限制了：

1. **覆盖面**：Birdeye 只能发现在其平台上有交易数据的钱包，遗漏了通过其他路径活跃的聪明钱
2. **可信度判断**：没有来源维度的信息，无法区分"只被一个渠道发现"和"被多个独立渠道交叉验证"的钱包
3. **扩展性**：未来添加新来源（链上分析平台、社区 KOL）需要重构评分逻辑

目标：建立多来源候选池架构，每个来源带权重，多来源交叉验证加分。权重在 Step 1 中为静态常量，Step 2（回测反馈循环）将其替换为动态值。

## 数据流

```
每 6 小时 runCycle()
  ├─ 来源 A: Birdeye gainers-losers + top_traders（现有 + 已规划）
  │    → source: 'birdeye', defaultWeight: 0.7
  ├─ 来源 B: Helius 反向发现（新增）
  │    → source: 'helius-reverse', defaultWeight: 0.5
  ├─ 来源 C: 链上分析平台（未来）
  │    → source: 'onchain-analytics', defaultWeight: TBD
  └─ 来源 D: 社区 KOL（未来）
       → source: 'community', defaultWeight: TBD
  ↓
  合并去重 + 来源标记（每个钱包记录所有发现它的来源）
  ↓
  scoreWallets() 改造：
    基础分 = 现有 4 维度加权评分
    来源加分 = f(来源数量, 各来源权重)
    综合分 = 基础分 × (1 + 来源加分)
  ↓
  top 30 (walletCap) → 持久化 / webhook 更新
```

## Requirements

**多来源架构**

- R1. 每个钱包候选引入 `sources: SourceTag[]` 字段，记录发现该钱包的所有来源。`SourceTag` 包含 `source: string`（来源标识）、`weight: number`（来源权重，0-1）、`discoveredAt: number`（发现时间戳）。
- R2. 每个来源有一个默认静态权重，定义为命名常量（如 `SOURCE_WEIGHTS = { birdeye: 0.7, 'helius-reverse': 0.5 }`）。Step 2 可直接替换为从 DB 读取，无需在 Step 1 做抽象预留。
- R3. 同一钱包被多个来源发现时，综合评分获得加分。加分公式：`sourceBonus = sum(该钱包各来源权重) / sum(所有已实现来源权重)`，归一化到 0-1 范围。例如 Step 1 中 maxPossibleSum = 0.7 + 0.5 = 1.2。综合分 = `baseScore × (1 + sourceBonus × SOURCE_BONUS_WEIGHT)`，其中 `SOURCE_BONUS_WEIGHT` 为可配置常量。注意：添加新来源会改变 maxPossibleSum，需同步更新。

**Helius 反向发现**

- R4. 从 Helius webhook 接收的交易中，提取与已监控钱包有交互的"对手方"钱包地址。Step 1 中对手方定义限定为：同一笔 swap 交易中的另一方（从 inner instructions 中提取）。基于时间窗口的共买模式推迟到 Step 2。
- R5. 使用频率阈值触发：某个对手方钱包在最近 N 天内（可配置，默认 7 天）与 ≥M 个不同的已监控钱包在 swap 交易中出现过（可配置，默认 M=3），则标记为候选。
- R6. 反向发现的候选钱包以 `source: 'helius-reverse'` 标记，默认来源权重 0.5（低于 Birdeye 的 0.7），因为反向发现是纯行为信号，未经过 PnL/WinRate 等指标验证。
- R7. 反向发现在每次 webhook 事件处理时增量更新计数器（内存中的滑动窗口，7 天过期），在 discovery cycle 时批量输出达标候选。Step 1 接受进程重启后计数器丢失（最多损失几小时数据，6 小时后恢复正常）。

**评分改造**

- R8. `scoreWallets()` 接收带 `sources` 标记的候选列表，在现有 4 维度基础分之上叠加来源加分。
- R9. pinned 钱包的 `sources` 字段为空数组，在来源加分计算中 sourceBonus = 0，保持现有评分行为不变。

**未来来源预留**

- R10. orchestrator 中的候选来源为一个 provider 数组，每个 provider 是一个返回 `Promise<WalletCandidate[]>` 的异步函数。添加新来源只需实现一个函数并加入数组。不做插件注册系统或依赖注入。

## Success Criteria

- Helius 反向发现能在正常运行 7 天后产出 ≥10 个候选地址
- 被 2+ 来源发现的钱包评分高于仅被单一来源发现的同等基础分钱包
- pinned 钱包评分不受影响
- 添加新来源只需实现一个函数 + 加到 provider 数组

## Scope Boundaries

- 不实现链上分析平台和社区 KOL 来源（仅预留接口）
- 不实现回测反馈循环的动态权重更新（Step 2 单独规划）
- 不改变 `DISCOVERY_WALLET_CAP`（30）上限
- 不引入新的付费 API 订阅
- Birdeye top_traders 扩充（2026-04-03 需求）应作为前置依赖先完成，本文档不重复其细节

## Key Decisions

- **来源数量加分优于取最高权重**：多来源交叉验证本身就是一个强信号，被 3 个独立来源同时发现的钱包比只被 1 个来源发现的更可信。
- **频率阈值优于共买模式**：实现简单，利用现有 webhook 数据流，不需要额外的链上查询。共买模式可作为 Step 2 的增强方向。
- **反向发现默认权重低于 Birdeye**：Birdeye 来源自带 PnL/WinRate 数据已过初步验证，反向发现是纯行为信号，需要评分系统进一步验证。
- **分两步实施**：Step 1 多来源架构 + 静态权重，Step 2 回测反馈循环 + 动态权重。每步独立可交付。

## Dependencies / Assumptions

- 2026-04-03 候选池扩充需求（Birdeye top_traders）应作为前置依赖先完成，本需求基于其已提供更多 Birdeye 候选的前提
- Helius webhook 已在接收交易数据（Phase 2a 已完成），反向发现可直接复用这些数据

## Outstanding Questions

### Deferred to Planning

- [Affects R5][Technical] 反向发现的滑动窗口数据结构设计（内存 Map vs LRU，需要估算 7 天窗口的内存占用）
- [Affects R3][Technical] `SOURCE_BONUS_WEIGHT` 的合理初始值（建议 0.15-0.3 范围，planning 阶段结合现有评分分布确定）
- [Affects R4][Needs research] Helius Enhanced Transaction 中如何准确提取 swap 对手方地址（需要分析 inner instructions 结构）
- [Affects R8][Technical] 反向发现候选在现有评分框架下基础分可能极低（缺少 PnL/WinRate 数据），planning 阶段考虑是否需要 base score floor

## Next Steps

→ `/ce:plan` 进行结构化实现规划（建议先完成 2026-04-03 候选池扩充，再实施本需求）

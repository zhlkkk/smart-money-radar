---
date: 2026-04-03
topic: expand-smart-money-candidate-pool
---

# 扩充聪明钱候选池

## Problem Frame

当前发现管线的唯一数据源 `Birdeye /trader/gainers-losers?limit=10` 每次返回上限 10 个候选，这是 API 端点的硬性规格限制（非套餐限制）。

后果：
- 实时监控池：最多发现 30 个钱包（walletCap），但候选池只有 10 个，质量天花板低
- 回测管线：每组只有 3 个钱包（floor(10 × 0.3)），统计显著性不足，WARNING 频繁触发

已有的 Birdeye Starter 套餐中，`/defi/v2/tokens/top_traders` 端点提供了另一种视角：
从热门 token 维度查询活跃交易者。通过聚合多个 token 的 top trader 列表，可将候选池扩充至 100–400 个地址，
再经现有 `scoreWallets()` 打分筛选，候选质量与数量同步提升。

## 数据流

```
每 6 小时 runCycle()
  ├─ 现有：gainers-losers → 最多 10 个候选
  └─ 新增：
       动态获取热门 token（DexScreener trending，免费，已集成）
         → 失败时回落到内置备用 token 列表
       对每个 token 调用 /defi/v2/tokens/top_traders
         → 每 token 返回 top 50 交易者
       去重合并 ← 与 gainers-losers 结果合并
  ↓
  合并后候选池：100–400 个地址
  ↓
  scoreWallets()（现有，无改动）→ top 30（walletCap）
  ↓
  持久化 / webhook 更新 / DB 同步（现有，无改动）
```

## Requirements

**候选池扩充**

- R1. 在每次发现周期内，额外调用 Birdeye `/defi/v2/tokens/top_traders` 获取多个热门 token 的 top 交易者列表，与现有 `gainers-losers` 结果合并后再打分。
- R2. 所有新增候选地址去重后送入现有 `scoreWallets()` 函数，不修改评分逻辑和 `walletCap` 上限。

**动态 token 列表**

- R3. 每次发现周期优先通过 DexScreener 动态获取当前 Solana 高交易量 token（目标 8–10 个），确保 top_traders 调用覆盖当前市场热点。
- R4. 动态获取失败（超时、API 错误）时，自动回落到代码内置的备用 token 列表（覆盖 SOL、BONK、WIF、JUP 等长期高流动性 token），发现周期不中断。

**速率控制**

- R5. discovery 管线内新增专用 Birdeye rate limiter（30 rpm），所有 top_traders 调用经此 limiter 串行或受控并发执行，不与 backtest runner 的 limiter 实例混用。

**部分失败处理**

- R6. 单次 token 的 top_traders 调用失败（超时、4xx、5xx）不终止整体发现周期，已成功的结果继续参与候选池合并（`Promise.allSettled` 模式）。备用 token 列表仅在动态 token 获取步骤**完全失败**（0 个 token 成功返回）时作为补充触发。

**质量门控阈值**

- R7. 候选池扩充后，回测质量阈值同步调整：`MIN_CANDIDATES_FAIL` 升至 20（低于此数 abort），`MIN_CANDIDATES_WARN` 升至 50（低于此数打 WARNING 但继续）。

## Success Criteria

- 每次发现周期候选池达到 50+ 地址（动态获取正常时 100–400）
- 回测分组每组达到 ≥15 个钱包（candidates ≥50 时 floor(50×0.3)=15），WARNING 不再触发
- 动态 token 获取失败时管线仍能正常运行（使用备用列表）
- 现有 scoring / webhook / DB 同步逻辑零改动

## Scope Boundaries

- 不修改 `scoreWallets()` 评分逻辑和权重
- 不改变 `DISCOVERY_WALLET_CAP`（30）上限
- 不引入新的付费 API 订阅（Dune Analytics 留到下一轮）
- 不在本次实现链上自发现机制（Pump.fun 早期买入者）
- `gainers-losers` 调用继续保留，作为候选池的一部分

## Key Decisions

- **动态 token 列表优于硬编码**：市场热点 token 每周轮换，动态获取可自适应。DexScreener trending 免费且项目已集成，无额外成本。
- **失败回落到内置备用列表**：比"跳过本轮"更稳定，保证发现周期不受单点 API 故障影响。
- **Dune Analytics 延后**：P0 方案（top_traders）验证效果后再引入新依赖，避免同时上多个数据源混淆因果。

## Dependencies / Assumptions

- Birdeye Starter 套餐的 `/defi/v2/tokens/top_traders` 端点实际支持的 `limit` 参数和返回格式需在实现时确认（调研报告显示该端点全套餐可用，但未验证具体响应结构）。
- DexScreener trending API 的具体端点路径和响应格式需在实现时确认（现有集成仅使用了 `/tokens/v1/solana/{tokenMint}` 用于 enrichment）。

## Outstanding Questions

### Deferred to Planning

- [Affects R3][Needs research] DexScreener 动态热门 token 的具体可用端点（`/latest/dex/tokens/trending` 或 `/token-boosts/top/v1` 等）及响应结构——建议 planning 阶段用 curl 验证一次再设计接口。
- [Affects R1][Needs research] Birdeye `/defi/v2/tokens/top_traders` 的实际响应字段名（特别是 address/pnl/winRate 对应字段）；若缺少 winRate 相关字段，需要补偿设计（如 winRate 默认 0 或跳过该字段评分）。
- [Affects R3][Technical] 备用 token 列表需以 Solana mint 地址格式硬编码（不是 symbol），planning 阶段整理完整地址列表。
- [Affects R1][Technical] 去重在 orchestrator 层执行（Set&lt;string&gt; 按地址去重），`birdeye.ts` 新增独立的 `fetchTopTradersByToken(tokenMint)` 函数，不在 birdeye.ts 内部做多源聚合。

## Next Steps

→ `/ce:plan` 进行结构化实现规划

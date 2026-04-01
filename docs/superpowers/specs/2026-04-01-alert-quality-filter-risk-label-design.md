# Alert Quality Filter + Risk Label Design

## 目标

过滤掉不可行动的死币/垃圾币，对通过过滤的代币附加风险标签和 AI 风险评估意见，提升每条推送的信号质量。

## 1. DexScreener 数据扩展

当前 `DexScreenerData` 只包含 `liquidity`、`fdv`、`marketCap`。新增字段：

| 字段 | 类型 | 来源 |
|------|------|------|
| `volume24h` | `number \| null` | `pairs[0].volume.h24` |
| `txns24h` | `{ buys: number; sells: number } \| null` | `pairs[0].txns.h24` |
| `pairCreatedAt` | `number \| null` | `pairs[0].pairCreatedAt`（时间戳 ms） |

## 2. 过滤规则（不推送）

在 enrichment 之后、AI 摘要之前执行。命中任一条件则静默跳过：

| 条件 | 阈值 | 理由 |
|------|------|------|
| 无 DexScreener 数据 | `liquidity === null && fdv === null` | 未上 DEX，无法交易 |
| 流动性过低 | `liquidity < $5K` | 滑点过大，无法正常进出 |
| FDV 过低 | `fdv < $50K` | 死币/废弃项目 |
| 24h 交易量过低 | `volume24h < $1K` | 无人交易的死池子 |
| 池子过新 | `pairCreatedAt` 距今 < 5 分钟 | 极早期 rug-pull 高发区 |

阈值定义为模块级常量，便于后续调优。

## 3. 风险标签

对通过过滤的代币，计算综合风险等级。

### 风险因子评估矩阵

| 因子 | 🟢 低风险 | 🟡 注意 | 🔴 高风险 |
|------|----------|---------|----------|
| Mint Authority | `null`（Revoked） | — | 非 null（Active） |
| Freeze Authority | `null`（Revoked） | — | 非 null（Active） |
| 流动性 | > $100K | $5K ~ $100K | — |
| 24h 交易量 | > $50K | $1K ~ $50K | — |
| 池子年龄 | > 24h | 5 分钟 ~ 24h | — |

### 综合规则

- 有任何 🔴 因子 → `🔴 高风险`
- 有 🟡 因子但无 🔴 → `🟡 注意`
- 全部 🟢 → `🟢 低风险`

### 类型定义

```typescript
type RiskLevel = 'high' | 'medium' | 'low';

interface RiskAssessment {
  level: RiskLevel;
  label: string;        // '🔴 高风险' | '🟡 注意' | '🟢 低风险'
  factors: string[];    // 触发的风险因子描述列表
}
```

## 4. AI 摘要升级

### Prompt 改造

将 enrichment 数据（含新字段）+ 风险因子列表喂给 Claude，要求同时输出买入理由和风险提示：

```
用 <50 字中文总结这个 Solana 代币的买入理由和风险提示。
要求：先说为什么被买入，再说主要风险点。禁止废话。

代币: {symbol} ({mint})
流动性: {liquidity}
FDV: {fdv}
24h交易量: {volume24h}
24h交易笔数: {buys} buys / {sells} sells
池子创建时间: {pairAge}
买家: {walletLabel} ({walletCategory})
DEX来源: {dexSource}
Mint Authority: {mintStatus}
Freeze Authority: {freezeStatus}
风险等级: {riskLabel}
风险因子: {factors}
```

## 5. 推送格式

```
🐋 Birdeye #7 (discovered) bought SKRb...ZhW3  🔴 高风险

💰 Liq: $15.6K | FDV: $186.10M | MC: $113.08M
📊 Vol 24h: $2.3K | Txns: 15 buys / 8 sells
🔒 Mint: ⚠️ Active | Freeze: ✅ Revoked

🤖 低流动性meme币，Mint未撤销有增发风险，池子仅1小时，谨慎跟单
📌 Birdeye | DexScreener
```

变化点：
- 标题行末尾追加风险标签
- 新增 `📊 Vol 24h` 行
- AI 摘要包含风险评估意见

## 6. 改动文件

| 文件 | 改动 |
|------|------|
| `packages/shared/src/types/domain.ts` | 扩展 `DexScreenerData`、`EnrichmentResult` 类型 |
| `apps/backend/src/enrichment/dexscreener.ts` | 拉取 `volume`、`txns`、`pairCreatedAt` |
| `apps/backend/src/pipeline.ts` | 扩展过滤规则 + 新增 `assessRisk()` 函数 |
| `apps/backend/src/ai/attribution.ts` | prompt 加入风险数据和新字段 |
| `apps/backend/src/telegram/format.ts` | 新推送格式（风险标签、交易量行） |
| `apps/backend/src/types.ts` | re-export 新类型 |

## 7. 不做的事

- 不做用户自定义阈值（MVP 阶段，硬编码常量即可）
- 不做历史告警回溯过滤（只影响新推送）
- 不做前端风险展示（后续迭代）

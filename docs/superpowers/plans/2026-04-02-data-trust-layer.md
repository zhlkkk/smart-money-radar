# 数据信任层实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为每条告警增加置信度评分，改造 Telegram 消息模板展示数据源溯源，在 Dashboard 告警卡片展示置信度，在 Landing Page 添加数据方法论 section，并在侧边栏添加数据说明入口。

**Architecture:** 新增 `confidence.ts` 模块计算置信度分数（0-100），通过管线集成后将分数附加到 `AlertData`。Telegram `formatAlert` 和前端 `AlertCard` 各自消费置信度字段进行展示。Landing Page 新增一个独立 section 展示数据管线透明化信息。

**Tech Stack:** TypeScript, Vitest (TDD), Fastify (backend), Next.js + Tailwind (frontend), next-intl (i18n)

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 新建 | `apps/backend/src/enrichment/confidence.ts` | 置信度评分计算（纯函数） |
| 新建 | `apps/backend/test/enrichment/confidence.test.ts` | 置信度评分测试 |
| 修改 | `packages/shared/src/types/domain.ts` | 新增 `ConfidenceLevel` 类型和 `AlertData.confidence` 字段 |
| 修改 | `apps/backend/src/pipeline.ts` | 调用 `computeConfidence` 并传入 `formatAlert` / `alertBus` |
| 修改 | `apps/backend/test/pipeline-filter.test.ts` | 新增 `computeConfidence` 相关测试的导入验证 |
| 修改 | `apps/backend/src/telegram/format.ts` | 告警模板增加置信度行、数据源行、disclaimer |
| 修改 | `apps/backend/test/telegram/format.test.ts` | 验证新模板输出 |
| 修改 | `apps/web/src/lib/backend-client.ts` | `AlertRow` 类型新增 `confidenceScore` / `confidenceLevel` 字段 |
| 修改 | `apps/web/src/components/alert-card.tsx` | 展示置信度标签 |
| 修改 | `apps/web/messages/zh.json` | 新增置信度和方法论相关 i18n 键 |
| 修改 | `apps/web/messages/en.json` | 同上英文版 |
| 修改 | `apps/web/src/app/page.tsx` | 新增数据方法论 section |
| 修改 | `apps/web/src/components/sidebar-nav.tsx` | 新增"数据说明"导航入口 |

---

### Task 1: 共享类型 — 新增置信度字段

**Files:**
- Modify: `packages/shared/src/types/domain.ts`

- [ ] **Step 1: 在 `domain.ts` 末尾新增置信度类型和更新 `AlertData`**

在 `WalletCandidate` 接口之后、文件末尾新增：

```typescript
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceResult {
  score: number;           // 0-100
  level: ConfidenceLevel;  // high ≥ 80, medium ≥ 45, low < 45
  label: string;           // "🟢 信号强度: 高" 等
}
```

在 `AlertData` 接口中新增 `confidence` 字段：

```typescript
export interface AlertData {
  wallet: SmartMoneyWallet;
  swap: ParsedSwap;
  enrichment: EnrichmentResult;
  riskAssessment: RiskAssessment;
  aiSummary: string;
  confidence: ConfidenceResult;  // 新增
}
```

- [ ] **Step 2: 运行类型检查确认编译通过**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -20
```

预期：会有编译错误（`confidence` 缺失于现有 `AlertData` 使用处），这是正常的，Task 3 会修复。

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types/domain.ts
git commit -m "feat(shared): add ConfidenceResult type to AlertData"
```

---

### Task 2: 置信度计算模块 (TDD)

**Files:**
- Create: `apps/backend/test/enrichment/confidence.test.ts`
- Create: `apps/backend/src/enrichment/confidence.ts`

- [ ] **Step 1: 编写失败测试**

创建 `apps/backend/test/enrichment/confidence.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { computeConfidence } from '../../src/enrichment/confidence.js';
import type { EnrichmentResult } from '../../src/types.js';

const healthyEnrichment: EnrichmentResult = {
  tokenSymbol: 'BONK',
  liquidity: 200_000,
  fdv: 500_000,
  marketCap: 300_000,
  volume24h: 80_000,
  txns24h: { buys: 100, sells: 80 },
  pairCreatedAt: Date.now() - 48 * 60 * 60 * 1000,
  mintAuthority: null,
  freezeAuthority: null,
};

describe('computeConfidence', () => {
  it('returns high confidence for fully healthy data', () => {
    const result = computeConfidence(healthyEnrichment, true);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.level).toBe('high');
    expect(result.label).toContain('高');
  });

  it('returns medium when DexScreener data is partial (liquidity null)', () => {
    const result = computeConfidence(
      { ...healthyEnrichment, liquidity: null, fdv: null, marketCap: null },
      true,
    );
    expect(result.level).toBe('medium');
    expect(result.score).toBeGreaterThanOrEqual(45);
    expect(result.score).toBeLessThan(80);
  });

  it('returns low when authority is unchecked and no DexScreener data', () => {
    const result = computeConfidence(
      {
        ...healthyEnrichment,
        liquidity: null,
        fdv: null,
        marketCap: null,
        mintAuthority: 'unchecked',
        freezeAuthority: 'unchecked',
      },
      false,
    );
    expect(result.level).toBe('low');
    expect(result.score).toBeLessThan(45);
  });

  it('gives +30 for safe authorities (both null)', () => {
    const safe = computeConfidence(healthyEnrichment, true);
    const unchecked = computeConfidence(
      { ...healthyEnrichment, mintAuthority: 'unchecked', freezeAuthority: 'unchecked' },
      true,
    );
    expect(safe.score - unchecked.score).toBe(30);
  });

  it('gives +25 for complete DexScreener data', () => {
    const complete = computeConfidence(healthyEnrichment, true);
    const incomplete = computeConfidence(
      { ...healthyEnrichment, liquidity: null, fdv: null },
      true,
    );
    expect(complete.score - incomplete.score).toBe(25);
  });

  it('gives +25 for liquidity > $50K', () => {
    const highLiq = computeConfidence(healthyEnrichment, true);
    const lowLiq = computeConfidence(
      { ...healthyEnrichment, liquidity: 10_000 },
      true,
    );
    expect(highLiq.score - lowLiq.score).toBe(25);
  });

  it('gives +20 for top-tier wallet', () => {
    const top = computeConfidence(healthyEnrichment, true);
    const notTop = computeConfidence(healthyEnrichment, false);
    expect(top.score - notTop.score).toBe(20);
  });

  it('returns correct label for each level', () => {
    const high = computeConfidence(healthyEnrichment, true);
    expect(high.label).toBe('🟢 信号强度: 高');

    const medium = computeConfidence(
      { ...healthyEnrichment, liquidity: 10_000 },
      true,
    );
    expect(medium.label).toBe('🟡 信号强度: 中');

    const low = computeConfidence(
      {
        ...healthyEnrichment,
        liquidity: null,
        fdv: null,
        mintAuthority: 'unchecked',
        freezeAuthority: 'unchecked',
      },
      false,
    );
    expect(low.label).toBe('🔴 信号强度: 低');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/backend && npx vitest run test/enrichment/confidence.test.ts
```

预期：FAIL — `Cannot find module '../../src/enrichment/confidence.js'`

- [ ] **Step 3: 实现 `computeConfidence`**

创建 `apps/backend/src/enrichment/confidence.ts`：

```typescript
import type { EnrichmentResult, ConfidenceResult, ConfidenceLevel } from '../types.js';

/**
 * 计算告警置信度评分。
 *
 * 评分维度（总计 100 分）：
 * - 链上权限安全（mint + freeze 均已撤销）：+30
 * - DexScreener 数据完整（liquidity 和 fdv 非 null）：+25
 * - 流动性 > $50K：+25
 * - 钱包为高评分（已订阅钱包中 Top 20%）：+20
 */
export function computeConfidence(
  enrichment: EnrichmentResult,
  isTopWallet: boolean,
): ConfidenceResult {
  let score = 0;

  // +30: 链上权限安全
  if (enrichment.mintAuthority === null && enrichment.freezeAuthority === null) {
    score += 30;
  }

  // +25: DexScreener 数据完整
  if (enrichment.liquidity !== null && enrichment.fdv !== null) {
    score += 25;
  }

  // +25: 流动性充足
  if (enrichment.liquidity !== null && enrichment.liquidity > 50_000) {
    score += 25;
  }

  // +20: 高评分钱包
  if (isTopWallet) {
    score += 20;
  }

  const level: ConfidenceLevel = score >= 80 ? 'high' : score >= 45 ? 'medium' : 'low';

  const labelMap: Record<ConfidenceLevel, string> = {
    high: '🟢 信号强度: 高',
    medium: '🟡 信号强度: 中',
    low: '🔴 信号强度: 低',
  };

  return { score, level, label: labelMap[level] };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd apps/backend && npx vitest run test/enrichment/confidence.test.ts
```

预期：全部 PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/enrichment/confidence.ts apps/backend/test/enrichment/confidence.test.ts
git commit -m "feat(backend): add confidence scoring module with TDD"
```

---

### Task 3: 管线集成置信度

**Files:**
- Modify: `apps/backend/src/pipeline.ts`

- [ ] **Step 1: 在 `pipeline.ts` 中导入 `computeConfidence` 并集成到 `processTransaction`**

在文件顶部 import 区新增：

```typescript
import { computeConfidence } from './enrichment/confidence.js';
```

在 `processTransaction` 函数内，`assessRisk` 调用之后、`generateAttribution` 调用之前，插入置信度计算：

```typescript
    // 置信度评分
    const confidence = computeConfidence(enrichment, wallet.category === 'discovered');
```

注意：`isTopWallet` 目前用 `wallet.category === 'discovered'` 作为简化判断（discovered 钱包是经过评分筛选的）。pinned 钱包默认 `false`，因为 pinned 是手动添加的、无评分数据。

修改 `formatAlert` 调用，将 `confidence` 加入 `AlertData`：

```typescript
    const html = formatAlert({ wallet, swap, enrichment, riskAssessment, aiSummary, confidence });
```

修改 `alertBus.emit('alert', {...})` 调用，增加置信度字段：

```typescript
    alertBus.emit('alert', {
      // ... 现有字段不变 ...
      confidenceScore: confidence.score,
      confidenceLevel: confidence.level,
    });
```

修改 `persistAlert` 调用，增加 confidence：

```typescript
    const dbWrite = config.db
      ? (async () => persistAlert(config.db!, { swap, enrichment, wallet, aiSummary, confidence }))()
      : Promise.resolve(false);
```

- [ ] **Step 2: 运行类型检查**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -30
```

预期：可能有 `persistAlert` 的类型错误（它还没适配 confidence 参数）。如果 `persistAlert` 使用了展开运算符或忽略了额外字段则无错。根据结果决定是否需要修改 `persistAlert` 函数签名。

- [ ] **Step 3: 运行现有测试确认无回归**

```bash
cd apps/backend && npx vitest run
```

预期：`pipeline.test.ts` 和 `format.test.ts` 可能会失败（因为 `AlertData` 现在要求 `confidence` 字段）。这是预期的，Task 4 修复 format，之后再修复 pipeline 测试。

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/pipeline.ts
git commit -m "feat(backend): integrate confidence scoring into pipeline"
```

---

### Task 4: Telegram 告警模板改造 (TDD)

**Files:**
- Modify: `apps/backend/test/telegram/format.test.ts`
- Modify: `apps/backend/src/telegram/format.ts`

- [ ] **Step 1: 更新测试中的 `fullAlert` 和其他 fixture，添加 `confidence` 字段**

在 `format.test.ts` 中，为 `fullAlert` 添加 confidence：

```typescript
  const fullAlert: AlertData = {
    wallet: { label: 'Wintermute', category: 'DEX Whale' },
    swap: { signature: 'sig', buyerAddress: 'addr', tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', tokenSymbol: 'BONK', dexSource: 'JUPITER', timestamp: 0 },
    enrichment: {
      tokenSymbol: null,
      liquidity: 1_240_000, fdv: 6_800_000, marketCap: 3_200_000,
      volume24h: 500_000, txns24h: { buys: 1000, sells: 800 },
      pairCreatedAt: Date.now() - 30 * 24 * 3600_000,
      mintAuthority: null, freezeAuthority: null,
    },
    riskAssessment: { level: 'low', label: '🟢 低风险', factors: [] },
    aiSummary: '新 meme 叙事',
    confidence: { score: 100, level: 'high', label: '🟢 信号强度: 高' },
  };
```

同样为所有其他测试 fixture（第 74 行和第 95 行的 alert 对象）添加 `confidence` 字段。

- [ ] **Step 2: 添加新测试用例验证置信度行、数据源行和 disclaimer**

在 `describe('formatAlert', ...)` 中追加：

```typescript
  it('includes confidence label in output', () => {
    const html = formatAlert(fullAlert);
    expect(html).toContain('🟢 信号强度: 高');
  });

  it('includes data source line', () => {
    const html = formatAlert(fullAlert);
    expect(html).toContain('Helius → DexScreener → Claude');
  });

  it('includes disclaimer', () => {
    const html = formatAlert(fullAlert);
    expect(html).toContain('仅供参考');
  });

  it('shows medium confidence correctly', () => {
    const html = formatAlert({
      ...fullAlert,
      confidence: { score: 55, level: 'medium', label: '🟡 信号强度: 中' },
    });
    expect(html).toContain('🟡 信号强度: 中');
  });
```

- [ ] **Step 3: 运行测试确认失败**

```bash
cd apps/backend && npx vitest run test/telegram/format.test.ts
```

预期：新增测试 FAIL（`formatAlert` 输出中没有置信度行）

- [ ] **Step 4: 修改 `formatAlert` 实现**

将 `apps/backend/src/telegram/format.ts` 中的 `formatAlert` 替换为：

```typescript
export function formatAlert(data: AlertData): string {
  const { wallet, swap, enrichment, riskAssessment, aiSummary, confidence } = data;
  const label = escapeHtml(wallet.label);
  const category = escapeHtml(wallet.category);
  const tokenDisplay = swap.tokenSymbol ? escapeHtml(swap.tokenSymbol) : truncateMint(swap.tokenMint);
  const liq = formatUsd(enrichment.liquidity);
  const fdv = formatUsd(enrichment.fdv);
  const mc = formatUsd(enrichment.marketCap);
  const vol = formatUsd(enrichment.volume24h);
  const txns = enrichment.txns24h
    ? `${enrichment.txns24h.buys} buys / ${enrichment.txns24h.sells} sells`
    : 'N/A';
  const mintStatus = formatAuthority(enrichment.mintAuthority);
  const freezeStatus = formatAuthority(enrichment.freezeAuthority);

  const lines: string[] = [
    `🐋 <b>${label}</b> (${category}) bought <code>${tokenDisplay}</code>  ${riskAssessment.label}`,
    `📊 <b>${confidence.label}</b>`,
    '',
    `💰 Liq: <b>${liq}</b> | FDV: <b>${fdv}</b> | MC: <b>${mc}</b>`,
    `📈 Vol 24h: <b>${vol}</b> | Txns: ${txns}`,
    `🔒 Mint: ${mintStatus} | Freeze: ${freezeStatus}`,
  ];
  if (aiSummary) {
    lines.push('', `🤖 <i>${escapeHtml(aiSummary)}</i>`);
  }
  lines.push(
    '',
    `🔍 数据源: Helius → DexScreener → Claude`,
    `📌 <a href="https://birdeye.so/token/${swap.tokenMint}?chain=solana">Birdeye</a> | <a href="https://dexscreener.com/solana/${swap.tokenMint}">DexScreener</a>`,
    '',
    `<i>数据来自第三方 API，仅供参考，不构成投资建议</i>`,
  );
  return lines.join('\n');
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd apps/backend && npx vitest run test/telegram/format.test.ts
```

预期：全部 PASS

- [ ] **Step 6: 修复其他引用 `formatAlert` 的测试**

`apps/backend/test/pipeline.test.ts` 中的 mock/fixture 也需要加上 `confidence` 字段。搜索该文件中的 `AlertData` 或 `formatAlert` 调用，为所有 fixture 加上：

```typescript
confidence: { score: 100, level: 'high', label: '🟢 信号强度: 高' },
```

- [ ] **Step 7: 运行全量测试确认无回归**

```bash
cd apps/backend && npx vitest run
```

预期：全部 PASS

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/telegram/format.ts apps/backend/test/telegram/format.test.ts apps/backend/test/pipeline.test.ts apps/backend/test/pipeline-filter.test.ts
git commit -m "feat(backend): add confidence label + data source + disclaimer to Telegram alert"
```

---

### Task 5: 前端类型 + 告警卡片置信度展示

**Files:**
- Modify: `apps/web/src/lib/backend-client.ts`
- Modify: `apps/web/src/components/alert-card.tsx`
- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: 更新 `AlertRow` 类型**

在 `apps/web/src/lib/backend-client.ts` 的 `AlertRow` 接口中，在 `createdAt` 之前新增：

```typescript
  confidenceScore: number | null;
  confidenceLevel: 'high' | 'medium' | 'low' | null;
```

- [ ] **Step 2: 添加 i18n 键**

在 `apps/web/messages/zh.json` 的 `"alerts"` 对象内追加：

```json
    "confidenceHigh": "信号强度: 高",
    "confidenceMedium": "信号强度: 中",
    "confidenceLow": "信号强度: 低"
```

在 `apps/web/messages/en.json` 的 `"alerts"` 对象内追加：

```json
    "confidenceHigh": "Signal: High",
    "confidenceMedium": "Signal: Medium",
    "confidenceLow": "Signal: Low"
```

- [ ] **Step 3: 修改 `AlertCard` 展示置信度标签**

在 `apps/web/src/components/alert-card.tsx` 中，在 `Badge variant={style.variant}` 标签之后、`</div>` 之前，添加置信度 Badge：

```tsx
            {alert.confidenceLevel && (
              <Badge variant={
                alert.confidenceLevel === 'high' ? 'green' :
                alert.confidenceLevel === 'medium' ? 'gold' : 'red'
              }>
                {alert.confidenceLevel === 'high' ? t('confidenceHigh') :
                 alert.confidenceLevel === 'medium' ? t('confidenceMedium') :
                 t('confidenceLow')}
              </Badge>
            )}
```

这会在现有的风险 Badge 旁边显示一个置信度 Badge。

- [ ] **Step 4: 运行前端开发服务器确认无报错**

```bash
cd apps/web && npx next build 2>&1 | tail -20
```

预期：编译成功无错误。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/backend-client.ts apps/web/src/components/alert-card.tsx apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "feat(web): display confidence badge on alert cards"
```

---

### Task 6: Landing Page 数据方法论 Section

**Files:**
- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: 添加数据方法论 i18n 键**

在 `apps/web/messages/zh.json` 中，在 `"cta"` 对象之前插入新的顶级键：

```json
  "methodology": {
    "title": "数据管线透明化",
    "subtitle": "我们如何处理每一条告警信号",
    "step1Title": "交易监听",
    "step1Source": "Helius Enhanced Transactions",
    "step1Desc": "实时接收 Solana 链上交易事件",
    "step1What": "我们看到什么 → 链上真实发生的交易",
    "step2Title": "聪明钱识别",
    "step2Source": "Birdeye + 自研评分模型",
    "step2Desc": "PnL / 胜率 / 交易频率 / 活跃度加权",
    "step2What": "我们跟踪谁 → 持续盈利的链上交易者",
    "step3Title": "行情数据",
    "step3Source": "DexScreener API",
    "step3Desc": "流动性 / FDV / 交易量 / 池龄",
    "step3What": "代币值不值得关注 → 第三方市场数据",
    "step4Title": "安全检查",
    "step4Source": "Solana RPC 链上直查",
    "step4Desc": "Mint Authority / Freeze Authority",
    "step4What": "代币安不安全 → 链上不可伪造的事实",
    "step5Title": "AI 摘要",
    "step5Source": "Claude AI",
    "step5Desc": "< 50 字归因分析",
    "step5What": "为什么值得关注 → AI 辅助判断",
    "limitationsTitle": "我们的局限",
    "limitation1": "行情数据来自 DexScreener，可能有 1-5 分钟延迟",
    "limitation2": "聪明钱评分基于历史表现，不代表未来收益",
    "limitation3": "低流动性代币的数据可能不完整",
    "limitation4": "所有信号仅供参考，不构成投资建议"
  },
```

在 `apps/web/messages/en.json` 中同样位置插入：

```json
  "methodology": {
    "title": "Data Pipeline Transparency",
    "subtitle": "How we process every alert signal",
    "step1Title": "Transaction Monitoring",
    "step1Source": "Helius Enhanced Transactions",
    "step1Desc": "Real-time Solana on-chain transaction events",
    "step1What": "What we see → actual on-chain transactions",
    "step2Title": "Smart Money Identification",
    "step2Source": "Birdeye + Proprietary Scoring",
    "step2Desc": "PnL / Win Rate / Trade Frequency / Recency weighted",
    "step2What": "Who we track → consistently profitable traders",
    "step3Title": "Market Data",
    "step3Source": "DexScreener API",
    "step3Desc": "Liquidity / FDV / Volume / Pool Age",
    "step3What": "Is the token worth watching → third-party market data",
    "step4Title": "Security Check",
    "step4Source": "Solana RPC On-chain",
    "step4Desc": "Mint Authority / Freeze Authority",
    "step4What": "Is the token safe → on-chain verifiable facts",
    "step5Title": "AI Summary",
    "step5Source": "Claude AI",
    "step5Desc": "< 50 word attribution analysis",
    "step5What": "Why it matters → AI-assisted judgment",
    "limitationsTitle": "Our Limitations",
    "limitation1": "Market data from DexScreener may have 1-5 min delay",
    "limitation2": "Smart money scores are based on historical performance, not future returns",
    "limitation3": "Low-liquidity tokens may have incomplete data",
    "limitation4": "All signals are for reference only, not investment advice"
  },
```

- [ ] **Step 2: 在 Landing Page 添加方法论 section**

在 `apps/web/src/app/page.tsx` 中，在 CTA section（约第 570 行 `<section className="relative mx-auto max-w-6xl px-6 py-20">`）之前、Security section（约第 543 行 `<section className="mx-auto max-w-6xl px-6 py-16">`）之后，插入新 section。

首先在组件顶部的 `useTranslations` 调用区域新增：

```typescript
  const tMethod = useTranslations('methodology');
```

然后需要在 imports 区新增图标（如果尚未导入）：

```typescript
import { Radio, Cpu, BarChart3, ShieldCheck, Brain } from 'lucide-react';
```

（检查 `Radio` 和 `Brain` 是否已导入，已导入的跳过。）

插入的 section 代码：

```tsx
      {/* 数据方法论 */}
      <section id="methodology" className="border-t border-[var(--smr-glass-border)] py-20" style={{ background: 'linear-gradient(180deg, var(--smr-bg-primary) 0%, var(--smr-section-gradient-from) 50%, var(--smr-bg-primary) 100%)' }}>
        <div className="mx-auto max-w-4xl px-6">
          <AnimateOnScroll animation="fade-in">
            <div className="mb-12 text-center">
              <h2 className="mb-3 text-2xl font-bold text-smr-text md:text-3xl">
                {tMethod('title')}
              </h2>
              <p className="text-smr-text-secondary">
                {tMethod('subtitle')}
              </p>
            </div>
          </AnimateOnScroll>

          <div className="relative space-y-6">
            {/* 连接线 */}
            <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-[var(--smr-accent-cyan)]/40 via-[var(--smr-accent-green)]/40 to-[var(--smr-accent-cyan)]/40 md:left-8" />

            {[
              { icon: <Radio size={20} />, num: 1, color: 'cyan' },
              { icon: <Target size={20} />, num: 2, color: 'green' },
              { icon: <BarChart3 size={20} />, num: 3, color: 'gold' },
              { icon: <ShieldCheck size={20} />, num: 4, color: 'cyan' },
              { icon: <Brain size={20} />, num: 5, color: 'green' },
            ].map(({ icon, num, color }) => (
              <AnimateOnScroll key={num} animation="fade-in">
                <div className="relative flex gap-4 pl-2 md:pl-4">
                  <div className={`z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--smr-accent-${color})]/30 bg-[var(--smr-bg-card)] text-[var(--smr-accent-${color})]`}>
                    {icon}
                  </div>
                  <GlassCard className="flex-1 p-4">
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className="text-sm font-bold text-smr-text">
                        {tMethod(`step${num}Title`)}
                      </span>
                      <span className="font-data text-xs text-smr-text-muted">
                        {tMethod(`step${num}Source`)}
                      </span>
                    </div>
                    <p className="mb-1 text-sm text-smr-text-secondary">
                      {tMethod(`step${num}Desc`)}
                    </p>
                    <p className="text-xs text-smr-text-muted italic">
                      {tMethod(`step${num}What`)}
                    </p>
                  </GlassCard>
                </div>
              </AnimateOnScroll>
            ))}
          </div>

          {/* 局限性说明 */}
          <AnimateOnScroll animation="fade-in">
            <GlassCard className="mt-10 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-smr-text-secondary">
                <ShieldAlert size={16} className="text-[var(--smr-accent-gold)]" />
                {tMethod('limitationsTitle')}
              </h3>
              <ul className="space-y-1.5 text-xs text-smr-text-muted">
                <li>· {tMethod('limitation1')}</li>
                <li>· {tMethod('limitation2')}</li>
                <li>· {tMethod('limitation3')}</li>
                <li>· {tMethod('limitation4')}</li>
              </ul>
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>
```

注意：Tailwind 的模板字符串类名（如 `` `text-[var(--smr-accent-${color})]` ``）在 Tailwind v4 中不会被扫描。如果编译后颜色不生效，需要将动态类名改为完整的条件判断：

```tsx
const colorClassMap: Record<string, string> = {
  cyan: 'border-[var(--smr-accent-cyan)]/30 text-[var(--smr-accent-cyan)]',
  green: 'border-[var(--smr-accent-green)]/30 text-[var(--smr-accent-green)]',
  gold: 'border-[var(--smr-accent-gold)]/30 text-[var(--smr-accent-gold)]',
};
```

然后使用 `colorClassMap[color]` 替代模板字符串。实现时注意这一点。

- [ ] **Step 3: 运行前端构建确认无错误**

```bash
cd apps/web && npx next build 2>&1 | tail -20
```

预期：编译成功

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/zh.json apps/web/messages/en.json apps/web/src/app/page.tsx
git commit -m "feat(web): add data methodology transparency section to Landing Page"
```

---

### Task 7: 侧边栏数据说明入口

**Files:**
- Modify: `apps/web/src/components/sidebar-nav.tsx`
- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: 添加 i18n 键**

在 `apps/web/messages/zh.json` 的 `"sidebar"` 对象内追加：

```json
    "dataMethodology": "数据说明"
```

在 `apps/web/messages/en.json` 的 `"sidebar"` 对象内追加：

```json
    "dataMethodology": "Data Sources"
```

- [ ] **Step 2: 在侧边栏导航项中新增"数据说明"链接**

在 `apps/web/src/components/sidebar-nav.tsx` 中：

1. 在 `lucide-react` 的 import 里新增 `FileText` 图标：

```typescript
import {
  LayoutDashboard,
  Zap,
  Wallet,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
```

2. 在 `navItems` 数组末尾追加一项：

```typescript
    { label: t('dataMethodology'), href: '/#methodology', icon: <FileText size={18} /> },
```

- [ ] **Step 3: 运行前端构建确认**

```bash
cd apps/web && npx next build 2>&1 | tail -20
```

预期：编译成功

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/sidebar-nav.tsx apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "feat(web): add data methodology link to sidebar navigation"
```

---

### Task 8: 全量回归测试 + 类型检查

**Files:** 无新文件

- [ ] **Step 1: 后端全量测试**

```bash
cd apps/backend && npx vitest run
```

预期：全部 PASS

- [ ] **Step 2: 后端类型检查**

```bash
cd apps/backend && npx tsc --noEmit
```

预期：无错误

- [ ] **Step 3: 前端构建**

```bash
cd apps/web && npx next build 2>&1 | tail -30
```

预期：编译成功

- [ ] **Step 4: 全量 Lint**

```bash
pnpm --filter backend lint && pnpm --filter web lint
```

预期：无 error（warning 可接受）

- [ ] **Step 5: Commit 更新 CLAUDE.md 进度**

在 `CLAUDE.md` 的 Phase 3b 部分标记为进行中：

```bash
git add CLAUDE.md
git commit -m "docs: mark Phase 3b data trust layer as in progress"
```

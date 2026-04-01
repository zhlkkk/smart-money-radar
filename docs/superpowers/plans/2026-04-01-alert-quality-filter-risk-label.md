# Alert Quality Filter + Risk Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filter out low-quality token alerts and add risk labels + AI risk assessment to every push notification.

**Architecture:** Extend DexScreener data fetching to include volume/txns/pairAge → expand quality filter with new thresholds → add risk assessment function → feed risk data into AI prompt → update Telegram format with risk label and volume line.

**Tech Stack:** TypeScript, Vitest, DexScreener API, Claude Haiku 4.5

---

### Task 1: Extend DexScreenerData types

**Files:**
- Modify: `packages/shared/src/types/domain.ts:18-22` (DexScreenerData)
- Modify: `packages/shared/src/types/domain.ts:29-35` (EnrichmentResult)

- [ ] **Step 1: Add new fields to DexScreenerData**

```typescript
export interface DexScreenerData {
  liquidity: number | null;
  fdv: number | null;
  marketCap: number | null;
  volume24h: number | null;
  txns24h: { buys: number; sells: number } | null;
  pairCreatedAt: number | null;
}
```

- [ ] **Step 2: Add new fields to EnrichmentResult**

```typescript
export interface EnrichmentResult {
  liquidity: number | null;
  fdv: number | null;
  marketCap: number | null;
  volume24h: number | null;
  txns24h: { buys: number; sells: number } | null;
  pairCreatedAt: number | null;
  mintAuthority: string | null | 'unchecked';
  freezeAuthority: string | null | 'unchecked';
}
```

- [ ] **Step 3: Add RiskAssessment type**

Add after the `EnrichmentResult` interface:

```typescript
export type RiskLevel = 'high' | 'medium' | 'low';

export interface RiskAssessment {
  level: RiskLevel;
  label: string;
  factors: string[];
}

export interface AlertData {
  wallet: SmartMoneyWallet;
  swap: ParsedSwap;
  enrichment: EnrichmentResult;
  riskAssessment: RiskAssessment;
  aiSummary: string;
}
```

Note: `AlertData` now includes `riskAssessment`. Update the existing interface, don't create a duplicate.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/domain.ts
git commit -m "feat(types): extend DexScreenerData, EnrichmentResult, add RiskAssessment"
```

---

### Task 2: Fetch new DexScreener fields

**Files:**
- Modify: `apps/backend/src/enrichment/dexscreener.ts`
- Modify: `apps/backend/test/enrichment/dexscreener.test.ts`

- [ ] **Step 1: Write failing tests for new fields**

Add to `apps/backend/test/enrichment/dexscreener.test.ts`:

```typescript
it('extracts volume, txns, and pairCreatedAt from best pair', async () => {
  const mockResponse = [
    {
      liquidity: { usd: 500_000 },
      fdv: 10_000_000,
      marketCap: 5_000_000,
      volume: { h24: 120_000 },
      txns: { h24: { buys: 300, sells: 250 } },
      pairCreatedAt: 1711900800000,
    },
  ];
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(mockResponse), { status: 200 }),
  );
  const result = await fetchDexScreenerData('TokenMint123');
  expect(result.volume24h).toBe(120_000);
  expect(result.txns24h).toEqual({ buys: 300, sells: 250 });
  expect(result.pairCreatedAt).toBe(1711900800000);
});

it('returns null for missing volume/txns/pairCreatedAt', async () => {
  const mockResponse = [{ liquidity: { usd: 100_000 } }];
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(mockResponse), { status: 200 }),
  );
  const result = await fetchDexScreenerData('TokenMint123');
  expect(result.volume24h).toBeNull();
  expect(result.txns24h).toBeNull();
  expect(result.pairCreatedAt).toBeNull();
});
```

Also update existing tests that assert `toEqual` on the full result object to include the new null fields.

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter backend test -- test/enrichment/dexscreener.test.ts
```

Expected: FAIL — new fields not returned.

- [ ] **Step 3: Update dexscreener.ts**

Update `DexScreenerPair` interface and `fetchDexScreenerData`:

```typescript
interface DexScreenerPair {
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  volume?: { h24?: number };
  txns?: { h24?: { buys?: number; sells?: number } };
  pairCreatedAt?: number;
}

const NULL_RESULT: DexScreenerData = {
  liquidity: null, fdv: null, marketCap: null,
  volume24h: null, txns24h: null, pairCreatedAt: null,
};
```

In the return statement after finding `bestPair`:

```typescript
return {
  liquidity: bestPair.liquidity?.usd ?? null,
  fdv: bestPair.fdv ?? null,
  marketCap: bestPair.marketCap ?? null,
  volume24h: bestPair.volume?.h24 ?? null,
  txns24h: bestPair.txns?.h24?.buys != null && bestPair.txns?.h24?.sells != null
    ? { buys: bestPair.txns.h24.buys, sells: bestPair.txns.h24.sells }
    : null,
  pairCreatedAt: bestPair.pairCreatedAt ?? null,
};
```

- [ ] **Step 4: Update enrich.ts to pass through new fields**

In `apps/backend/src/enrichment/enrich.ts`, update the return object:

```typescript
return {
  liquidity: dexResult.status === 'fulfilled' ? dexResult.value.liquidity : null,
  fdv: dexResult.status === 'fulfilled' ? dexResult.value.fdv : null,
  marketCap: dexResult.status === 'fulfilled' ? dexResult.value.marketCap : null,
  volume24h: dexResult.status === 'fulfilled' ? dexResult.value.volume24h : null,
  txns24h: dexResult.status === 'fulfilled' ? dexResult.value.txns24h : null,
  pairCreatedAt: dexResult.status === 'fulfilled' ? dexResult.value.pairCreatedAt : null,
  mintAuthority: authResult.status === 'fulfilled' ? authResult.value.mintAuthority : 'unchecked',
  freezeAuthority: authResult.status === 'fulfilled' ? authResult.value.freezeAuthority : 'unchecked',
};
```

- [ ] **Step 5: Run all tests**

```bash
pnpm --filter backend test -- test/enrichment/
```

Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/enrichment/ apps/backend/test/enrichment/ packages/shared/
git commit -m "feat(enrichment): fetch volume, txns, pairCreatedAt from DexScreener"
```

---

### Task 3: Expand quality filter + add risk assessment

**Files:**
- Modify: `apps/backend/src/pipeline.ts`
- Create: `apps/backend/test/pipeline-filter.test.ts`

- [ ] **Step 1: Write failing tests for quality filter**

Create `apps/backend/test/pipeline-filter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { passesQualityFilter, assessRisk } from '../src/pipeline.js';
import type { EnrichmentResult } from '../src/types.js';

const baseEnrichment: EnrichmentResult = {
  liquidity: 200_000,
  fdv: 500_000,
  marketCap: 300_000,
  volume24h: 80_000,
  txns24h: { buys: 100, sells: 80 },
  pairCreatedAt: Date.now() - 48 * 60 * 60 * 1000, // 48h ago
  mintAuthority: null,
  freezeAuthority: null,
};

describe('passesQualityFilter', () => {
  it('passes healthy token', () => {
    expect(passesQualityFilter(baseEnrichment)).toBe(true);
  });

  it('rejects when no DexScreener data', () => {
    expect(passesQualityFilter({
      ...baseEnrichment, liquidity: null, fdv: null,
    })).toBe(false);
  });

  it('rejects low liquidity', () => {
    expect(passesQualityFilter({ ...baseEnrichment, liquidity: 3_000 })).toBe(false);
  });

  it('rejects low FDV', () => {
    expect(passesQualityFilter({ ...baseEnrichment, fdv: 30_000 })).toBe(false);
  });

  it('rejects low 24h volume', () => {
    expect(passesQualityFilter({ ...baseEnrichment, volume24h: 500 })).toBe(false);
  });

  it('rejects pool created < 5 minutes ago', () => {
    expect(passesQualityFilter({
      ...baseEnrichment, pairCreatedAt: Date.now() - 2 * 60 * 1000,
    })).toBe(false);
  });

  it('passes when volume24h is null (no data, but other fields ok)', () => {
    expect(passesQualityFilter({ ...baseEnrichment, volume24h: null })).toBe(true);
  });

  it('passes when pairCreatedAt is null', () => {
    expect(passesQualityFilter({ ...baseEnrichment, pairCreatedAt: null })).toBe(true);
  });
});

describe('assessRisk', () => {
  it('returns low risk for healthy token', () => {
    const result = assessRisk(baseEnrichment);
    expect(result.level).toBe('low');
    expect(result.label).toBe('🟢 低风险');
    expect(result.factors).toHaveLength(0);
  });

  it('returns high risk when mint authority is active', () => {
    const result = assessRisk({ ...baseEnrichment, mintAuthority: 'SomeAddr' });
    expect(result.level).toBe('high');
    expect(result.label).toBe('🔴 高风险');
    expect(result.factors).toContain('Mint Authority 未撤销');
  });

  it('returns high risk when freeze authority is active', () => {
    const result = assessRisk({ ...baseEnrichment, freezeAuthority: 'SomeAddr' });
    expect(result.level).toBe('high');
    expect(result.factors).toContain('Freeze Authority 未撤销');
  });

  it('returns medium risk for low liquidity', () => {
    const result = assessRisk({ ...baseEnrichment, liquidity: 20_000 });
    expect(result.level).toBe('medium');
    expect(result.label).toBe('🟡 注意');
  });

  it('returns medium risk for low volume', () => {
    const result = assessRisk({ ...baseEnrichment, volume24h: 5_000 });
    expect(result.level).toBe('medium');
  });

  it('returns medium risk for young pool', () => {
    const result = assessRisk({
      ...baseEnrichment, pairCreatedAt: Date.now() - 2 * 60 * 60 * 1000,
    });
    expect(result.level).toBe('medium');
  });

  it('high risk overrides medium', () => {
    const result = assessRisk({
      ...baseEnrichment, mintAuthority: 'Addr', liquidity: 20_000,
    });
    expect(result.level).toBe('high');
    expect(result.factors.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter backend test -- test/pipeline-filter.test.ts
```

Expected: FAIL — `passesQualityFilter` and `assessRisk` not exported.

- [ ] **Step 3: Implement filter + risk assessment in pipeline.ts**

Replace the existing filter constants and `passesQualityFilter` function, and add `assessRisk`. Export both functions:

```typescript
import type { EnrichmentResult, RiskAssessment } from './types.js';

// --- Quality filter thresholds ---
const MIN_LIQUIDITY = 5_000;
const MIN_FDV = 50_000;
const MIN_VOLUME_24H = 1_000;
const MIN_PAIR_AGE_MS = 5 * 60 * 1000; // 5 minutes

export function passesQualityFilter(enrichment: EnrichmentResult): boolean {
  if (enrichment.liquidity === null && enrichment.fdv === null) return false;
  if (enrichment.liquidity !== null && enrichment.liquidity < MIN_LIQUIDITY) return false;
  if (enrichment.fdv !== null && enrichment.fdv < MIN_FDV) return false;
  if (enrichment.volume24h !== null && enrichment.volume24h < MIN_VOLUME_24H) return false;
  if (enrichment.pairCreatedAt !== null && Date.now() - enrichment.pairCreatedAt < MIN_PAIR_AGE_MS) return false;
  return true;
}

// --- Risk assessment ---
export function assessRisk(enrichment: EnrichmentResult): RiskAssessment {
  const reds: string[] = [];
  const yellows: string[] = [];

  // Mint/Freeze Authority
  if (enrichment.mintAuthority !== null && enrichment.mintAuthority !== 'unchecked') {
    reds.push('Mint Authority 未撤销');
  }
  if (enrichment.freezeAuthority !== null && enrichment.freezeAuthority !== 'unchecked') {
    reds.push('Freeze Authority 未撤销');
  }

  // Liquidity
  if (enrichment.liquidity !== null) {
    if (enrichment.liquidity < 100_000) yellows.push('流动性偏低');
  }

  // 24h Volume
  if (enrichment.volume24h !== null) {
    if (enrichment.volume24h < 50_000) yellows.push('24h交易量偏低');
  }

  // Pool age
  if (enrichment.pairCreatedAt !== null) {
    const ageMs = Date.now() - enrichment.pairCreatedAt;
    if (ageMs < 24 * 60 * 60 * 1000) yellows.push('池子创建不足24h');
  }

  const factors = [...reds, ...yellows];

  if (reds.length > 0) {
    return { level: 'high', label: '🔴 高风险', factors };
  }
  if (yellows.length > 0) {
    return { level: 'medium', label: '🟡 注意', factors };
  }
  return { level: 'low', label: '🟢 低风险', factors };
}
```

Also update `processTransaction` to call `assessRisk` and pass it to `formatAlert` and `generateAttribution`:

```typescript
const enrichment = await enrichToken(swap.tokenMint, config.rpc);

if (!passesQualityFilter(enrichment)) return;

const riskAssessment = assessRisk(enrichment);

const aiSummary = await generateAttribution(
  {
    tokenSymbol: swap.tokenSymbol,
    tokenMint: swap.tokenMint,
    liquidity: enrichment.liquidity,
    fdv: enrichment.fdv,
    volume24h: enrichment.volume24h,
    txns24h: enrichment.txns24h,
    pairCreatedAt: enrichment.pairCreatedAt,
    walletLabel: wallet.label,
    walletCategory: wallet.category,
    dexSource: swap.dexSource,
    mintAuthority: enrichment.mintAuthority,
    freezeAuthority: enrichment.freezeAuthority,
    riskLabel: riskAssessment.label,
    riskFactors: riskAssessment.factors,
  },
  config.anthropicClient,
);

const html = formatAlert({ wallet, swap, enrichment, riskAssessment, aiSummary });
```

- [ ] **Step 4: Run filter tests**

```bash
pnpm --filter backend test -- test/pipeline-filter.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/pipeline.ts apps/backend/test/pipeline-filter.test.ts
git commit -m "feat(pipeline): expanded quality filter + risk assessment function"
```

---

### Task 4: Update AI attribution prompt

**Files:**
- Modify: `apps/backend/src/ai/attribution.ts`
- Modify: `apps/backend/test/ai/attribution.test.ts`

- [ ] **Step 1: Update AttributionInput interface and buildPrompt**

```typescript
export interface AttributionInput {
  tokenSymbol?: string;
  tokenMint: string;
  liquidity: number | null;
  fdv: number | null;
  volume24h: number | null;
  txns24h: { buys: number; sells: number } | null;
  pairCreatedAt: number | null;
  walletLabel: string;
  walletCategory: string;
  dexSource: string;
  mintAuthority: string | null | 'unchecked';
  freezeAuthority: string | null | 'unchecked';
  riskLabel: string;
  riskFactors: string[];
}
```

Update `formatValue` to also handle the new fields, and update `buildPrompt`:

```typescript
function formatAge(pairCreatedAt: number | null): string {
  if (pairCreatedAt === null) return 'N/A';
  const ageMs = Date.now() - pairCreatedAt;
  const hours = Math.floor(ageMs / 3_600_000);
  if (hours < 1) return `${Math.floor(ageMs / 60_000)}分钟`;
  if (hours < 24) return `${hours}小时`;
  return `${Math.floor(hours / 24)}天`;
}

function formatAuthStatus(value: string | null | 'unchecked'): string {
  if (value === null) return 'Revoked';
  if (value === 'unchecked') return 'Unchecked';
  return 'Active';
}

function buildPrompt(input: AttributionInput): string {
  const txnsStr = input.txns24h
    ? `${input.txns24h.buys} buys / ${input.txns24h.sells} sells`
    : 'N/A';

  return `用 <50 字中文总结这个 Solana 代币的买入理由和风险提示。
要求：先说为什么被买入，再说主要风险点。禁止废话。

代币: ${input.tokenSymbol ?? 'Unknown'} (${input.tokenMint})
流动性: ${formatValue(input.liquidity)}
FDV: ${formatValue(input.fdv)}
24h交易量: ${formatValue(input.volume24h)}
24h交易笔数: ${txnsStr}
池子年龄: ${formatAge(input.pairCreatedAt)}
买家: ${input.walletLabel} (${input.walletCategory})
DEX来源: ${input.dexSource}
Mint Authority: ${formatAuthStatus(input.mintAuthority)}
Freeze Authority: ${formatAuthStatus(input.freezeAuthority)}
风险等级: ${input.riskLabel}
风险因子: ${input.riskFactors.length > 0 ? input.riskFactors.join('、') : '无'}`;
}
```

- [ ] **Step 2: Update existing attribution tests**

Update the test mock input to include new fields, verify prompt contains risk data.

- [ ] **Step 3: Run tests**

```bash
pnpm --filter backend test -- test/ai/attribution.test.ts
```

Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/ai/attribution.ts apps/backend/test/ai/attribution.test.ts
git commit -m "feat(ai): include risk data and volume in attribution prompt"
```

---

### Task 5: Update Telegram format

**Files:**
- Modify: `apps/backend/src/telegram/format.ts`
- Modify: `apps/backend/test/telegram/format.test.ts`

- [ ] **Step 1: Write failing test for new format**

Add to `apps/backend/test/telegram/format.test.ts`:

```typescript
it('renders risk label and volume line', () => {
  const alert: AlertData = {
    wallet: { label: 'Birdeye #3', category: 'discovered' },
    swap: { signature: 'sig', buyerAddress: 'addr', tokenMint: 'MintAddr1234567890abcdef', tokenSymbol: 'PEPE', dexSource: 'RAYDIUM', timestamp: 0 },
    enrichment: {
      liquidity: 15_600, fdv: 186_100_000, marketCap: 113_080_000,
      volume24h: 2_300, txns24h: { buys: 15, sells: 8 },
      pairCreatedAt: Date.now() - 3600_000,
      mintAuthority: 'SomeAddr', freezeAuthority: null,
    },
    riskAssessment: { level: 'high', label: '🔴 高风险', factors: ['Mint Authority 未撤销', '流动性偏低'] },
    aiSummary: '低流动性meme币，Mint未撤销有增发风险',
  };
  const html = formatAlert(alert);
  expect(html).toContain('🔴 高风险');
  expect(html).toContain('Vol 24h');
  expect(html).toContain('Txns: 15 buys / 8 sells');
  expect(html).toContain('$2.3K');
});

it('renders green risk label', () => {
  const alert: AlertData = {
    wallet: { label: 'Whale', category: 'Smart Money' },
    swap: { signature: 'sig', buyerAddress: 'addr', tokenMint: 'Mint12345678', tokenSymbol: 'SOL', dexSource: 'JUPITER', timestamp: 0 },
    enrichment: {
      liquidity: 500_000, fdv: 10_000_000, marketCap: 5_000_000,
      volume24h: 200_000, txns24h: { buys: 500, sells: 400 },
      pairCreatedAt: Date.now() - 7 * 24 * 3600_000,
      mintAuthority: null, freezeAuthority: null,
    },
    riskAssessment: { level: 'low', label: '🟢 低风险', factors: [] },
    aiSummary: '主流代币，流动性充足',
  };
  const html = formatAlert(alert);
  expect(html).toContain('🟢 低风险');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter backend test -- test/telegram/format.test.ts
```

Expected: FAIL — format doesn't include risk label or volume line.

- [ ] **Step 3: Update formatAlert**

```typescript
export function formatAlert(data: AlertData): string {
  const { wallet, swap, enrichment, riskAssessment, aiSummary } = data;
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
    '',
    `💰 Liq: <b>${liq}</b> | FDV: <b>${fdv}</b> | MC: <b>${mc}</b>`,
    `📊 Vol 24h: <b>${vol}</b> | Txns: ${txns}`,
    `🔒 Mint: ${mintStatus} | Freeze: ${freezeStatus}`,
  ];
  if (aiSummary) {
    lines.push('', `🤖 <i>${escapeHtml(aiSummary)}</i>`);
  }
  lines.push('', `📌 <a href="https://birdeye.so/token/${swap.tokenMint}?chain=solana">Birdeye</a> | <a href="https://dexscreener.com/solana/${swap.tokenMint}">DexScreener</a>`);
  return lines.join('\n');
}
```

- [ ] **Step 4: Fix existing format tests**

Update `fullAlert` fixture in existing tests to include `riskAssessment` and new enrichment fields:

```typescript
const fullAlert: AlertData = {
  wallet: { label: 'Wintermute', category: 'DEX Whale' },
  swap: { signature: 'sig', buyerAddress: 'addr', tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', tokenSymbol: 'BONK', dexSource: 'JUPITER', timestamp: 0 },
  enrichment: {
    liquidity: 1_240_000, fdv: 6_800_000, marketCap: 3_200_000,
    volume24h: 500_000, txns24h: { buys: 1000, sells: 800 },
    pairCreatedAt: Date.now() - 30 * 24 * 3600_000,
    mintAuthority: null, freezeAuthority: null,
  },
  riskAssessment: { level: 'low', label: '🟢 低风险', factors: [] },
  aiSummary: '新 meme 叙事',
};
```

- [ ] **Step 5: Run all format tests**

```bash
pnpm --filter backend test -- test/telegram/format.test.ts
```

Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/telegram/format.ts apps/backend/test/telegram/format.test.ts
git commit -m "feat(telegram): add risk label and volume line to alert format"
```

---

### Task 6: Update pipeline tests + fix type re-exports

**Files:**
- Modify: `apps/backend/test/pipeline.test.ts`
- Modify: `apps/backend/src/types.ts`

- [ ] **Step 1: Update types.ts re-exports**

Add `RiskLevel` and `RiskAssessment` to the re-export list:

```typescript
export type {
  SmartMoneyWallet,
  ParsedSwap,
  DexScreenerData,
  AuthorityData,
  EnrichmentResult,
  RiskLevel,
  RiskAssessment,
  WalletState,
  WalletStateRef,
  AlertData,
  WalletCandidate,
} from '@radar/shared';
```

- [ ] **Step 2: Update pipeline.test.ts enrichment mocks**

All `enrichToken` mocks need the new fields. Update `setupSwapMocks`:

```typescript
vi.mocked(enrichToken).mockResolvedValueOnce({
  liquidity: 1_000_000, fdv: 10_000_000, marketCap: 5_000_000,
  volume24h: 500_000, txns24h: { buys: 1000, sells: 800 },
  pairCreatedAt: Date.now() - 30 * 24 * 3600_000,
  mintAuthority: null, freezeAuthority: null,
});
```

Update all other `enrichToken` mocks in the file similarly. The test for "sends alert even with empty AI summary" that used all-null enrichment should now be filtered out by the quality filter, so update it to use valid enrichment values:

```typescript
vi.mocked(enrichToken).mockResolvedValueOnce({
  liquidity: 200_000, fdv: 500_000, marketCap: 300_000,
  volume24h: 50_000, txns24h: { buys: 100, sells: 80 },
  pairCreatedAt: Date.now() - 48 * 3600_000,
  mintAuthority: 'unchecked', freezeAuthority: 'unchecked',
});
```

Update `formatAlert` mock calls to expect `riskAssessment` in the `AlertData`.

- [ ] **Step 3: Run all pipeline tests**

```bash
pnpm --filter backend test -- test/pipeline
```

Expected: ALL PASS

- [ ] **Step 4: Run full test suite**

```bash
pnpm --filter backend test
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/types.ts apps/backend/test/pipeline.test.ts
git commit -m "fix(tests): update pipeline tests and type re-exports for risk assessment"
```

---

### Task 7: Final integration verification

- [ ] **Step 1: Run full test suite**

```bash
pnpm --filter backend test
```

Expected: ALL PASS

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Verify in production**

After Railway deploys, observe Telegram alerts for:
- Low-quality tokens no longer appear
- Risk label (🔴🟡🟢) on each alert title
- Volume line (📊) present
- AI summary includes risk assessment

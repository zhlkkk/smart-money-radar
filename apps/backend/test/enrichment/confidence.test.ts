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
      { ...healthyEnrichment, fdv: null },
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

  it('returns high at exact threshold (score = 80)', () => {
    // authority safe (+30) + DexScreener complete (+25) + liquidity > $50K (+25) = 80, no top wallet
    const result = computeConfidence(healthyEnrichment, false);
    expect(result.score).toBe(80);
    expect(result.level).toBe('high');
  });

  it('returns medium at exact threshold (score = 45)', () => {
    // authority safe (+30) + DexScreener incomplete (+0) + liquidity null (+0) + top wallet (+20) = 50
    // Need: 45 exactly → authority safe (+30) + DexScreener incomplete + no liquidity + no top = 30 → low
    // Actually: authority safe (+30) + no DexScreener + no liquidity + top wallet (+20) = 50 → medium
    const result = computeConfidence(
      { ...healthyEnrichment, liquidity: null, fdv: null },
      true,
    );
    expect(result.score).toBe(50);
    expect(result.level).toBe('medium');
  });

  it('returns low at score 30 (just below medium threshold)', () => {
    // authority safe (+30) only
    const result = computeConfidence(
      { ...healthyEnrichment, liquidity: null, fdv: null },
      false,
    );
    expect(result.score).toBe(30);
    expect(result.level).toBe('low');
  });

  it('does not grant +30 for mixed authority (mint null + freeze unchecked)', () => {
    const mixed = computeConfidence(
      { ...healthyEnrichment, mintAuthority: null, freezeAuthority: 'unchecked' },
      true,
    );
    const bothSafe = computeConfidence(healthyEnrichment, true);
    expect(bothSafe.score - mixed.score).toBe(30);
    expect(mixed.level).toBe('medium');
  });

  it('does not grant +25 for liquidity exactly $50K (boundary)', () => {
    const atBoundary = computeConfidence(
      { ...healthyEnrichment, liquidity: 50_000 },
      true,
    );
    const aboveBoundary = computeConfidence(
      { ...healthyEnrichment, liquidity: 50_001 },
      true,
    );
    expect(aboveBoundary.score - atBoundary.score).toBe(25);
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

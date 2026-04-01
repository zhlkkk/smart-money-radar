import { describe, it, expect } from 'vitest';
import { passesQualityFilter, assessRisk } from '../src/pipeline.js';
import type { EnrichmentResult } from '../src/types.js';

const baseEnrichment: EnrichmentResult = {
  liquidity: 200_000,
  fdv: 500_000,
  marketCap: 300_000,
  volume24h: 80_000,
  txns24h: { buys: 100, sells: 80 },
  pairCreatedAt: Date.now() - 48 * 60 * 60 * 1000,
  mintAuthority: null,
  freezeAuthority: null,
};

describe('passesQualityFilter', () => {
  it('passes healthy token', () => {
    expect(passesQualityFilter(baseEnrichment)).toBe(true);
  });

  it('rejects when no DexScreener data', () => {
    expect(passesQualityFilter({ ...baseEnrichment, liquidity: null, fdv: null })).toBe(false);
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
    expect(passesQualityFilter({ ...baseEnrichment, pairCreatedAt: Date.now() - 2 * 60 * 1000 })).toBe(false);
  });

  it('passes when volume24h is null', () => {
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
    const result = assessRisk({ ...baseEnrichment, pairCreatedAt: Date.now() - 2 * 60 * 60 * 1000 });
    expect(result.level).toBe('medium');
  });

  it('high risk overrides medium', () => {
    const result = assessRisk({ ...baseEnrichment, mintAuthority: 'Addr', liquidity: 20_000 });
    expect(result.level).toBe('high');
    expect(result.factors.length).toBeGreaterThanOrEqual(2);
  });
});

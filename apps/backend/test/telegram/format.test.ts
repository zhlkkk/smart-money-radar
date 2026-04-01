import { describe, it, expect } from 'vitest';
import { formatAlert, escapeHtml, formatUsd, formatAuthority, truncateMint } from '../../src/telegram/format.js';
import type { AlertData } from '../../src/types.js';

describe('escapeHtml', () => {
  it('escapes special chars', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
  it('passes through normal text', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

describe('formatUsd', () => {
  it('formats billions', () => { expect(formatUsd(1_500_000_000)).toBe('$1.5B'); });
  it('formats millions', () => { expect(formatUsd(1_240_000)).toBe('$1.24M'); });
  it('formats thousands', () => { expect(formatUsd(52_300)).toBe('$52.3K'); });
  it('formats small values', () => { expect(formatUsd(999)).toBe('$999'); });
  it('returns N/A for null', () => { expect(formatUsd(null)).toBe('N/A'); });
});

describe('formatAuthority', () => {
  it('shows revoked for null', () => { expect(formatAuthority(null)).toBe('✅ Revoked'); });
  it('shows active for address', () => { expect(formatAuthority('Addr')).toBe('⚠️ Active'); });
  it('shows unchecked', () => { expect(formatAuthority('unchecked')).toBe('❓ Unchecked'); });
});

describe('truncateMint', () => {
  it('truncates long addresses', () => { expect(truncateMint('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')).toBe('DezX...B263'); });
  it('returns short strings as-is', () => { expect(truncateMint('SHORT')).toBe('SHORT'); });
});

describe('formatAlert', () => {
  const fullAlert: AlertData = {
    wallet: { label: 'Wintermute', category: 'DEX Whale' },
    swap: { signature: 'sig', buyerAddress: 'addr', tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', tokenSymbol: 'BONK', dexSource: 'JUPITER', timestamp: 0 },
    enrichment: { liquidity: 1_240_000, fdv: 6_800_000, marketCap: 3_200_000, mintAuthority: null, freezeAuthority: null },
    aiSummary: '新 meme 叙事',
  };

  it('renders full alert', () => {
    const html = formatAlert(fullAlert);
    expect(html).toContain('<b>Wintermute</b>');
    expect(html).toContain('<code>BONK</code>');
    expect(html).toContain('$1.24M');
    expect(html).toContain('✅ Revoked');
    expect(html).toContain('<i>新 meme 叙事</i>');
    expect(html).toContain('href="https://birdeye.so/token/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263?chain=solana"');
  });

  it('omits AI line when empty', () => {
    const html = formatAlert({ ...fullAlert, aiSummary: '' });
    expect(html).not.toContain('🤖');
  });

  it('uses truncated mint when no symbol', () => {
    const html = formatAlert({ ...fullAlert, swap: { ...fullAlert.swap, tokenSymbol: undefined } });
    expect(html).toContain('<code>DezX...B263</code>');
  });

  it('escapes HTML in dynamic values', () => {
    const html = formatAlert({ ...fullAlert, wallet: { label: '<b>Evil</b>', category: 'Hacker' }, aiSummary: '<script>' });
    expect(html).toContain('&lt;b&gt;Evil&lt;/b&gt;');
    expect(html).not.toContain('<script>');
  });
});

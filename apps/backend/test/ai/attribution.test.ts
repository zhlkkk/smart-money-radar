import { describe, it, expect, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: vi.fn() },
    })),
  };
});

vi.mock('../../src/enrichment/enrich.js', () => ({
  withTimeout: vi.fn((p: Promise<any>) => p),
}));

import Anthropic from '@anthropic-ai/sdk';
import { generateAttribution, type AttributionInput } from '../../src/ai/attribution.js';

const input: AttributionInput = {
  tokenSymbol: 'BONK',
  tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  liquidity: 1_200_000,
  fdv: 10_000_000,
  volume24h: 500_000,
  txns24h: { buys: 120, sells: 80 },
  pairCreatedAt: Date.now() - 3 * 24 * 3_600_000, // 3 天前
  walletLabel: 'Wintermute',
  walletCategory: 'DEX Whale',
  dexSource: 'JUPITER',
  mintAuthority: null,
  freezeAuthority: 'unchecked',
  riskLabel: '中风险',
  riskFactors: ['流动性低于 $500K', '池子年龄不足 7 天'],
};

describe('generateAttribution', () => {
  it('returns AI summary on success', async () => {
    const mockClient = new Anthropic();
    vi.mocked(mockClient.messages.create).mockResolvedValueOnce({
      content: [{ type: 'text', text: '新 meme 叙事，社区热度暴增' }],
    } as any);
    const result = await generateAttribution(input, mockClient);
    expect(result).toBe('新 meme 叙事，社区热度暴增');
    expect(mockClient.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001', max_tokens: 100 }),
    );
  });

  it('returns empty string on API error', async () => {
    const mockClient = new Anthropic();
    vi.mocked(mockClient.messages.create).mockRejectedValueOnce(new Error('rate limit'));
    const result = await generateAttribution(input, mockClient);
    expect(result).toBe('');
  });

  it('returns empty string on timeout', async () => {
    const mockClient = new Anthropic();
    vi.mocked(mockClient.messages.create).mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 50)),
    );
    const result = await generateAttribution(input, mockClient);
    expect(result).toBe('');
  });

  it('prompt contains risk data', async () => {
    const mockClient = new Anthropic();
    vi.mocked(mockClient.messages.create).mockResolvedValueOnce({
      content: [{ type: 'text', text: '风险测试摘要' }],
    } as any);
    await generateAttribution(input, mockClient);
    const callArg = vi.mocked(mockClient.messages.create).mock.calls[0][0] as any;
    const promptContent = callArg.messages[0].content as string;
    expect(promptContent).toContain('风险等级: 中风险');
    expect(promptContent).toContain('流动性低于 $500K');
    expect(promptContent).toContain('池子年龄不足 7 天');
    expect(promptContent).toContain('Mint Authority: Revoked');
    expect(promptContent).toContain('Freeze Authority: Unchecked');
    expect(promptContent).toContain('24h交易笔数: 120 buys / 80 sells');
  });

  it('handles null optional fields gracefully', async () => {
    const mockClient = new Anthropic();
    vi.mocked(mockClient.messages.create).mockResolvedValueOnce({
      content: [{ type: 'text', text: '空字段摘要' }],
    } as any);
    const minimalInput: AttributionInput = {
      tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      liquidity: null,
      fdv: null,
      volume24h: null,
      txns24h: null,
      pairCreatedAt: null,
      walletLabel: 'Unknown',
      walletCategory: 'Unknown',
      dexSource: 'RAYDIUM',
      mintAuthority: 'unchecked',
      freezeAuthority: 'unchecked',
      riskLabel: '低风险',
      riskFactors: [],
    };
    await generateAttribution(minimalInput, mockClient);
    const callArg = vi.mocked(mockClient.messages.create).mock.calls[0][0] as any;
    const promptContent = callArg.messages[0].content as string;
    expect(promptContent).toContain('流动性: N/A');
    expect(promptContent).toContain('24h交易笔数: N/A');
    expect(promptContent).toContain('池子年龄: N/A');
    expect(promptContent).toContain('风险因子: 无');
  });
});

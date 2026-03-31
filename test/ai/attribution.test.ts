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
  walletLabel: 'Wintermute',
  walletCategory: 'DEX Whale',
  dexSource: 'JUPITER',
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
      expect.objectContaining({ model: 'claude-3-5-haiku-latest', max_tokens: 100 }),
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
});

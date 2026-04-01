import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateAttribution, type AttributionInput, type LLMConfig } from '../../src/ai/attribution.js';

const llmConfig: LLMConfig = {
  apiKey: 'test-key',
  baseURL: 'https://api.test.ai/v1',
  model: 'test-model',
};

const input: AttributionInput = {
  tokenSymbol: 'BONK',
  tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  liquidity: 1_200_000,
  fdv: 10_000_000,
  volume24h: 500_000,
  txns24h: { buys: 120, sells: 80 },
  pairCreatedAt: Date.now() - 3 * 24 * 3_600_000,
  walletLabel: 'Wintermute',
  walletCategory: 'DEX Whale',
  dexSource: 'JUPITER',
  mintAuthority: null,
  freezeAuthority: 'unchecked',
  riskLabel: '中风险',
  riskFactors: ['流动性低于 $500K', '池子年龄不足 7 天'],
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockSuccessResponse(text: string) {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify({
      choices: [{ message: { content: text } }],
    }), { status: 200 }),
  );
}

describe('generateAttribution', () => {
  it('returns AI summary on success', async () => {
    mockSuccessResponse('新 meme 叙事，社区热度暴增');
    const result = await generateAttribution(input, llmConfig);
    expect(result).toBe('新 meme 叙事，社区热度暴增');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.test.ai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-key',
        }),
      }),
    );

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.model).toBe('test-model');
    expect(body.max_tokens).toBe(100);
  });

  it('returns empty string on API error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('rate limited', { status: 429 }),
    );
    const result = await generateAttribution(input, llmConfig);
    expect(result).toBe('');
  });

  it('returns empty string on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network error'));
    const result = await generateAttribution(input, llmConfig);
    expect(result).toBe('');
  });

  it('prompt contains risk data', async () => {
    mockSuccessResponse('风险测试摘要');
    await generateAttribution(input, llmConfig);

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    const prompt = body.messages[0].content as string;
    expect(prompt).toContain('风险等级: 中风险');
    expect(prompt).toContain('流动性低于 $500K');
    expect(prompt).toContain('池子年龄不足 7 天');
    expect(prompt).toContain('Mint Authority: Revoked');
    expect(prompt).toContain('Freeze Authority: Unchecked');
    expect(prompt).toContain('24h交易笔数: 120 buys / 80 sells');
  });

  it('handles null optional fields gracefully', async () => {
    mockSuccessResponse('空字段摘要');
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
    await generateAttribution(minimalInput, llmConfig);

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    const prompt = body.messages[0].content as string;
    expect(prompt).toContain('流动性: N/A');
    expect(prompt).toContain('24h交易笔数: N/A');
    expect(prompt).toContain('池子年龄: N/A');
    expect(prompt).toContain('风险因子: 无');
  });
});

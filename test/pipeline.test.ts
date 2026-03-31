import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/webhook/parse.js', () => ({
  parseSwap: vi.fn(),
}));

vi.mock('../src/enrichment/enrich.js', () => ({
  enrichToken: vi.fn(),
  withTimeout: vi.fn((p: Promise<any>) => p),
}));

vi.mock('../src/ai/attribution.js', () => ({
  generateAttribution: vi.fn(),
}));

vi.mock('../src/telegram/format.js', () => ({
  formatAlert: vi.fn(),
}));

vi.mock('../src/telegram/bot.js', () => ({
  sendAlert: vi.fn(),
}));

import { createPipeline } from '../src/pipeline.js';
import { parseSwap } from '../src/webhook/parse.js';
import { enrichToken } from '../src/enrichment/enrich.js';
import { generateAttribution } from '../src/ai/attribution.js';
import { formatAlert } from '../src/telegram/format.js';
import { sendAlert } from '../src/telegram/bot.js';
import { createWalletState } from '../src/types.js';
import type { HeliusEnhancedTransaction, WalletStateRef } from '../src/types.js';
import swapFixture from './fixtures/swap-event.json' with { type: 'json' };

describe('Pipeline', () => {
  let pipeline: ReturnType<typeof createPipeline>;
  let walletStateRef: WalletStateRef;

  beforeEach(() => {
    vi.clearAllMocks();
    walletStateRef = {
      current: createWalletState(
        new Map([
          ['7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB', { label: 'Wintermute', category: 'DEX Whale' }],
        ]),
      ),
    };
    pipeline = createPipeline({
      walletStateRef,
      rpc: {} as unknown,
      anthropicClient: {} as unknown,
      botToken: '123:ABC',
      channelId: '-100999',
    });
  });

  it('processes a valid swap end-to-end', async () => {
    vi.mocked(parseSwap).mockReturnValueOnce({
      signature: 'sig1',
      buyerAddress: '7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB',
      tokenMint: 'TokenMint123',
      tokenSymbol: 'BONK',
      dexSource: 'JUPITER',
      timestamp: 1711900800,
    });
    vi.mocked(enrichToken).mockResolvedValueOnce({
      liquidity: 1_000_000, fdv: 10_000_000, marketCap: 5_000_000,
      mintAuthority: null, freezeAuthority: null,
    });
    vi.mocked(generateAttribution).mockResolvedValueOnce('AI summary');
    vi.mocked(formatAlert).mockReturnValueOnce('<b>formatted</b>');
    vi.mocked(sendAlert).mockResolvedValueOnce(undefined);

    await pipeline.processTransaction(swapFixture as HeliusEnhancedTransaction);

    expect(parseSwap).toHaveBeenCalledOnce();
    expect(enrichToken).toHaveBeenCalledWith('TokenMint123', expect.anything());
    expect(generateAttribution).toHaveBeenCalledOnce();
    expect(sendAlert).toHaveBeenCalledWith('<b>formatted</b>', '123:ABC', '-100999');
  });

  it('skips non-SWAP transactions', async () => {
    vi.mocked(parseSwap).mockReturnValueOnce(null);
    await pipeline.processTransaction(swapFixture as HeliusEnhancedTransaction);
    expect(enrichToken).not.toHaveBeenCalled();
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('skips when wallet not in watchlist', async () => {
    vi.mocked(parseSwap).mockReturnValueOnce({
      signature: 'sig1',
      buyerAddress: 'UnknownWallet1111111111111111111111111111',
      tokenMint: 'Mint', dexSource: 'JUPITER', timestamp: 0,
    });
    await pipeline.processTransaction(swapFixture as HeliusEnhancedTransaction);
    expect(enrichToken).not.toHaveBeenCalled();
  });

  it('sends alert even with empty AI summary', async () => {
    vi.mocked(parseSwap).mockReturnValueOnce({
      signature: 'sig1',
      buyerAddress: '7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB',
      tokenMint: 'Mint', dexSource: 'JUPITER', timestamp: 0,
    });
    vi.mocked(enrichToken).mockResolvedValueOnce({
      liquidity: null, fdv: null, marketCap: null,
      mintAuthority: 'unchecked', freezeAuthority: 'unchecked',
    });
    vi.mocked(generateAttribution).mockResolvedValueOnce('');
    vi.mocked(formatAlert).mockReturnValueOnce('<b>degraded</b>');
    vi.mocked(sendAlert).mockResolvedValueOnce(undefined);

    await pipeline.processTransaction(swapFixture as HeliusEnhancedTransaction);

    expect(formatAlert).toHaveBeenCalledWith(expect.objectContaining({ aiSummary: '' }));
    expect(sendAlert).toHaveBeenCalledOnce();
  });

  it('picks up a newly added wallet after swapping walletStateRef.current', async () => {
    const newWalletAddress = 'NewWallet1111111111111111111111111111111111';
    // Swap in new state that includes the new wallet
    walletStateRef.current = createWalletState(
      new Map([
        ['7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB', { label: 'Wintermute', category: 'DEX Whale' }],
        [newWalletAddress, { label: 'NewWhale', category: 'Fresh Wallet' }],
      ]),
    );

    vi.mocked(parseSwap).mockReturnValueOnce({
      signature: 'sig-new',
      buyerAddress: newWalletAddress,
      tokenMint: 'MintNew',
      dexSource: 'RAYDIUM',
      timestamp: 1711900900,
    });
    vi.mocked(enrichToken).mockResolvedValueOnce({
      liquidity: 500_000, fdv: 2_000_000, marketCap: 1_000_000,
      mintAuthority: null, freezeAuthority: null,
    });
    vi.mocked(generateAttribution).mockResolvedValueOnce('New whale summary');
    vi.mocked(formatAlert).mockReturnValueOnce('<b>new wallet alert</b>');
    vi.mocked(sendAlert).mockResolvedValueOnce(undefined);

    await pipeline.processTransaction(swapFixture as HeliusEnhancedTransaction);

    expect(enrichToken).toHaveBeenCalledWith('MintNew', expect.anything());
    expect(sendAlert).toHaveBeenCalledOnce();
  });

  it('rejects transactions from a wallet removed from state', async () => {
    // Swap in empty state — removes all wallets
    walletStateRef.current = createWalletState(new Map());

    vi.mocked(parseSwap).mockReturnValueOnce({
      signature: 'sig-removed',
      buyerAddress: '7xKXtRQpkjR5E9aFbNdWAqFTgBZm8PqVGn8VfJdXKNYB',
      tokenMint: 'Mint',
      dexSource: 'JUPITER',
      timestamp: 0,
    });

    await pipeline.processTransaction(swapFixture as HeliusEnhancedTransaction);

    expect(enrichToken).not.toHaveBeenCalled();
    expect(sendAlert).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDiscovery } from '../../src/discovery/orchestrator.js';
import type { SmartMoneyWallet, WalletStateRef } from '../../src/types.js';
import { createWalletState } from '../../src/types.js';

// Mock all dependencies
vi.mock('../../src/discovery/birdeye.js', () => ({
  fetchTopWallets: vi.fn(),
}));

vi.mock('../../src/discovery/helius-webhooks.js', () => ({
  updateHeliusWebhookAddresses: vi.fn(),
}));

vi.mock('../../src/discovery/persistence.js', () => ({
  loadDiscoveryState: vi.fn().mockReturnValue(null),
  saveDiscoveryState: vi.fn().mockReturnValue(true),
}));

import { fetchTopWallets } from '../../src/discovery/birdeye.js';
import { updateHeliusWebhookAddresses } from '../../src/discovery/helius-webhooks.js';
import { saveDiscoveryState } from '../../src/discovery/persistence.js';

const mockFetchTopWallets = vi.mocked(fetchTopWallets);
const mockUpdateHeliusWebhookAddresses = vi.mocked(updateHeliusWebhookAddresses);
const mockSaveDiscoveryState = vi.mocked(saveDiscoveryState);

function makePinned(): Map<string, SmartMoneyWallet> {
  return new Map([
    ['pinned1', { label: 'Pinned #1', category: 'Smart Money' }],
    ['pinned2', { label: 'Pinned #2', category: 'Smart Money' }],
  ]);
}

function makeConfig() {
  const pinned = makePinned();
  const walletStateRef: WalletStateRef = { current: createWalletState(pinned) };
  return {
    walletStateRef,
    pinnedWallets: pinned,
    birdeyeApiKey: 'test-birdeye-key',
    heliusApiKey: 'test-helius-key',
    heliusWebhookId: 'test-webhook-id',
    statePath: '/tmp/test-discovery-state.json',
    intervalMs: 60_000,
    walletCap: 3,
  };
}

const NOW = 1711900000000;

function makeCandidates(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    address: `wallet${i}`,
    pnl: (count - i) * 1000,
    winRate: 0.5 + i * 0.01,
    tradeCount: 100 + i * 10,
    lastActiveTimestamp: NOW - i * 3600000,
  }));
}

describe('discovery orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('runs a full discovery cycle: fetch, score, update state, update Helius, persist', async () => {
    const config = makeConfig();
    mockFetchTopWallets.mockResolvedValue(makeCandidates(5));
    mockUpdateHeliusWebhookAddresses.mockResolvedValue({
      webhookID: 'test-webhook-id',
      wallet: '',
      webhookURL: '',
      transactionTypes: [],
      accountAddresses: [],
      webhookType: 'enhanced',
      authHeader: '',
    });

    const discovery = createDiscovery(config);
    await discovery.runCycle();

    // Birdeye was called
    expect(mockFetchTopWallets).toHaveBeenCalledWith('test-birdeye-key');

    // Pipeline state was updated (pinned + discovered)
    const { walletMap, watchedAddresses } = config.walletStateRef.current;
    expect(walletMap.size).toBeGreaterThan(2); // more than just pinned
    expect(watchedAddresses.has('pinned1')).toBe(true); // pinned still there

    // Helius was updated
    expect(mockUpdateHeliusWebhookAddresses).toHaveBeenCalled();

    // State was persisted
    expect(mockSaveDiscoveryState).toHaveBeenCalled();
  });

  it('skips Helius update when no wallet changes', async () => {
    const config = makeConfig();
    // Empty candidates → no changes
    mockFetchTopWallets.mockResolvedValue([]);

    const discovery = createDiscovery(config);
    await discovery.runCycle();

    expect(mockUpdateHeliusWebhookAddresses).not.toHaveBeenCalled();
    expect(mockSaveDiscoveryState).not.toHaveBeenCalled();
  });

  it('rolls back in-memory state when Helius PUT fails', async () => {
    const config = makeConfig();
    mockFetchTopWallets.mockResolvedValue(makeCandidates(5));
    mockUpdateHeliusWebhookAddresses.mockRejectedValue(new Error('Helius 500'));

    const previousSize = config.walletStateRef.current.walletMap.size;

    const discovery = createDiscovery(config);
    await discovery.runCycle();

    // State was rolled back
    expect(config.walletStateRef.current.walletMap.size).toBe(previousSize);
    expect(mockSaveDiscoveryState).not.toHaveBeenCalled();
  });

  it('keeps current wallets when Birdeye fails', async () => {
    const config = makeConfig();
    mockFetchTopWallets.mockRejectedValue(new Error('Birdeye 500'));

    const discovery = createDiscovery(config);
    await discovery.runCycle();

    // Original pinned wallets still in place
    expect(config.walletStateRef.current.walletMap.size).toBe(2);
    expect(mockUpdateHeliusWebhookAddresses).not.toHaveBeenCalled();
  });

  it('prevents concurrent cycle execution', async () => {
    const config = makeConfig();
    // Slow Birdeye response
    mockFetchTopWallets.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(makeCandidates(3)), 100)),
    );
    mockUpdateHeliusWebhookAddresses.mockResolvedValue({
      webhookID: 'id', wallet: '', webhookURL: '', transactionTypes: [],
      accountAddresses: [], webhookType: 'enhanced', authHeader: '',
    });

    const discovery = createDiscovery(config);

    // Start two cycles simultaneously
    const cycle1 = discovery.runCycle();
    const cycle2 = discovery.runCycle(); // should be skipped

    await Promise.all([cycle1, cycle2]);

    // Only one Birdeye call (second cycle was skipped)
    expect(mockFetchTopWallets).toHaveBeenCalledTimes(1);
  });

  it('caps discovered wallets at walletCap', async () => {
    const config = makeConfig(); // walletCap = 3
    mockFetchTopWallets.mockResolvedValue(makeCandidates(10));
    mockUpdateHeliusWebhookAddresses.mockResolvedValue({
      webhookID: 'id', wallet: '', webhookURL: '', transactionTypes: [],
      accountAddresses: [], webhookType: 'enhanced', authHeader: '',
    });

    const discovery = createDiscovery(config);
    await discovery.runCycle();

    // 2 pinned + at most 3 discovered = 5
    expect(config.walletStateRef.current.walletMap.size).toBeLessThanOrEqual(5);
  });
});

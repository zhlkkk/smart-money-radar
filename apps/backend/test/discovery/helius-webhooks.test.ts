import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listHeliusWebhooks,
  getHeliusWebhook,
  updateHeliusWebhookAddresses,
  findWebhookByUrl,
} from '../../src/discovery/helius-webhooks.js';
import type { HeliusWebhook } from '../../src/types.js';

const FAKE_KEY = 'test-api-key';

function makeWebhook(overrides: Partial<HeliusWebhook> = {}): HeliusWebhook {
  return {
    webhookID: 'wh-1',
    wallet: '',
    webhookURL: 'https://example.com/webhook',
    transactionTypes: ['SWAP'],
    accountAddresses: ['addr1', 'addr2'],
    webhookType: 'enhanced',
    authHeader: 'Bearer secret',
    ...overrides,
  };
}

describe('helius-webhooks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listHeliusWebhooks', () => {
    it('returns parsed array of webhooks', async () => {
      const webhooks = [makeWebhook(), makeWebhook({ webhookID: 'wh-2' })];
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(webhooks), { status: 200 }),
      );

      const result = await listHeliusWebhooks(FAKE_KEY);

      expect(result).toEqual(webhooks);
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining(`?api-key=${FAKE_KEY}`),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it('throws on 429 with status code in message', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('rate limited', { status: 429 }),
      );

      await expect(listHeliusWebhooks(FAKE_KEY)).rejects.toThrow('status 429');
    });

    it('throws on 500 with status code in message', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('internal error', { status: 500 }),
      );

      await expect(listHeliusWebhooks(FAKE_KEY)).rejects.toThrow('status 500');
    });
  });

  describe('getHeliusWebhook', () => {
    it('returns a single webhook', async () => {
      const webhook = makeWebhook();
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(webhook), { status: 200 }),
      );

      const result = await getHeliusWebhook(FAKE_KEY, 'wh-1');

      expect(result).toEqual(webhook);
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/wh-1?api-key='),
        expect.any(Object),
      );
    });
  });

  describe('updateHeliusWebhookAddresses', () => {
    it('does GET then PUT with new addresses', async () => {
      const existing = makeWebhook({ accountAddresses: ['old1', 'old2'] });
      const updated = makeWebhook({ accountAddresses: ['new1', 'new2', 'new3'] });

      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(JSON.stringify(existing), { status: 200 })) // GET
        .mockResolvedValueOnce(new Response(JSON.stringify(updated), { status: 200 })); // PUT

      const result = await updateHeliusWebhookAddresses(FAKE_KEY, 'wh-1', [
        'new1',
        'new2',
        'new3',
      ]);

      expect(result).toEqual(updated);

      // Verify two fetch calls: GET then PUT
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);

      // First call: GET
      const [getUrl, getOpts] = vi.mocked(fetch).mock.calls[0]!;
      expect(getUrl).toContain('/wh-1?api-key=');
      expect(getOpts).not.toHaveProperty('method');

      // Second call: PUT with replaced addresses
      const [putUrl, putOpts] = vi.mocked(fetch).mock.calls[1]!;
      expect(putUrl).toContain('/wh-1?api-key=');
      expect(putOpts).toMatchObject({ method: 'PUT' });
      const body = JSON.parse(putOpts!.body as string) as Record<string, unknown>;
      expect(body.accountAddresses).toEqual(['new1', 'new2', 'new3']);
      // Verify other fields are preserved
      expect(body.webhookType).toBe('enhanced');
      expect(body.authHeader).toBe('Bearer secret');
    });

    it('throws when GET fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('not found', { status: 404 }),
      );

      await expect(
        updateHeliusWebhookAddresses(FAKE_KEY, 'wh-1', ['addr']),
      ).rejects.toThrow('status 404');
    });

    it('throws when PUT fails', async () => {
      const existing = makeWebhook();
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(JSON.stringify(existing), { status: 200 }))
        .mockResolvedValueOnce(new Response('server error', { status: 500 }));

      await expect(
        updateHeliusWebhookAddresses(FAKE_KEY, 'wh-1', ['addr']),
      ).rejects.toThrow('status 500');
    });
  });

  describe('findWebhookByUrl', () => {
    it('returns matching webhook', async () => {
      const target = makeWebhook({ webhookURL: 'https://my-app.com/hook' });
      const other = makeWebhook({ webhookID: 'wh-2', webhookURL: 'https://other.com/hook' });

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify([other, target]), { status: 200 }),
      );

      const result = await findWebhookByUrl(FAKE_KEY, 'https://my-app.com/hook');
      expect(result).toEqual(target);
    });

    it('returns null when no webhook matches', async () => {
      const webhook = makeWebhook({ webhookURL: 'https://other.com/hook' });

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify([webhook]), { status: 200 }),
      );

      const result = await findWebhookByUrl(FAKE_KEY, 'https://my-app.com/hook');
      expect(result).toBeNull();
    });
  });

  describe('timeout', () => {
    it('throws when fetch times out', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'));

      await expect(listHeliusWebhooks(FAKE_KEY)).rejects.toThrow('aborted');
    });
  });
});

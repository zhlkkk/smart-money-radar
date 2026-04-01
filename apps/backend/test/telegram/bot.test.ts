import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendAlert } from '../../src/telegram/bot.js';

describe('sendAlert', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('sends HTML message successfully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    await sendAlert('<b>Test</b>', '123:ABC', '-100999');
    expect(fetch).toHaveBeenCalledOnce();
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
    expect(body.parse_mode).toBe('HTML');
    expect(body.disable_web_page_preview).toBe(true);
  });

  it('retries once on failure then succeeds', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('error', { status: 500 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    await sendAlert('<b>Test</b>', '123:ABC', '-100999');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws after retry failure', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('error', { status: 500 }))
      .mockResolvedValueOnce(new Response('still error', { status: 500 }));
    await expect(sendAlert('<b>Test</b>', '123:ABC', '-100999')).rejects.toThrow('Telegram send failed after retry');
  });
});

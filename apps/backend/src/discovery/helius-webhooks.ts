import type { HeliusWebhook } from '../types.js';
import { sleep } from '../utils/sleep.js';

const HELIUS_WEBHOOKS_BASE = 'https://api-mainnet.helius-rpc.com/v0/webhooks';
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 5000;

/** Cached webhook config to avoid redundant GET before PUT */
let webhookConfigCache: HeliusWebhook | null = null;

function apiUrl(apiKey: string, webhookId?: string): string {
  const base = webhookId ? `${HELIUS_WEBHOOKS_BASE}/${webhookId}` : HELIUS_WEBHOOKS_BASE;
  return `${base}?api-key=${apiKey}`;
}

/**
 * Fetch with retry on 429 (rate limit) using exponential backoff.
 * Retries up to MAX_RETRIES times with delays: 5s, 10s, 20s, 40s, 80s.
 */
async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status !== 429 || attempt === MAX_RETRIES) {
      return response;
    }

    const delay = BASE_DELAY_MS * 2 ** attempt;
    console.warn(`[helius] 429 rate limited, retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
    await sleep(delay);
  }

  // Unreachable, but TypeScript needs it
  throw new Error('fetchWithRetry: exhausted retries');
}

export async function listHeliusWebhooks(apiKey: string): Promise<HeliusWebhook[]> {
  const response = await fetchWithRetry(apiUrl(apiKey));

  if (!response.ok) {
    throw new Error(`Helius listWebhooks failed with status ${response.status}`);
  }

  return response.json() as Promise<HeliusWebhook[]>;
}

export async function getHeliusWebhook(apiKey: string, webhookId: string): Promise<HeliusWebhook> {
  const response = await fetchWithRetry(apiUrl(apiKey, webhookId));

  if (!response.ok) {
    throw new Error(`Helius getWebhook failed with status ${response.status}`);
  }

  const webhook = await response.json() as HeliusWebhook;
  webhookConfigCache = webhook;
  return webhook;
}

export async function updateHeliusWebhookAddresses(
  apiKey: string,
  webhookId: string,
  addresses: string[],
): Promise<HeliusWebhook> {
  // Use cached config to skip the GET call and halve API usage
  let config = webhookConfigCache;
  if (!config) {
    config = await getHeliusWebhook(apiKey, webhookId);
  }

  const response = await fetchWithRetry(apiUrl(apiKey, webhookId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webhookURL: config.webhookURL,
      transactionTypes: config.transactionTypes,
      accountAddresses: addresses,
      webhookType: config.webhookType,
      authHeader: config.authHeader,
    }),
  });

  if (!response.ok) {
    // Invalidate cache on failure — config may have changed externally
    webhookConfigCache = null;
    throw new Error(`Helius updateWebhookAddresses failed with status ${response.status}`);
  }

  const updated = await response.json() as HeliusWebhook;
  webhookConfigCache = updated;
  return updated;
}

export async function findWebhookByUrl(
  apiKey: string,
  webhookUrl: string,
): Promise<HeliusWebhook | null> {
  const webhooks = await listHeliusWebhooks(apiKey);
  return webhooks.find((w) => w.webhookURL === webhookUrl) ?? null;
}

/** Clear cached webhook config (for testing) */
export function clearWebhookConfigCache(): void {
  webhookConfigCache = null;
}

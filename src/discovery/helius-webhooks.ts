import type { HeliusWebhook } from '../types.js';

const HELIUS_WEBHOOKS_BASE = 'https://api-mainnet.helius-rpc.com/v0/webhooks';
const TIMEOUT_MS = 5000;

function apiUrl(apiKey: string, webhookId?: string): string {
  const base = webhookId ? `${HELIUS_WEBHOOKS_BASE}/${webhookId}` : HELIUS_WEBHOOKS_BASE;
  return `${base}?api-key=${apiKey}`;
}

export async function listHeliusWebhooks(apiKey: string): Promise<HeliusWebhook[]> {
  const response = await fetch(apiUrl(apiKey), {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Helius listWebhooks failed with status ${response.status}`);
  }

  return response.json() as Promise<HeliusWebhook[]>;
}

export async function getHeliusWebhook(apiKey: string, webhookId: string): Promise<HeliusWebhook> {
  const response = await fetch(apiUrl(apiKey, webhookId), {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Helius getWebhook failed with status ${response.status}`);
  }

  return response.json() as Promise<HeliusWebhook>;
}

export async function updateHeliusWebhookAddresses(
  apiKey: string,
  webhookId: string,
  addresses: string[],
): Promise<HeliusWebhook> {
  const current = await getHeliusWebhook(apiKey, webhookId);

  const response = await fetch(apiUrl(apiKey, webhookId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...current, accountAddresses: addresses }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Helius updateWebhookAddresses failed with status ${response.status}`);
  }

  return response.json() as Promise<HeliusWebhook>;
}

export async function findWebhookByUrl(
  apiKey: string,
  webhookUrl: string,
): Promise<HeliusWebhook | null> {
  const webhooks = await listHeliusWebhooks(apiKey);
  return webhooks.find((w) => w.webhookURL === webhookUrl) ?? null;
}

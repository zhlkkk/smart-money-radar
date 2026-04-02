// 后端 API 客户端封装（server-only）
// 通过 fetch + ISR 缓存策略调用后端 REST API

import 'server-only';

// ─── 类型定义 ───

export interface AlertRow {
  id: string;
  signature: string;
  walletAddress: string;
  walletLabel: string | null;
  tokenMint: string;
  tokenSymbol: string | null;
  dexSource: string | null;
  amountRaw: string | null;
  liquidity: number | null;
  fdv: number | null;
  marketCap: number | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  aiSummary: string | null;
  telegramSent: boolean;
  confidenceScore: number | null;
  confidenceLevel: 'high' | 'medium' | 'low' | null;
  createdAt: string;
}

export interface WalletRow {
  id: string;
  address: string;
  label: string | null;
  category: string | null;
  source: 'pinned' | 'discovered';
  compositeScore: number | null;
  winRate: number | null;
  pnl: number | null;
  tradeCount: number | null;
  isActive: boolean;
  lastDiscoveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedAlerts {
  data: AlertRow[];
  cursor: string | null;
  hasMore: boolean;
}

export interface WalletsResponse {
  data: WalletRow[];
}

export interface WalletDetailResponse {
  wallet: WalletRow;
  recentAlerts: AlertRow[];
}

// ─── 内部工具 ───

function getBaseUrl(): string {
  const url = process.env.BACKEND_API_URL;
  if (!url) {
    throw new Error('BACKEND_API_URL 环境变量未配置');
  }
  return url.replace(/\/$/, '');
}

function getApiKey(): string {
  const key = process.env.BACKEND_API_KEY;
  if (!key) {
    throw new Error('BACKEND_API_KEY 环境变量未配置');
  }
  return key;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    headers: {
      'X-API-Key': getApiKey(),
      'Content-Type': 'application/json',
    },
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    throw new Error(`后端 API 错误: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ─── 公开方法 ───

/** 获取告警历史（游标分页） */
export async function getAlerts(
  cursor?: string,
  limit: number = 20,
): Promise<PaginatedAlerts> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    params.set('cursor', cursor);
  }
  return apiFetch<PaginatedAlerts>(`/api/v1/alerts?${params.toString()}`);
}

/** 获取所有活跃钱包 */
export async function getWallets(): Promise<WalletsResponse> {
  return apiFetch<WalletsResponse>('/api/v1/wallets');
}

/** 获取钱包详情 + 近期告警 */
export async function getWalletDetail(
  address: string,
): Promise<WalletDetailResponse | null> {
  try {
    return await apiFetch<WalletDetailResponse>(
      `/api/v1/wallets/${encodeURIComponent(address)}`,
    );
  } catch {
    return null;
  }
}

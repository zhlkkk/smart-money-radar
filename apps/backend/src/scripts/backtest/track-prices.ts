import type { RateLimiter } from '../../discovery/rate-limiter.js';
import type { BacktestTrade, PriceTrackResult } from './types.js';

const BIRDEYE_BASE = 'https://public-api.birdeye.so';
const TIMEOUT_MS = 10_000;

/** 时间窗口定义（秒） */
const TIME_WINDOWS = {
  h1: 3600,
  h24: 86400,
  d7: 604800,
} as const;

type TimeWindowKey = keyof typeof TIME_WINDOWS;

function makeHeaders(apiKey: string): Record<string, string> {
  return {
    'X-API-KEY': apiKey,
    'x-chain': 'solana',
    Accept: 'application/json',
  };
}

/** Birdeye OHLCV 响应结构 */
interface BirdeyeOhlcvItem {
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  unixTime?: number;
}

interface BirdeyeOhlcvResponse {
  success: boolean;
  data?: {
    items?: BirdeyeOhlcvItem[];
  };
}

/**
 * 从 Birdeye OHLCV API 获取指定时间窗口结束时的收盘价。
 * 返回 null 表示无数据。
 */
async function fetchClosePrice(
  apiKey: string,
  tokenMint: string,
  timeFrom: number,
  timeTo: number,
  rateLimiter: RateLimiter,
): Promise<number | null> {
  await rateLimiter.acquire();

  try {
    const url =
      `${BIRDEYE_BASE}/defi/ohlcv` +
      `?address=${encodeURIComponent(tokenMint)}` +
      `&type=1H` +
      `&time_from=${timeFrom}` +
      `&time_to=${timeTo}`;

    const response = await fetch(url, {
      headers: makeHeaders(apiKey),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const body = (await response.json()) as BirdeyeOhlcvResponse;
    if (!body.success) return null;

    const items = body.data?.items ?? [];
    if (items.length === 0) return null;

    // 取最后一根 K 线的收盘价
    const lastItem = items[items.length - 1];
    return lastItem?.c ?? null;
  } catch {
    return null;
  }
}

/**
 * 追踪单笔交易在各时间窗口的价格表现。
 *
 * 使用 Birdeye OHLCV API 获取买入后 1h/24h/7d 的价格，
 * 计算回报率百分比。
 */
export async function trackTradePrice(
  trade: BacktestTrade,
  apiKey: string,
  rateLimiter: RateLimiter,
): Promise<PriceTrackResult> {
  const result: PriceTrackResult = {
    tradeSignature: trade.signature,
    tokenMint: trade.tokenMint,
    buyTimestamp: trade.timestamp,
    buyPrice: 0,
    returns: { h1: null, h24: null, d7: null },
    noData: false,
  };

  // 获取买入价（买入时刻附近 1h K 线的开盘价）
  const buyPrice = await fetchClosePrice(
    apiKey,
    trade.tokenMint,
    trade.timestamp,
    trade.timestamp + 3600,
    rateLimiter,
  );

  if (buyPrice === null || buyPrice === 0) {
    result.noData = true;
    return result;
  }

  result.buyPrice = buyPrice;

  // 获取各时间窗口的价格
  const windowKeys: TimeWindowKey[] = ['h1', 'h24', 'd7'];

  for (const key of windowKeys) {
    const windowSeconds = TIME_WINDOWS[key];
    const closePrice = await fetchClosePrice(
      apiKey,
      trade.tokenMint,
      trade.timestamp + windowSeconds - 3600,
      trade.timestamp + windowSeconds,
      rateLimiter,
    );

    if (closePrice !== null) {
      result.returns[key] = ((closePrice - buyPrice) / buyPrice) * 100;
    }
  }

  // 如果所有窗口都没数据，标记 noData
  if (
    result.returns.h1 === null &&
    result.returns.h24 === null &&
    result.returns.d7 === null
  ) {
    result.noData = true;
  }

  return result;
}

/**
 * 批量追踪多笔交易的价格表现。
 * 串行执行以遵守 API 限流。
 */
export async function trackAllTrades(
  trades: BacktestTrade[],
  apiKey: string,
  rateLimiter: RateLimiter,
): Promise<PriceTrackResult[]> {
  const results: PriceTrackResult[] = [];

  for (const trade of trades) {
    const result = await trackTradePrice(trade, apiKey, rateLimiter);
    results.push(result);
  }

  return results;
}

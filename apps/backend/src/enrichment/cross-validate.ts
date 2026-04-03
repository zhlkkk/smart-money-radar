/** 链上价格交叉校验 — 通过 Raydium V3 API 获取链上价格并与 DexScreener 价格比较 */

const RAYDIUM_API_BASE = 'https://api-v3.raydium.io/pools/info/mint';

export interface CrossValidationResult {
  onChainPrice: number | null;
  priceDeviation: number | null;
}

interface RaydiumPoolEntry {
  price?: number;
  mintA?: { address?: string };
  mintB?: { address?: string };
}

interface RaydiumPoolResponse {
  success?: boolean;
  data?: {
    data?: RaydiumPoolEntry[];
  };
}

const EMPTY_RESULT: CrossValidationResult = {
  onChainPrice: null,
  priceDeviation: null,
};

/**
 * 通过 Raydium V3 API 查询代币的链上价格，并与 DexScreener 价格计算偏差。
 *
 * @param tokenMint - Solana 代币 mint 地址
 * @param dexPrice  - DexScreener 返回的代币单价 (USD)，可选
 * @returns 链上价格和偏差百分比
 */
export async function crossValidatePrice(
  tokenMint: string,
  dexPrice?: number | null,
): Promise<CrossValidationResult> {
  try {
    const url = `${RAYDIUM_API_BASE}?mint1=${encodeURIComponent(tokenMint)}&poolType=standard&poolSortField=liquidity&sortType=desc&pageSize=1`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) {
      return EMPTY_RESULT;
    }

    const body = (await response.json()) as RaydiumPoolResponse;

    if (!body.success || !body.data?.data?.length) {
      return EMPTY_RESULT;
    }

    const pool = body.data.data[0] as RaydiumPoolEntry | undefined;
    if (!pool) {
      return EMPTY_RESULT;
    }
    const onChainPrice = pool.price ?? null;

    if (onChainPrice == null || onChainPrice === 0) {
      return EMPTY_RESULT;
    }

    // 计算偏差百分比
    let priceDeviation: number | null = null;
    if (dexPrice != null && dexPrice > 0) {
      priceDeviation = (Math.abs(dexPrice - onChainPrice) / onChainPrice) * 100;
    }

    return { onChainPrice, priceDeviation };
  } catch {
    return EMPTY_RESULT;
  }
}

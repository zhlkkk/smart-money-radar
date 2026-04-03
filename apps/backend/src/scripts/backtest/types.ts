/** 单笔历史交易记录 */
export interface BacktestTrade {
  /** 钱包地址 */
  address: string;
  /** 交易签名 */
  signature: string;
  /** 代币 mint 地址 */
  tokenMint: string;
  /** 交易类型: 买入或卖出 */
  type: 'buy' | 'sell';
  /** 交易时间戳（Unix 秒） */
  timestamp: number;
  /** 交易金额（SOL 计价） */
  amount: number;
}

/** 单个钱包的交易数据集合 */
export interface WalletTradeData {
  /** 钱包地址 */
  address: string;
  /** 该钱包的所有历史交易 */
  trades: BacktestTrade[];
  /** 数据采集时间（ISO 8601） */
  collectedAt: string;
}

/** 批量采集进度 */
export interface CollectionProgress {
  /** 总钱包数 */
  totalWallets: number;
  /** 已完成采集的钱包数 */
  completed: number;
  /** 采集失败的钱包数 */
  failed: number;
  /** 跳过（已有缓存）的钱包数 */
  skipped: number;
}

/** 单笔交易的价格追踪结果 */
export interface PriceTrackResult {
  /** 交易签名 */
  tradeSignature: string;
  /** 代币 mint 地址 */
  tokenMint: string;
  /** 买入时间戳（Unix 秒） */
  buyTimestamp: number;
  /** 买入时价格（无法获取时为 0） */
  buyPrice: number;
  /** 各时间窗口的回报率（百分比） */
  returns: {
    /** 1 小时后回报率 */
    h1: number | null;
    /** 24 小时后回报率 */
    h24: number | null;
    /** 7 天后回报率 */
    d7: number | null;
  };
  /** 是否无法获取价格数据（退市代币等） */
  noData: boolean;
}

/** 统计分析结果 */
export interface BacktestStats {
  /** 总交易数 */
  totalTrades: number;
  /** 24h 胜率（回报 > 0 的比例） */
  winRate24h: number;
  /** 24h 平均回报率 */
  avgReturn24h: number;
  /** 最大回撤（最差单笔回报） */
  maxDrawdown: number;
  /** 盈利集中度（前 10% 交易贡献利润占比） */
  profitConcentration: number;
  /** 无数据比例 */
  noDataRatio: number;
}

/** Birdeye 种子钱包分组结果 */
export interface BacktestGroups {
  /** 聪明钱组（PnL 排名前 30%）地址 */
  smartMoney: string[];
  /** 基线对照组（PnL 排名后 30%）地址 */
  baseline: string[];
}

/** 数据来源说明 */
export interface BacktestDataSource {
  /** 聪明钱组来源描述 */
  smartMoney: string;
  /** 基线组来源描述 */
  baseline: string;
}

/** 回测运行进度事件 */
export interface BacktestProgress {
  /** 当前阶段 */
  phase: 'seed' | 'collect-smart' | 'collect-baseline' | 'track-smart' | 'track-baseline' | 'analyze';
  /** 完成百分比 0-100 */
  percent: number;
  /** 人类可读的进度消息 */
  message: string;
}

/** BacktestRunner 配置 */
export interface BacktestRunnerConfig {
  /** Birdeye API 密钥（用于种子钱包获取及价格追踪） */
  birdeyeApiKey: string;
  /** Helius API 密钥（用于交易历史采集） */
  heliusApiKey: string;
  /** 输出目录 */
  outputDir: string;
  /** 进度回调 */
  onProgress?: (event: BacktestProgress) => void;
  /**
   * discovery 状态文件路径（discovered-wallets.json）。
   * 提供时优先从本地已发现钱包分组，文件不存在或钱包数不足时 fallback 到 Birdeye。
   */
  discoveryStatePath?: string;
}

/** 完整回测报告 */
export interface BacktestReport {
  /** 聪明钱组统计 */
  smartMoneyStats: BacktestStats;
  /** 基线组统计 */
  baselineStats: BacktestStats;
  /** 是否通过（聪明钱 24h 胜率 > 55% 且显著高于基线差值 > 10pp） */
  passed: boolean;
  /** 数据可靠性（noDataRatio <= 0.3） */
  dataReliable: boolean;
  /** 报告生成时间（ISO 8601） */
  generatedAt: string;
  /** 数据来源说明（可选，种子模式下填充） */
  dataSource?: BacktestDataSource;
}

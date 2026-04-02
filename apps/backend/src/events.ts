// 内存事件总线 — 用于 Pipeline → SSE 广播
// 单进程内使用，不持久化，适合 Railway 单实例部署

import { EventEmitter } from 'node:events';

export interface AlertEvent {
  id: string;
  signature: string;
  walletAddress: string;
  walletLabel: string | null;
  tokenMint: string;
  tokenSymbol: string | null;
  dexSource: string | null;
  liquidity: number | null;
  fdv: number | null;
  marketCap: number | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  aiSummary: string;
  createdAt: string;
  confidenceScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

class AlertBus extends EventEmitter {
  emit(event: 'alert', data: AlertEvent): boolean {
    return super.emit(event, data);
  }

  on(event: 'alert', listener: (data: AlertEvent) => void): this {
    return super.on(event, listener);
  }

  off(event: 'alert', listener: (data: AlertEvent) => void): this {
    return super.off(event, listener);
  }
}

// 全局单例
export const alertBus = new AlertBus();
alertBus.setMaxListeners(100); // 最多 100 个并发 SSE 连接

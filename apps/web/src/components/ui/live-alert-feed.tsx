'use client';

// 模拟实时告警轮播 — 自动循环切换

import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/glass-card';

interface MockAlert {
  token: string;
  addr: string;
  dex: string;
  liquidity: string;
  fdv: string;
  risk: string;
  riskColor: 'green' | 'gold' | 'red';
  action: string;
  ai: string;
  time: string;
}

const mockAlerts: MockAlert[] = [
  {
    token: '$BONK', addr: '7nYp...x3Kq', dex: 'Raydium', liquidity: '$4.2M',
    fdv: '$890M', risk: '低', riskColor: 'green', action: '买入',
    ai: '高流动性 meme 代币，该钱包近期胜率 78%，或为短线波段布局。',
    time: '刚刚',
  },
  {
    token: '$WIF', addr: 'Dk8m...vR2j', dex: 'Orca', liquidity: '$12.8M',
    fdv: '$2.1B', risk: '低', riskColor: 'green', action: '买入',
    ai: '持续放量突破前高，该地址历史大额交易平均回报率 +240%。',
    time: '3 秒前',
  },
  {
    token: '$JUP', addr: '3xFa...mN9p', dex: 'Jupiter', liquidity: '$28M',
    fdv: '$1.8B', risk: '低', riskColor: 'green', action: '买入',
    ai: 'DEX 聚合器龙头，机构钱包连续 3 天累计建仓，长线看好信号。',
    time: '5 秒前',
  },
  {
    token: '$POPCAT', addr: 'Qw4r...j8Lm', dex: 'Raydium', liquidity: '$1.8M',
    fdv: '$420M', risk: '中', riskColor: 'gold', action: '买入',
    ai: '新晋 meme 代币，社区热度激增，该钱包为早期参与者，风险偏中。',
    time: '8 秒前',
  },
];

export function LiveAlertFeed() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((i) => (i + 1) % mockAlerts.length);
        setIsAnimating(false);
      }, 300);
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  const alert = mockAlerts[currentIndex];

  return (
    <GlassCard className="overflow-hidden p-4" glow="cyan">
      <div
        style={{
          animation: !isAnimating ? 'alert-slide-in 400ms ease-out' : 'none',
          opacity: isAnimating ? 0 : 1,
          transition: 'opacity 200ms ease',
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <Badge variant="cyan" size="md">实时告警</Badge>
          <span className="font-data text-[10px] text-smr-text-muted">{alert.time}</span>
        </div>
        <div className="mb-1 flex items-center gap-2">
          <span className="font-data text-sm font-bold text-[var(--smr-accent-cyan)]">{alert.token}</span>
          <Badge variant="green" size="sm">{alert.action}</Badge>
        </div>
        <div className="mb-2 font-data text-xs text-smr-text-muted">{alert.addr} · {alert.dex}</div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-[9px] text-smr-text-muted">流动性</div>
            <div className="font-data text-xs text-smr-text">{alert.liquidity}</div>
          </div>
          <div>
            <div className="text-[9px] text-smr-text-muted">FDV</div>
            <div className="font-data text-xs text-smr-text">{alert.fdv}</div>
          </div>
          <div>
            <div className="text-[9px] text-smr-text-muted">风险</div>
            <div className={`font-data text-xs text-[var(--smr-accent-${alert.riskColor})]`}>{alert.risk}</div>
          </div>
        </div>
        <div className="mt-2 rounded-md bg-[var(--smr-bg-elevated)] px-2 py-1.5 text-[11px] leading-relaxed text-smr-text-secondary">
          <Brain size={10} className="mr-1 inline text-[var(--smr-accent-cyan)]" />
          {alert.ai}
        </div>
      </div>
    </GlassCard>
  );
}

'use client';

// Dashboard 统计卡片内的微型图表（Client Component wrapper）

import { MiniSparkline } from '@/components/ui/mini-sparkline';

const colorMap = {
  cyan: 'var(--smr-accent-cyan)',
  green: 'var(--smr-accent-green)',
  gold: 'var(--smr-accent-gold)',
  red: 'var(--smr-accent-red)',
} as const;

interface DashboardChartsProps {
  type: 'sparkline';
  data: number[];
  color?: keyof typeof colorMap;
}

export function DashboardCharts({ data, color = 'cyan' }: DashboardChartsProps) {
  return (
    <div className="mt-2">
      <MiniSparkline data={data} color={colorMap[color]} width={140} height={28} />
    </div>
  );
}

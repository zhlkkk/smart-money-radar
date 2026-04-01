'use client';

// Dashboard 统计卡片内的微型图表（Client Component wrapper）

import { MiniSparkline } from '@/components/ui/mini-sparkline';

interface DashboardChartsProps {
  type: 'sparkline';
  data: number[];
}

export function DashboardCharts({ data }: DashboardChartsProps) {
  return (
    <div className="mt-2">
      <MiniSparkline data={data} color="var(--smr-accent-cyan)" width={140} height={28} />
    </div>
  );
}

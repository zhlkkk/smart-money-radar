'use client';

// 微型环形图 — 用于胜率展示
// 单数据 donut，中心显示百分比

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface MiniPieChartProps {
  value: number | null; // 0-1 之间
  size?: number;
  color?: string;
  className?: string;
}

export function MiniPieChart({
  value,
  size = 44,
  color = 'var(--smr-accent-cyan)',
  className = '',
}: MiniPieChartProps) {
  const normalized = value != null ? Math.max(0, Math.min(1, value)) : 0;
  const data = [
    { value: normalized },
    { value: 1 - normalized },
  ];

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size / 2 - 5}
            outerRadius={size / 2 - 2}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            isAnimationActive={false}
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill="var(--smr-glass-border)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <span
        className="font-data absolute text-[10px] font-bold"
        style={{ color: value != null ? color : 'var(--smr-text-muted)' }}
      >
        {value != null ? `${(value * 100).toFixed(0)}%` : '-'}
      </span>
    </div>
  );
}

// 环形进度条 — SVG 实现
// 用于评分展示（0-1 分），颜色从红(0)→黄(0.5)→绿(1) 渐变

interface ScoreRingProps {
  score: number | null;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function scoreToColor(score: number): string {
  if (score >= 0.7) return 'var(--smr-accent-green)';
  if (score >= 0.4) return 'var(--smr-accent-gold)';
  return 'var(--smr-accent-red)';
}

export function ScoreRing({
  score,
  size = 48,
  strokeWidth = 3,
  className = '',
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = score != null ? Math.max(0, Math.min(1, score)) : 0;
  const strokeDashoffset = circumference * (1 - normalizedScore);
  const color = score != null ? scoreToColor(normalizedScore) : 'var(--smr-text-muted)';

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* 背景环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--smr-glass-border)"
          strokeWidth={strokeWidth}
        />
        {/* 进度环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset var(--smr-transition-slow)' }}
        />
      </svg>
      {/* 中心数字 */}
      <span
        className="font-data absolute text-xs font-bold"
        style={{ color }}
      >
        {score != null ? score.toFixed(1) : '-'}
      </span>
    </div>
  );
}

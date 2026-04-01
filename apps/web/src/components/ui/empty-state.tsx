// 统一空状态组件
// 内嵌 SVG 雷达扫描动画 + 标题 + 副文本 + 可选 CTA

import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

function RadarIcon() {
  return (
    <div className="relative mb-4 h-20 w-20">
      <svg viewBox="0 0 80 80" className="h-full w-full">
        {/* 外环 */}
        <circle cx="40" cy="40" r="36" fill="none" stroke="var(--smr-glass-border)" strokeWidth="1" />
        <circle cx="40" cy="40" r="24" fill="none" stroke="var(--smr-glass-border)" strokeWidth="1" />
        <circle cx="40" cy="40" r="12" fill="none" stroke="var(--smr-glass-border)" strokeWidth="1" />
        {/* 十字线 */}
        <line x1="40" y1="4" x2="40" y2="76" stroke="var(--smr-glass-border)" strokeWidth="0.5" />
        <line x1="4" y1="40" x2="76" y2="40" stroke="var(--smr-glass-border)" strokeWidth="0.5" />
        {/* 中心点 */}
        <circle cx="40" cy="40" r="2" fill="var(--smr-accent-cyan)" />
      </svg>
      {/* 扫描线 - 旋转动画 */}
      <div
        className="absolute inset-0 origin-center"
        style={{ animation: 'radar-scan 3s linear infinite' }}
      >
        <svg viewBox="0 0 80 80" className="h-full w-full">
          <defs>
            <linearGradient id="radarGrad" gradientUnits="userSpaceOnUse" x1="40" y1="40" x2="40" y2="4">
              <stop offset="0%" stopColor="var(--smr-accent-cyan)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--smr-accent-cyan)" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <line x1="40" y1="40" x2="40" y2="4" stroke="url(#radarGrad)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`glass-card flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}>
      {icon ?? <RadarIcon />}
      <h3 className="mb-2 text-lg font-semibold text-smr-text">{title}</h3>
      {description && (
        <p className="mb-6 max-w-sm text-sm text-smr-text-muted">{description}</p>
      )}
      {action}
    </div>
  );
}

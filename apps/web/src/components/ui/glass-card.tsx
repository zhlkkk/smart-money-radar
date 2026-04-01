// 毛玻璃卡片容器
// 使用 CSS 变量实现 backdrop-blur + 半透明背景 + 边框微光

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'cyan' | 'green' | 'none';
  as?: 'div' | 'section' | 'article';
}

export function GlassCard({
  children,
  className = '',
  hover = true,
  glow = 'none',
  as: Tag = 'div',
}: GlassCardProps) {
  const glowStyle =
    glow === 'cyan'
      ? 'shadow-[var(--smr-glow-cyan)]'
      : glow === 'green'
        ? 'shadow-[var(--smr-glow-green)]'
        : '';

  return (
    <Tag
      className={`glass-card ${hover ? 'hover:border-[var(--smr-border-hover)] hover:shadow-[var(--smr-glow-cyan)]' : ''} ${glowStyle} ${className}`}
    >
      {children}
    </Tag>
  );
}

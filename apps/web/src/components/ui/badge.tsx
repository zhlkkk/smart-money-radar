// 多样式 pill badge

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'cyan' | 'green' | 'gold' | 'red' | 'muted';
  size?: 'sm' | 'md';
  className?: string;
}

const variantClasses = {
  cyan: 'bg-[var(--smr-accent-cyan)]/10 text-[var(--smr-accent-cyan)]',
  green: 'bg-[var(--smr-accent-green)]/10 text-[var(--smr-accent-green)]',
  gold: 'bg-[var(--smr-accent-gold)]/10 text-[var(--smr-accent-gold)]',
  red: 'bg-[var(--smr-accent-red)]/10 text-[var(--smr-accent-red)]',
  muted: 'bg-[var(--smr-bg-elevated)] text-[var(--smr-text-muted)]',
} as const;

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
} as const;

export function Badge({
  children,
  variant = 'muted',
  size = 'sm',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </span>
  );
}

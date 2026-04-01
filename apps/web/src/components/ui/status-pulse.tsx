// 脉冲状态指示点
// CSS animation 实现呼吸光晕效果

interface StatusPulseProps {
  status: 'ok' | 'warning' | 'error';
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

const statusColors = {
  ok: 'bg-[var(--smr-accent-green)] text-[var(--smr-accent-green)]',
  warning: 'bg-[var(--smr-accent-gold)] text-[var(--smr-accent-gold)]',
  error: 'bg-[var(--smr-accent-red)] text-[var(--smr-accent-red)]',
} as const;

const sizeClasses = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
} as const;

export function StatusPulse({
  status,
  size = 'sm',
  label,
  className = '',
}: StatusPulseProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`${sizeClasses[size]} ${statusColors[status]} inline-block rounded-full`}
        style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}
      />
      {label && (
        <span className="text-xs text-smr-text-secondary">{label}</span>
      )}
    </span>
  );
}

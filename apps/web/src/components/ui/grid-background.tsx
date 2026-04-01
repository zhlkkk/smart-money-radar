// 网格线纹理背景
// 绝对定位叠加，微妙的科技感深度

interface GridBackgroundProps {
  className?: string;
}

export function GridBackground({ className = '' }: GridBackgroundProps) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 grid-texture ${className}`}
    />
  );
}

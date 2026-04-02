'use client';

// 鼠标跟随光晕 — 微妙的光效跟随鼠标移动

import { useEffect, useRef } from 'react';

interface GlowCursorProps {
  className?: string;
  color?: string;
  size?: number;
}

export function GlowCursor({
  className = '',
  color = 'rgba(var(--smr-particle-color), 0.06)',
  size = 400,
}: GlowCursorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const parent = el.parentElement;
    if (!parent) return;

    function handleMove(e: MouseEvent) {
      const rect = parent!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el!.style.left = `${x - size / 2}px`;
      el!.style.top = `${y - size / 2}px`;
      el!.style.opacity = '1';
    }

    function handleLeave() {
      el!.style.opacity = '0';
    }

    parent.addEventListener('mousemove', handleMove);
    parent.addEventListener('mouseleave', handleLeave);

    return () => {
      parent.removeEventListener('mousemove', handleMove);
      parent.removeEventListener('mouseleave', handleLeave);
    };
  }, [size]);

  return (
    <div
      ref={ref}
      className={`pointer-events-none absolute rounded-full opacity-0 blur-[80px] transition-opacity duration-300 ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      }}
    />
  );
}

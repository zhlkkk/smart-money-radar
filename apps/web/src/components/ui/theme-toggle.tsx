'use client';

// 明暗模式切换按钮 — Sun / Moon 图标

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

interface ThemeToggleProps {
  className?: string;
  size?: number;
}

export function ThemeToggle({ className = '', size = 16 }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`cursor-pointer rounded-lg p-2 text-smr-text-muted transition hover:bg-[var(--smr-bg-hover)] hover:text-smr-text ${className}`}
      style={{ transition: 'all var(--smr-transition-fast)' }}
      aria-label={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
      title={theme === 'dark' ? '亮色模式' : '暗色模式'}
    >
      {theme === 'dark' ? <Sun size={size} /> : <Moon size={size} />}
    </button>
  );
}

'use client';

// 语言选择下拉菜单 — 支持多语言扩展

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Globe, Check, ChevronDown } from 'lucide-react';

interface LocaleOption {
  code: string;
  label: string;
  flag: string;
}

const locales: LocaleOption[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'zh', label: '简体中文', flag: '🇨🇳' },
  // 未来扩展：
  // { code: 'ja', label: '日本語', flag: '🇯🇵' },
  // { code: 'ko', label: '한국어', flag: '🇰🇷' },
];

interface LocaleToggleProps {
  className?: string;
}

export function LocaleToggle({ className = '' }: LocaleToggleProps) {
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = locales.find((l) => l.code === locale) ?? locales[0];

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  function selectLocale(code: string) {
    if (code === locale) { setOpen(false); return; }
    document.cookie = `smr-locale=${code};path=/;max-age=${365 * 24 * 60 * 60}`;
    setOpen(false);
    // 强制整页刷新确保 Server Component 读取新 cookie
    window.location.reload();
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-smr-text-muted transition hover:bg-[var(--smr-bg-hover)] hover:text-smr-text"
        style={{ transition: 'all var(--smr-transition-fast)' }}
        aria-label="Select language"
        aria-expanded={open}
      >
        <Globe size={14} />
        <span>{current.label}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-[var(--smr-glass-border)] bg-[var(--smr-bg-card)] shadow-lg"
          style={{
            backdropFilter: 'blur(12px)',
            animation: 'fade-in 150ms ease-out',
          }}
        >
          {locales.map((l) => (
            <button
              key={l.code}
              onClick={() => selectLocale(l.code)}
              className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-[var(--smr-bg-hover)] ${
                l.code === locale ? 'text-[var(--smr-accent-cyan)]' : 'text-smr-text-secondary'
              }`}
              style={{ transition: 'background var(--smr-transition-fast)' }}
            >
              <span className="text-base">{l.flag}</span>
              <span className="flex-1">{l.label}</span>
              {l.code === locale && <Check size={14} className="text-[var(--smr-accent-cyan)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

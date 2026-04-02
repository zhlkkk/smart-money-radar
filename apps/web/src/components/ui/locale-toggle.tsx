'use client';

// 语言切换按钮 — 中/English

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Languages } from 'lucide-react';

interface LocaleToggleProps {
  className?: string;
  size?: number;
}

export function LocaleToggle({ className = '', size = 16 }: LocaleToggleProps) {
  const locale = useLocale();
  const router = useRouter();

  function toggleLocale() {
    const next = locale === 'zh' ? 'en' : 'zh';
    document.cookie = `smr-locale=${next};path=/;max-age=${365 * 24 * 60 * 60}`;
    router.refresh();
  }

  return (
    <button
      onClick={toggleLocale}
      className={`cursor-pointer rounded-lg px-2 py-1.5 text-xs font-medium text-smr-text-muted transition hover:bg-[var(--smr-bg-hover)] hover:text-smr-text ${className}`}
      style={{ transition: 'all var(--smr-transition-fast)' }}
      aria-label={locale === 'zh' ? 'Switch to English' : '切换到中文'}
      title={locale === 'zh' ? 'English' : '中文'}
    >
      <span className="flex items-center gap-1">
        <Languages size={size} />
        {locale === 'zh' ? 'EN' : '中'}
      </span>
    </button>
  );
}

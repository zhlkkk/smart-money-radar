'use client';

// 侧边栏导航 — Lucide 图标 + 折叠 + 系统状态
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import {
  LayoutDashboard,
  Zap,
  Wallet,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StatusPulse } from '@/components/ui/status-pulse';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LocaleToggle } from '@/components/ui/locale-toggle';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  external?: boolean;
}

export function SidebarNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const t = useTranslations('sidebar');
  const tCommon = useTranslations('common');

  const navItems: NavItem[] = [
    { label: t('overview'), href: '/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: t('alertHistory'), href: '/dashboard/alerts', icon: <Zap size={18} /> },
    { label: t('walletList'), href: '/dashboard/wallets', icon: <Wallet size={18} /> },
    { label: t('dataMethodology'), href: '/#methodology', icon: <FileText size={18} />, external: true },
  ];

  return (
    <aside
      className={`flex h-screen flex-col border-r border-[var(--smr-glass-border)] bg-[var(--smr-bg-sidebar)] transition-[width] ${collapsed ? 'w-16' : 'w-56'}`}
      style={{ transition: 'width var(--smr-transition-normal)' }}
    >
      {/* Logo */}
      <div className="relative border-b border-[var(--smr-glass-border)] px-4 py-5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span
            className="text-lg font-bold text-[var(--smr-accent-cyan)]"
            style={{ textShadow: 'var(--smr-text-glow)' }}
          >
            SMR
          </span>
          {!collapsed && (
            <span className="text-xs text-smr-text-muted">
              Smart Money Radar
            </span>
          )}
        </Link>
      </div>

      {/* 导航链接 */}
      <nav className="flex-1 px-2 py-4">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              title={collapsed ? item.label : undefined}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer transition-all ${
                isActive
                  ? 'border-l-2 border-[var(--smr-accent-cyan)] bg-gradient-to-r from-[var(--smr-accent-cyan)]/10 to-transparent text-[var(--smr-accent-cyan)]'
                  : 'border-l-2 border-transparent text-smr-text-secondary hover:bg-[var(--smr-bg-hover)] hover:text-smr-text'
              }`}
              style={{ transition: 'all var(--smr-transition-fast)' }}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* 系统状态 */}
      <div className="border-t border-[var(--smr-glass-border)] px-3 py-3">
        {!collapsed ? (
          <StatusPulse status="ok" label={tCommon('systemNormal')} />
        ) : (
          <StatusPulse status="ok" />
        )}
      </div>

      {/* 底部工具栏 */}
      <div className="flex items-center justify-between border-t border-[var(--smr-glass-border)] px-3 py-3">
        <UserButton
          appearance={{
            elements: {
              rootBox: 'flex items-center',
            },
          }}
        />
        <div className="flex items-center gap-1">
          {!collapsed && (
            <>
              <LocaleToggle />
              <ThemeToggle size={14} />
            </>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="cursor-pointer rounded p-1 text-smr-text-muted transition-colors hover:bg-[var(--smr-bg-hover)] hover:text-smr-text"
            aria-label={collapsed ? t('expand') : t('collapse')}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>
    </aside>
  );
}

'use client';

// 侧边栏导航组件（Client Component，需要 usePathname）

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: '总览', href: '/dashboard', icon: '◈' },
  { label: '告警历史', href: '/dashboard/alerts', icon: '⚡' },
  { label: '钱包列表', href: '/dashboard/wallets', icon: '◎' },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-zinc-800 bg-[#0A0A0A]">
      {/* Logo */}
      <div className="border-b border-zinc-800 px-4 py-5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-bold text-[#00F0FF]">SMR</span>
          <span className="text-xs text-zinc-500">Smart Money Radar</span>
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
              className={`mb-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-[#00F0FF]/10 text-[#00F0FF]'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 底部用户按钮 */}
      <div className="border-t border-zinc-800 px-4 py-4">
        <UserButton
          appearance={{
            elements: {
              rootBox: 'flex items-center gap-2',
            },
          }}
        />
      </div>
    </aside>
  );
}

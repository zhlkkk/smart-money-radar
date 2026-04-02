'use client';

// Clerk 主题动态切换包装器
// 根据当前 dark/light 模式动态传入 Clerk appearance

import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { useTheme } from '@/components/theme-provider';
import type { ReactNode } from 'react';

export function ClerkThemeWrapper({ children }: { children: ReactNode }) {
  const { theme } = useTheme();

  return (
    <ClerkProvider
      appearance={{
        baseTheme: theme === 'dark' ? dark : undefined,
        variables: {
          colorBackground: theme === 'dark' ? '#0f1629' : '#ffffff',
          colorPrimary: theme === 'dark' ? '#00f0ff' : '#0891b2',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}

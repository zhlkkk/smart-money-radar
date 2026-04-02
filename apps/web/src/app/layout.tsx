import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import '@fontsource/space-grotesk/300.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Smart Money Radar',
  description: 'Solana 链上聪明钱实时追踪 — AI 分析告警',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorBackground: '#0a0e1a',
          colorPrimary: '#00f0ff',
        },
      }}
    >
      <html lang="zh-CN" className="dark">
        <body className="min-h-screen bg-smr-bg text-smr-text antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
});

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
      <html
        lang="zh-CN"
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} dark`}
      >
        <body className="min-h-screen bg-smr-bg text-smr-text antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

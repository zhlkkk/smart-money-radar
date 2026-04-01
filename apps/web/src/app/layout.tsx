import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Smart Money Radar',
  description: 'Real-time Solana smart money alerts',
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
          colorBackground: '#0A0A0A',
          colorPrimary: '#00F0FF',
        },
      }}
    >
      <html lang="zh-CN" className={`${jetbrainsMono.variable} dark`}>
        <body className="min-h-screen bg-[#0A0A0A] text-white antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

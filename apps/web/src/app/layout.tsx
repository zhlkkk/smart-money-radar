import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
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
import { ThemeProvider } from '@/components/theme-provider';
import { ClerkThemeWrapper } from '@/components/clerk-theme-wrapper';

export const metadata: Metadata = {
  title: 'Smart Money Radar',
  description: 'Solana smart money real-time tracking — AI-powered alerts',
};

// 防主题闪烁的同步脚本
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('smr-theme');if(t==='light'||t==='dark'){document.documentElement.className=t}else if(window.matchMedia('(prefers-color-scheme:light)').matches){document.documentElement.className='light'}}catch(e){}})()`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-smr-bg text-smr-text antialiased">
        <ThemeProvider>
          <ClerkThemeWrapper>
            <NextIntlClientProvider messages={messages}>
              {children}
            </NextIntlClientProvider>
          </ClerkThemeWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}

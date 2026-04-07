'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { GridBackground } from '@/components/ui/grid-background';
import { Loader2 } from 'lucide-react';

declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: string) => void };
      Initialize: (opts: { token: string }) => void;
      Checkout: { open: (opts: { transactionId: string }) => void };
    };
  }
}

const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? '';
const PADDLE_ENVIRONMENT = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT ?? 'production';

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const txnId = searchParams.get('_ptxn');

  useEffect(() => {
    if (!txnId) return;

    // Load Paddle.js
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.onload = () => {
      if (!window.Paddle) return;
      if (PADDLE_ENVIRONMENT === 'sandbox') {
        window.Paddle.Environment.set('sandbox');
      }
      window.Paddle.Initialize({ token: PADDLE_CLIENT_TOKEN });
      window.Paddle.Checkout.open({ transactionId: txnId });
    };
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [txnId]);

  return (
    <main className="relative flex min-h-screen items-center justify-center">
      <GridBackground />
      <div className="relative flex flex-col items-center gap-4">
        <Loader2 size={32} className="animate-spin text-[var(--smr-accent-cyan)]" />
        <p className="text-smr-text-secondary">Loading checkout...</p>
      </div>
    </main>
  );
}

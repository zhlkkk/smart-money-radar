'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export function PaddleCheckoutButton() {
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  const t = useTranslations('pricing');
  const [loading, setLoading] = useState(false);

  if (!isSignedIn) {
    return (
      <button
        onClick={() => router.push('/sign-in?redirect_url=/pricing')}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--smr-glass-border)] bg-[var(--smr-bg-elevated)] py-3 text-sm font-medium text-smr-text transition hover:bg-[var(--smr-bg-hover)]"
      >
        <CreditCard size={16} />
        {t('loginFirst')}
      </button>
    );
  }

  async function handleCheckout() {
    if (!user) return;
    setLoading(true);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkUserId: user.id,
          email: user.primaryEmailAddress?.emailAddress ?? '',
        }),
      });

      if (!res.ok) throw new Error('Checkout failed');

      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--smr-glass-border)] bg-[var(--smr-bg-elevated)] py-3 text-sm font-medium text-smr-text transition hover:bg-[var(--smr-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
      {loading ? t('processing') : t('cardPayButton')}
    </button>
  );
}

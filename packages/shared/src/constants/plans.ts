// --- Subscription plan definitions ---
// Phase 2: single plan only. Phase 3 may introduce tiered pricing.

export interface PlanDefinition {
  id: string;
  name: string;
  priceMonthly: number;
  currency: string;
  features: string[];
}

export const PLANS: Record<string, PlanDefinition> = {
  pro: {
    id: 'pro',
    name: 'Smart Money Pro',
    priceMonthly: 100,
    currency: 'usd',
    features: [
      'Real-time smart money alerts via Telegram',
      'AI-powered buy rationale (<50 words)',
      'Rug-pull protection (Mint/Freeze authority check)',
      'Web Dashboard with alert history',
      'Tracked wallet details and scoring',
    ],
  },
} as const;

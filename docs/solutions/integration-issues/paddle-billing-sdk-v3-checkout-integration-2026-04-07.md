---
title: Paddle Billing SDK v3 Checkout Integration
date: 2026-04-07
category: integration-issues
module: payments
problem_type: integration_issue
component: backend
symptoms:
  - Checkout button returns 500 with no error log
  - Checkout redirects to app homepage instead of payment page
  - "Page Not Found" on checkout.paddle.com
  - "Default Payment Link has not yet been defined" error
  - "billing_details must be null if collection_mode=automatic" error
root_cause: api_contract_mismatch
resolution_type: code_fix
severity: high
tags: [paddle, billing, checkout, payment, sdk-v3, paddle-js, overlay]
---

# Paddle Billing SDK v3 Checkout Integration

## Problem

Integrating Paddle Billing (SDK v3, `@paddle/paddle-node-sdk@3.6.1`) for subscription payments in a Fastify + Next.js project. Multiple issues due to SDK v3 API differences from documentation examples and Paddle Classic.

## Symptoms

- Backend `POST /api/v1/checkout` returns 500 silently (no error log)
- Clicking checkout button does nothing (frontend fetching wrong URL)
- Checkout redirects to app homepage instead of Paddle payment page
- `checkout.paddle.com/payment?txn=` shows "Page Not Found"

## What Didn't Work

- **`transaction.checkoutUrl`** — SDK docs example shows this property, but the actual SDK v3 Transaction class uses `transaction.checkout?.url` (nested object, not flat property)
- **`checkout.paddle.com/payment?txn=`** — This is Paddle Classic's hosted checkout URL format. Paddle Billing uses a completely different flow (Paddle.js overlay)
- **`billingDetails: { enableCheckout: true }`** — Only valid for `collectionMode: 'manual'`. Default `automatic` mode throws error if billingDetails is set
- **Direct client-side fetch to backend** — Frontend `NEXT_PUBLIC_BACKEND_URL` was empty, causing request to go to Vercel instead of Railway backend

## Solution

### 1. Backend: Simple transaction creation (no billingDetails)

```typescript
// apps/backend/src/stripe/checkout.ts
const transaction = await config.paddle.transactions.create({
  items: [{ priceId: config.priceId, quantity: 1 }],
  customData: { clerkUserId: body.clerkUserId },
});

// SDK v3: checkout URL is at transaction.checkout?.url
const url = transaction.checkout?.url;
```

### 2. Frontend: Proxy through Next.js API route

```typescript
// apps/web/src/app/api/checkout/route.ts
export async function POST(request: Request) {
  const baseUrl = process.env.BACKEND_API_URL;
  const body = await request.json();
  const res = await fetch(`${baseUrl}/api/v1/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
```

### 3. Frontend: Paddle.js overlay checkout page

Paddle Billing returns URL like `https://your-app.com/checkout?_ptxn=txn_xxx`. This requires a page that loads Paddle.js to open the checkout overlay:

```typescript
// apps/web/src/app/checkout/page.tsx
useEffect(() => {
  if (!txnId) return;
  const script = document.createElement('script');
  script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
  script.onload = () => {
    window.Paddle.Initialize({ token: PADDLE_CLIENT_TOKEN });
    window.Paddle.Checkout.open({ transactionId: txnId });
  };
  document.head.appendChild(script);
}, [txnId]);
```

### 4. Required configuration

**Paddle Dashboard:**
- Checkout Settings → Default Payment Link → `https://your-app.com/checkout`
- Developer Tools → Notifications → Create destination → URL: `https://your-backend.com/webhooks/paddle`
- Catalog → Products → Create product + price → Note the `pri_xxx` ID

**Backend env vars (Railway):**
| Variable | Source |
|----------|--------|
| `PADDLE_API_KEY` | Developer Tools → API keys |
| `PADDLE_WEBHOOK_SECRET` | Notifications → destination secret |
| `PADDLE_PRICE_ID` | Catalog → price ID (`pri_xxx`) |
| `PADDLE_ENVIRONMENT` | `production` |

**Frontend env vars (Vercel):**
| Variable | Source |
|----------|--------|
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Developer Tools → Client-side tokens |
| `NEXT_PUBLIC_PADDLE_ENVIRONMENT` | `production` |

## Why This Works

Paddle Billing (v3) uses a fundamentally different checkout flow than Paddle Classic:
- **Classic**: Server creates transaction → redirect to `checkout.paddle.com` hosted page
- **Billing**: Server creates transaction → redirect to your app with `?_ptxn=` → Paddle.js opens overlay on your page

The Default Payment Link tells Paddle where to redirect with the `_ptxn` parameter. Paddle.js reads this parameter and opens the checkout overlay inline.

## Prevention

- **Always read SDK type definitions** (`node_modules/@paddle/paddle-node-sdk/dist/types/`) before assuming field names — documentation examples may lag behind SDK reality
- **Never hard-code checkout domains** — Paddle Classic (`checkout.paddle.com`) and Paddle Billing use different flows
- **Proxy all client→backend calls through Next.js API routes** — avoids CORS issues and missing `NEXT_PUBLIC_*` env vars
- **Add error logging to all 500 response branches** — the original `if (!url) return reply.status(500)` had no log, making debugging blind
- **Test with Paddle sandbox first** — set `PADDLE_ENVIRONMENT=sandbox` to avoid real charges during integration

## Related Issues

- `docs/solutions/best-practices/unwired-modules-first-deployment-pattern-2026-04-01.md` — similar pattern of "code exists but isn't wired up correctly"

---
title: "SSE Real-time Alert Streaming + Timeline UI Pattern"
date: 2026-04-02
category: best-practices
module: alerts
problem_type: best_practice
component: frontend_backend
severity: medium
applies_when:
  - "Building real-time data feeds in Next.js + Fastify stack"
  - "Need SSE streaming through Next.js API proxy"
  - "Implementing pause/resume for live data feeds"
  - "Timeline UI with mixed real-time and historical data"
tags:
  - sse
  - real-time
  - fastify
  - nextjs-proxy
  - timeline-ui
  - event-emitter
  - pause-resume
---

# SSE Real-time Alert Streaming + Timeline UI Pattern

## Context

Smart Money Radar's Dashboard Alert History page initially showed only server-rendered historical alerts. Users wanted to see new alerts arrive in real-time without refreshing. The solution needed to work within the existing architecture: Fastify backend on Railway + Next.js frontend on Vercel.

## Guidance

### Architecture: 3-Layer SSE

```
Fastify Pipeline → EventEmitter (in-memory bus) → SSE endpoint
    ↓
Next.js API Route (proxy) → EventSource (client)
```

**Layer 1: Event Bus (backend)**

```typescript
// events.ts — global singleton, not per-request
import { EventEmitter } from 'node:events';
export const alertBus = new EventEmitter();
alertBus.setMaxListeners(100);
```

Pipeline emits after enrichment, BEFORE Telegram send (so SSE and Telegram fire in parallel via `Promise.allSettled`).

**Layer 2: SSE Endpoint (backend)**

```typescript
// Fastify SSE — use reply.hijack() to prevent auto-close
app.get('/api/v1/alerts/stream', async (request, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no', // critical for Railway proxy
  });
  reply.raw.write(': connected\n\n');

  function onAlert(data) {
    reply.raw.write(`event: alert\ndata: ${JSON.stringify(data)}\n\n`);
  }
  alertBus.on('alert', onAlert);

  const heartbeat = setInterval(() => reply.raw.write(': heartbeat\n\n'), 30_000);
  request.raw.on('close', () => { alertBus.off('alert', onAlert); clearInterval(heartbeat); });
  await reply.hijack();
});
```

**Layer 3: Next.js API Proxy (frontend)**

Don't expose backend URL to client. Proxy through Next.js Route Handler:

```typescript
// app/api/alerts/stream/route.ts
export async function GET() {
  const upstream = await fetch(`${process.env.BACKEND_API_URL}/api/v1/alerts/stream`);
  return new Response(upstream.body, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

Client connects to `/api/alerts/stream` (same origin, no CORS).

### Pause/Resume Pattern

SSE connection stays open during pause (no reconnect overhead). New alerts buffer in a ref:

```typescript
const pausedRef = useRef(false);
const pendingRef = useRef<AlertRow[]>([]);

// In SSE callback:
if (pausedRef.current) {
  pendingRef.current = [data, ...pendingRef.current].slice(0, 50);
} else {
  setAlerts(prev => [data, ...prev].slice(0, 50));
}

// On resume:
setAlerts(prev => [...pendingRef.current, ...prev].slice(0, 50));
pendingRef.current = [];
```

### Timeline UI: Unified Layout

Real-time and historical alerts share one timeline. Key layout values that must align:

```
Container: pl-6 (24px left padding)
Vertical line: left-[7px] (centered on 15px dot container)
Dot container: -left-6 (pulls back into the padding)
Dot: h-2.5 w-2.5 centered in 15px container

Live alerts: green dots (fresh)
History alerts: cyan dots (established)
```

## Why This Matters

1. **SSE > WebSocket for one-way push** — simpler, HTTP-native, auto-reconnect, no upgrade negotiation
2. **Proxy avoids CORS + hides backend** — client never knows Railway URL
3. **Pause/resume keeps SSE open** — no reconnection delay, buffered alerts merge cleanly
4. **`reply.hijack()`** — critical Fastify detail; without it, Fastify auto-closes the response
5. **`X-Accel-Buffering: no`** — Railway uses Nginx proxy that buffers SSE by default; this header disables it

## When to Apply

- Adding real-time features to Next.js + Fastify apps deployed on Railway/Vercel
- Any SSE endpoint behind a reverse proxy (need `X-Accel-Buffering: no`)
- Mixing real-time and historical data in a single timeline UI
- Need pause/resume without dropping the connection

## Examples

**Token symbol enrichment** (related fix): DexScreener's `baseToken.symbol` used as fallback when Helius doesn't provide tokenSymbol — reduces "Unknown token" display from ~60% to ~5%.

**DB persistence bug** (related fix): `createPipeline()` was called before `db` initialization, so `config.db` was undefined. Pipeline's graceful degradation silently skipped DB writes while Telegram worked. Fix: move db init before pipeline creation.

## Related

- [Fire-and-Forget Webhook Graceful Degradation](fire-and-forget-webhook-graceful-degradation-2026-03-31.md)
- [Unwired Modules First Deployment Pattern](unwired-modules-first-deployment-pattern-2026-04-01.md)

// Admin backtest SSE proxy — streams progress events from backend

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = process.env.BACKEND_API_URL?.replace(/\/$/, '');
  const adminKey = process.env.ADMIN_API_KEY;

  if (!baseUrl || !adminKey) {
    return new Response('Backend not configured', { status: 503 });
  }

  const upstream = await fetch(`${baseUrl}/api/v1/admin/backtest/stream`, {
    headers: { 'X-Admin-Key': adminKey },
    // @ts-expect-error -- Next.js fetch supports duplex for streaming
    duplex: 'half',
    cache: 'no-store',
  });

  if (!upstream.ok || !upstream.body) {
    return new Response('SSE upstream unavailable', { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

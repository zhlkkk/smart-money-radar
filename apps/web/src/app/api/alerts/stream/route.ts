// SSE 代理 — 将后端 SSE 流转发给前端客户端
// 这样前端不需要知道后端地址，也避免 CORS 问题

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = process.env.BACKEND_API_URL;
  const apiKey = process.env.BACKEND_API_KEY;

  if (!baseUrl) {
    return new Response('Backend not configured', { status: 503 });
  }

  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/alerts/stream`;

  const upstream = await fetch(url, {
    headers: apiKey ? { 'X-API-Key': apiKey } : {},
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

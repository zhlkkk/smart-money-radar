// Paddle checkout proxy — forwards to backend /api/v1/checkout

export async function POST(request: Request) {
  const baseUrl = process.env.BACKEND_API_URL;

  if (!baseUrl) {
    return Response.json({ error: 'Backend not configured' }, { status: 503 });
  }

  const body = await request.json();

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return Response.json(data, { status: res.status });
}

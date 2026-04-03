// Admin backtest report proxy — returns latest report markdown + stats

import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await currentUser();
  const metadata = user?.publicMetadata as { role?: string } | undefined;
  if (metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const baseUrl = process.env.BACKEND_API_URL?.replace(/\/$/, '');
  const adminKey = process.env.ADMIN_API_KEY;

  if (!baseUrl || !adminKey) {
    return NextResponse.json({ error: 'Backend not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/admin/backtest/report`, {
      headers: { 'X-Admin-Key': adminKey },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}

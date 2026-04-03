// Admin backtest proxy — POST triggers a backtest, GET returns status
// Requires Clerk admin role

import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

function getAdminConfig() {
  const baseUrl = process.env.BACKEND_API_URL?.replace(/\/$/, '');
  const adminKey = process.env.ADMIN_API_KEY;
  return { baseUrl, adminKey };
}

async function checkAdmin(): Promise<NextResponse | null> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await currentUser();
  const metadata = user?.publicMetadata as { role?: string } | undefined;
  if (metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function POST() {
  const denied = await checkAdmin();
  if (denied) return denied;

  const { baseUrl, adminKey } = getAdminConfig();
  if (!baseUrl || !adminKey) {
    return NextResponse.json({ error: 'Backend not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/admin/backtest`, {
      method: 'POST',
      headers: { 'X-Admin-Key': adminKey },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}

export async function GET() {
  const denied = await checkAdmin();
  if (denied) return denied;

  const { baseUrl, adminKey } = getAdminConfig();
  if (!baseUrl || !adminKey) {
    return NextResponse.json({ error: 'Backend not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/admin/backtest/status`, {
      headers: { 'X-Admin-Key': adminKey },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}

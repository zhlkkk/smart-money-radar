// Telegram 绑定状态查询代理路由
// 将前端客户端请求转发到后端 API，隐藏 API Key

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const BACKEND_API_URL = process.env.BACKEND_API_URL?.replace(/\/$/, '') ?? '';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY ?? '';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const params = new URLSearchParams({ clerkUserId: userId });
    const res = await fetch(
      `${BACKEND_API_URL}/api/v1/telegram/status?${params.toString()}`,
      {
        headers: {
          'X-API-Key': BACKEND_API_KEY,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: text || '查询绑定状态失败' },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: '查询绑定状态失败' },
      { status: 500 },
    );
  }
}

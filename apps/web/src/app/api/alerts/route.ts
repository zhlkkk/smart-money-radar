// 告警代理路由
// 将前端客户端请求转发到后端 API，隐藏 API Key

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getAlerts } from '@/lib/backend-client';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get('cursor') ?? undefined;
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 100);

  try {
    const data = await getAlerts(cursor, limit);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: '获取告警失败' },
      { status: 500 },
    );
  }
}

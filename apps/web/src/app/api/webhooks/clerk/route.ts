import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { createHttpClient, users } from '@radar/db';

/** Clerk webhook 事件载荷中的用户数据结构 */
interface ClerkUserEventData {
  id: string;
  email_addresses: Array<{
    email_address: string;
    id: string;
  }>;
  first_name: string | null;
  last_name: string | null;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserEventData;
}

/**
 * 获取数据库客户端（延迟初始化）
 * 使用 Neon HTTP 驱动，适合 Vercel serverless 环境
 */
function getDb() {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL 环境变量未设置');
  }
  return createHttpClient(databaseUrl);
}

/**
 * 从 Clerk 用户数据中提取显示名称
 */
function buildDisplayName(data: ClerkUserEventData): string | null {
  const parts = [data.first_name, data.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * POST /api/webhooks/clerk
 *
 * 处理 Clerk webhook 事件，将用户数据同步到 DB。
 * - user.created → 插入新用户记录
 * - user.deleted → 软删除（设置 deletedAt）
 *
 * Clerk 使用 Svix 进行 webhook 签名验证。
 */
export async function POST(request: Request): Promise<Response> {
  const webhookSecret = process.env['CLERK_WEBHOOK_SECRET'];
  if (!webhookSecret) {
    console.error('[clerk-webhook] CLERK_WEBHOOK_SECRET 环境变量未设置');
    return new Response('Server misconfigured', { status: 500 });
  }

  // 读取 Svix 签名头
  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn('[clerk-webhook] 缺少 Svix 签名头');
    return new Response('Missing svix headers', { status: 400 });
  }

  // 读取并验证 webhook 载荷
  const body = await request.text();
  const wh = new Webhook(webhookSecret);

  let event: ClerkWebhookEvent;
  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error('[clerk-webhook] 签名验证失败:', err);
    return new Response('Invalid signature', { status: 401 });
  }

  const { type, data } = event;
  console.log(`[clerk-webhook] 收到事件: ${type}, clerkId: ${data.id}`);

  try {
    const db = getDb();

    if (type === 'user.created') {
      const primaryEmail = data.email_addresses[0]?.email_address;
      if (!primaryEmail) {
        console.error('[clerk-webhook] user.created 事件缺少 email');
        return new Response('Missing email', { status: 400 });
      }

      await db.insert(users).values({
        clerkId: data.id,
        email: primaryEmail,
        name: buildDisplayName(data),
      });

      console.log(`[clerk-webhook] 用户已创建: ${data.id}`);
    }

    if (type === 'user.deleted') {
      await db
        .update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.clerkId, data.id));

      console.log(`[clerk-webhook] 用户已软删除: ${data.id}`);
    }
  } catch (err) {
    console.error(`[clerk-webhook] 处理事件 ${type} 失败:`, err);
    return new Response('Internal error', { status: 500 });
  }

  return new Response('OK', { status: 200 });
}

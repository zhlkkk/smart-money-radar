'use server';

// Stripe Checkout Server Action
// 调用后端 POST /api/v1/checkout 创建 Stripe Checkout 会话

interface CheckoutResult {
  url: string | null;
  error: string | null;
}

export async function createCheckoutSession(
  clerkUserId: string,
  email: string,
): Promise<CheckoutResult> {
  const baseUrl = process.env.BACKEND_API_URL;
  const apiKey = process.env.BACKEND_API_KEY;

  if (!baseUrl || !apiKey) {
    return { url: null, error: '服务配置错误，请联系管理员' };
  }

  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, '')}/api/v1/checkout`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({ clerkUserId, email }),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '未知错误');
      return { url: null, error: `创建支付会话失败: ${text}` };
    }

    const data = (await res.json()) as { url: string };
    return { url: data.url, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : '网络错误';
    return { url: null, error: `请求失败: ${message}` };
  }
}

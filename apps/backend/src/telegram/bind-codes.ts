// ─── 绑定验证码管理（内存 Map + TTL） ───

import { randomBytes } from 'node:crypto';

const TTL_MS = 10 * 60 * 1000; // 10 分钟过期

interface BindCodeEntry {
  clerkUserId: string;
  createdAt: number;
}

/** code → entry */
const codeMap = new Map<string, BindCodeEntry>();

/** clerkUserId → code（用于覆盖旧码） */
const userToCode = new Map<string, string>();

/**
 * 生成 8 位字母数字混合验证码，存入内存 Map，10 分钟 TTL。
 * 同一 clerkUserId 重复生成会覆盖旧码。
 */
export function generateBindCode(clerkUserId: string): string {
  // 每次 generate 时清理过期条目
  cleanup();

  // 删除该用户旧码
  const oldCode = userToCode.get(clerkUserId);
  if (oldCode) {
    codeMap.delete(oldCode);
  }

  // hex 编码只含 0-9a-f，取 8 位即可
  const code = randomBytes(4).toString('hex').toUpperCase();
  codeMap.set(code, { clerkUserId, createdAt: Date.now() });
  userToCode.set(clerkUserId, code);
  return code;
}

/**
 * 验证并消费验证码。成功返回 clerkUserId，失败返回 null。
 * 一次性使用：消费后立即删除。
 */
export function consumeBindCode(code: string): string | null {
  const entry = codeMap.get(code);
  if (!entry) return null;

  // 检查是否过期
  if (Date.now() - entry.createdAt > TTL_MS) {
    codeMap.delete(code);
    userToCode.delete(entry.clerkUserId);
    return null;
  }

  // 消费：删除码
  codeMap.delete(code);
  userToCode.delete(entry.clerkUserId);
  return entry.clerkUserId;
}

/** 清理所有过期条目 */
function cleanup(): void {
  const now = Date.now();
  for (const [code, entry] of codeMap) {
    if (now - entry.createdAt > TTL_MS) {
      codeMap.delete(code);
      userToCode.delete(entry.clerkUserId);
    }
  }
}

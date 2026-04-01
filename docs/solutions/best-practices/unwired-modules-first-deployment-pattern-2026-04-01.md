---
title: "首次部署暴露未接线模块：系统性检查清单"
date: 2026-04-01
category: best-practices
module: backend-deployment
problem_type: best_practice
component: development_workflow
severity: high
applies_when:
  - 首次部署 TypeScript monorepo 至生产环境
  - 新增 Fastify 路由或启动逻辑后部署
  - 切换 LLM 提供商或第三方 API
tags:
  - deployment
  - integration
  - monorepo
  - pnpm
  - fastify
  - wiring
  - error-handling
  - docker
---

# 首次部署暴露未接线模块：系统性检查清单

## Context

TypeScript pnpm monorepo（Fastify 后端 + Next.js 前端）首次部署至 Railway + Vercel，集中暴露 10+ 个问题。共性模式：**模块被单独实现和测试，但从未被正确接入主程序入口或互相连接。** 单元测试直接调用模块函数，永远不会发现"入口没有调用"这一问题。

问题分五类：
1. 未注册模块（路由、钩子、启动函数定义了但没有调用）
2. 静默吞错（catch 块无日志，错误无声消失）
3. Docker 构建陷阱（pnpm 符号链接在多阶段构建中断裂）
4. API 集成细节（只读字段、中间账户路由）
5. 配置与提供商问题（模型 ID 过期、base URL 格式、余额耗尽）

## Guidance

### 原则一：模块注册清单

每个新模块实现完成后，立即检查三个连接点：

**A. 入口文件注册** — `index.ts` 中必须有显式调用，不要假设框架自动扫描：

```typescript
// 错误：定义了但没有注册
export async function registerHealthRoutes(app: FastifyInstance) { ... }

// 正确：在 index.ts 中显式注册，注意依赖顺序
const db = env.DATABASE_POOL_URL ? createPoolClient(env.DATABASE_POOL_URL) : null;
registerHealthRoutes(app, { db });        // db 可选
if (db) {
  registerAlertsRoutes(app, { db });      // db 必须在前
  registerWalletsRoutes(app, { db });
}
```

**B. 启动时调用** — syncTrackedWallets 等必须在 server.listen 前显式调用：

```typescript
if (db) {
  await syncTrackedWallets(db, pinnedEntries);  // 不调用 = 数据库永远为空
}
await app.listen({ port: env.PORT, host: '0.0.0.0' });
```

**C. 框架钩子连接** — process 级 handler 不捕获 Fastify 路由错误：

```typescript
// 不够：只能捕获 Fastify 自身崩溃
process.on('uncaughtException', ...)

// 必须同时注册：
app.addHook('onError', (_req, _reply, error, done) => {
  Sentry.captureException(error);
  done();
});
```

### 原则二：零静默吞错

所有 catch 块必须包含可观测的日志。"有错误但找不到"比"服务崩溃"更危险。

```typescript
// 禁止
try { return await callAI(prompt); }
catch { return ''; }

// 强制
try { return await callAI(prompt); }
catch (err) {
  console.error('[attribution] AI failed', {
    error: err instanceof Error ? err.message : String(err),
    tokenMint: input.tokenMint,
  });
  return '';
}
```

注意：`console.warn`/`console.debug` 在 Node.js 中都输出到 stderr，Railway 等平台会捕获为 info 级别。要么用 Fastify logger（受 level 控制），要么直接不输出。

### 原则三：pnpm 单阶段 Dockerfile

pnpm 用符号链接管理 `node_modules`，多阶段 `COPY --from=builder` 无法正确复制符号链接。`2>/dev/null || true` 是 shell 语法，在 Dockerfile COPY 指令中无效。

```dockerfile
# 正确：单阶段，保留 pnpm 完整目录结构
FROM node:22-slim
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile

COPY apps/backend ./apps/backend
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
```

Docker 层缓存仍然有效：package.json + lockfile 不变时，`pnpm install` 层被缓存。

### 原则四：第三方 API 写操作审查字段

GET 响应包含只读字段（ID、创建时间等），直接 spread 进 PUT 会返回 400：

```typescript
// 危险
const current = await getWebhook(id);
await putWebhook(id, { ...current, accountAddresses: newAddrs });

// 安全：只传可写字段
await putWebhook(id, {
  webhookURL: current.webhookURL,
  transactionTypes: current.transactionTypes,
  accountAddresses: newAddrs,
  webhookType: current.webhookType,
  authHeader: current.authHeader,
});
```

### 原则五：聚合器 DEX 双向账户检查

OKX、TITAN 等聚合器通过中间账户路由，被监控钱包可能出现在 `fromUserAccount`（发送基础代币）而非 `toUserAccount`：

```typescript
// Pass 1: 非基础代币接收方是 watched wallet
for (const t of transfers) {
  if (watched.has(t.toUserAccount) && !BASE_MINTS.has(t.mint)) return match;
}
// Pass 2: watched wallet 发送基础代币，找同笔交易中的非基础代币
for (const t of transfers) {
  if (watched.has(t.fromUserAccount) && BASE_MINTS.has(t.mint)) {
    const received = transfers.find(t2 => !BASE_MINTS.has(t2.mint));
    if (received) return match;
  }
}
```

### 原则六：LLM 提供商无关化

使用 OpenAI-compatible 接口 + 环境变量抽象，切换提供商只改配置：

```typescript
const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
  headers: { Authorization: `Bearer ${LLM_API_KEY}` },
  body: JSON.stringify({ model: LLM_MODEL, messages }),
});
```

常见陷阱：
- `LLM_BASE_URL` 必须包含 `/v1`（如 `https://poloai.top/v1`），否则返回 HTML 页面
- 模型 ID 放环境变量，不硬编码（过期时只改配置）
- 429 限流要加重试（1 秒退避，最多 2 次）

## Why This Matters

**未注册模块**是 monorepo 最隐蔽的 Bug：代码存在、测试通过、类型检查干净，但功能在生产中完全无效。本次部署中，REST API 路由、钱包同步、Sentry 集成、Discovery 数据库同步**全部**属于此类。

**静默吞错**在事件驱动架构中危害极大：Helius webhook → 解析 → 富化 → AI → Telegram 链路中，任何环节的静默失败都让整条链路结果不可信。

**Docker pnpm 陷阱**只在首次部署暴露，本地完全正常。不了解 symlink 机制的情况下，调试成本极高。

## When to Apply

| 场景 | 原则 |
|------|------|
| 实现新 Fastify 路由模块 | 一A：立即在 index.ts 注册 |
| 实现启动时运行的逻辑 | 一B：在 server.listen 前调用 |
| 任何 try/catch 块 | 二：必须有错误日志 |
| 首次配置 Docker 部署 | 三：pnpm 优先单阶段 |
| 调用第三方 API 的 PUT/PATCH | 四：审查只读字段 |
| 解析 DEX swap 交易 | 五：双向账户检查 |
| 配置 AI/LLM 调用 | 六：环境变量抽象 |

## Examples

### 案例 1：路由注册遗漏
- 症状：`GET /api/v1/alerts` 返回 404，但路由代码存在且单测通过
- 根因：`registerAlertsRoutes(app)` 从未在 `index.ts` 中调用
- 修复：按依赖顺序在 index.ts 显式注册所有路由

### 案例 2：AI 摘要全部为空
- 症状：Telegram 消息始终没有 AI 摘要行
- 根因：catch 块返回 `''` 但无任何日志 → 加日志后发现是 Anthropic 余额不足
- 修复：添加 `console.error` + 切换到 PoloAPI

### 案例 3：Helius webhook 更新 400
- 症状：Discovery cycle 完成但 rolled back
- 根因：PUT body 包含 GET 响应的 `webhookID`（只读字段）
- 修复：构造只含可写字段的 payload

### 案例 4：聚合器交易漏报
- 症状：OKX/TITAN 路由的 swap 未触发告警
- 根因：`parseSwap` 只检查 `toUserAccount`，聚合器把 watched wallet 放在 `fromUserAccount`
- 修复：增加 Pass 2 检查 `fromUserAccount`

### 案例 5：Docker 构建失败
- 症状：Railway 报 `"/packages/db/node_modules": not found`
- 根因：pnpm 不在每个包下创建 `node_modules`，多阶段 COPY 找不到路径
- 修复：改为单阶段 Dockerfile

## Related

- [fire-and-forget-webhook-graceful-degradation](../best-practices/fire-and-forget-webhook-graceful-degradation-2026-03-31.md) — Promise.allSettled 降级策略
- [auto-wallet-discovery-architecture](../best-practices/auto-wallet-discovery-architecture-2026-03-31.md) — Discovery 模块编排
- [parseswap-helius-payload-mismatch](../runtime-errors/parseswap-helius-payload-mismatch-2026-03-31.md) — parseSwap 防御性编码
- [nextjs16-monorepo-deployment-gotchas](../../knowledge-base/nextjs16-monorepo-deployment-gotchas.md) — Next.js 部署陷阱
- [cross-service-api-auth-pattern](../../knowledge-base/cross-service-api-auth-pattern.md) — Fastify + Next.js API 集成

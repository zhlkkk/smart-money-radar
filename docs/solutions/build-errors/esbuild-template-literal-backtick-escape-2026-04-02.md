---
title: "esbuild 模板字符串内裸反引号导致 TransformError 及 Railway healthcheck 超时"
date: 2026-04-02
category: build-errors
module: ai
problem_type: build_error
component: tooling
symptoms:
  - "esbuild TransformError: Expected ';' but found '等符号' at attribution.ts:54"
  - "Railway healthcheck failed: 1/1 replicas never became healthy (10s timeout)"
  - "服务完全无法启动，tsx 编译阶段即崩溃"
root_cause: config_error
resolution_type: code_fix
severity: critical
tags:
  - esbuild
  - template-literal
  - backtick
  - railway
  - healthcheck
  - deployment
  - tsx
---

# esbuild 模板字符串内裸反引号导致 TransformError 及 Railway healthcheck 超时

## Problem

Railway 部署后端 Fastify 服务失败。esbuild（tsx 底层）在编译 `attribution.ts` 时报 TransformError，服务无法启动，健康检查连带失败。

## Symptoms

- `Error [TransformError]: Transform failed with 1 error: /app/apps/backend/src/ai/attribution.ts:54:149: ERROR: Expected ";" but found "等符号"`
- `1/1 replicas never became healthy! Healthcheck failed! Path: /health, Retry window: 10s`
- 构建成功（Docker image 正常），但运行时 tsx 编译失败

## What Didn't Work

- 最初怀疑健康检查超时设置过短（10 秒），但这只是表象。即使调大超时，服务因编译错误根本启动不了，健康检查永远不会通过。

## Solution

### 修复一：转义模板字符串中的裸反引号

Before:
```typescript
return `用 <50 字中文总结...
要求：...纯文本输出，禁止使用任何 Markdown 格式（不要用 # * ** ` 等符号）。`
```

After:
```typescript
return `用 <50 字中文总结...
要求：...纯文本输出，禁止使用任何 Markdown 格式（不要用 # * ** \` 等符号）。`
```

### 修复二：增大健康检查超时

Before (`railway.toml`):
```toml
healthcheckTimeout = 10
```

After:
```toml
healthcheckTimeout = 300
```

## Why This Works

模板字符串以反引号作为定界符。当 prompt 文本中出现未转义的裸反引号时，esbuild 认为模板字符串在该处结束，随后的 `等符号）。` 变成无法解析的非法 token。转义为 `\`` 后，esbuild 正确将其视为字符串内容。

健康检查超时从 10 秒增大到 300 秒是为了适应 tsx 运行时编译 + 数据库连接 + 钱包同步的冷启动耗时。

## Prevention

- **CI 编译检查**：在 CI 中加入编译验证步骤（如 `tsc --noEmit`），确保部署前能捕获 TransformError
- **Prompt 外置**：将包含特殊字符的长 prompt 提取到独立 `.txt` 文件中用 `fs.readFileSync` 加载，从根本上避免定界符冲突
- **中文 prompt 警惕**：当 prompt 内容涉及"禁止使用某些符号"这类元描述时，所举例的符号可能与 JS 语法冲突（反引号、`${}` 等）
- **Railway healthcheck 基线**：使用 tsx 运行时编译的项目，`healthcheckTimeout` 至少设为 120 秒

## Related Issues

- `docs/solutions/best-practices/unwired-modules-first-deployment-pattern-2026-04-01.md` — Railway 部署通用失败模式（Docker pnpm 陷阱、路由注册遗漏），覆盖不同根因

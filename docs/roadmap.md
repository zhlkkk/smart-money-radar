# Smart Money Radar 路线图与进度

更新时间：2026-05-30

本文记录项目当前进度、已完成能力、正在暴露的风险和下一阶段路线图。历史细分计划仍保留在 `docs/plans/`。

## 当前阶段

当前阶段：Phase 3d 已完成，Phase 4 待启动。

产品已经具备：

- 实时 Solana smart money 告警 pipeline。
- 自动钱包发现与 Helius webhook 热更新。
- 数据可信度与价格交叉校验。
- Web Dashboard、订阅拦截、Telegram 绑定入口。
- Paddle + Helio 支付 webhook。
- 管理员回测 API 与页面。

## 已完成里程碑

| 阶段 | 状态 | 主要交付 |
| --- | --- | --- |
| Phase 2a | 已完成 | pnpm monorepo、Fastify、Vitest、ESLint/Prettier、Helius webhook、签名验证、交易解析、LRU 去重 |
| Phase 2b | 已完成 | REST API、告警分页、钱包列表/详情、Next.js Dashboard、Landing、Pricing、Paddle checkout、Vercel 部署准备 |
| Phase 3a | 已完成 | 明暗模式、Dashboard 视觉优化、AI 成本缓存、中英文 i18n、SSE 实时告警 |
| Phase 3b | 已完成 | 置信度评分、Telegram 数据源溯源、Dashboard 置信度展示能力、Landing 数据方法论 |
| Phase 3c | 已完成 | Birdeye 回测验证管线、DexScreener LRU+TTL 缓存、Raydium V3 价格交叉校验、stale/偏差降分 |
| Phase 3d | 已完成 | 回测 CLI seed-from-birdeye、BacktestRunner、Admin 回测 API、Admin 页面、采集失败日志 |

## 当前能力清单

### 实时告警

- `POST /webhook` 接收 Helius Enhanced Transaction Webhooks。
- 支持 signature 去重和基础 token 过滤。
- 支持质量过滤阈值：
  - liquidity >= 5000
  - FDV >= 50000
  - 24h volume >= 1000
  - pool age >= 5 minutes
- 支持风险标签：
  - mint authority 未撤销
  - freeze authority 未撤销
  - 流动性偏低
  - 24h 交易量偏低
  - 池子创建不足 24h
- 支持 AI 中文短摘要，失败时空字符串降级。
- 支持 Telegram、DB、SSE 三个交付面。

### 数据可靠性

- DexScreener 数据用于 liquidity、FDV、market cap、volume、pair age、symbol。
- Solana RPC 用于 mint/freeze authority 检查。
- Raydium V3 on-chain price 用于与 DexScreener price 做偏差检查。
- Birdeye metadata 用于 token symbol fallback。
- 置信度评分当前由链上权限、数据完整度、流动性、钱包来源、stale 数据、价格偏差共同决定。

### 钱包发现

- pinned wallets 来源：`apps/backend/config/smart-money-addresses.json`。
- discovered wallets 来源：
  - Birdeye gainers-losers / top traders。
  - hot token top traders。
  - Helius reverse counterparty tracker。
- 发现结果会：
  - 多源合并。
  - 评分排序。
  - 与 pinned wallets 合并。
  - 热更新 Helius webhook 地址。
  - 持久化到 JSON 和 DB。

### Web 与订阅

- Clerk 负责登录与路由保护。
- Dashboard 依赖 Clerk `publicMetadata.subscriptionStatus`。
- Admin 依赖 Clerk `publicMetadata.role === "admin"`。
- Paddle Billing 与 Helio Pay 都可写入订阅表。
- Web 端 API 通过 server-side proxy 调用 Fastify 后端。

### 回测

- CLI：`pnpm --filter backend backtest`
- Admin API：`POST /api/v1/admin/backtest`
- Admin 页面：`/admin/backtest`
- 支持从 discovery state 或 Birdeye seed 钱包。
- 输出聪明钱组和基线组对比报告。

## Phase 4 建议目标

Phase 4 建议聚焦“生产可信度”和“商业闭环一致性”，而不是继续堆新功能。

### P0：数据与 schema 对齐

目标：让数据库、API、前端类型和实际告警字段完全一致。

建议任务：

- 为 `alerts_history` 增加 `confidence_score`、`confidence_level`、`price_deviation`、`stale`、`risk_level`、`risk_factors` 等字段。
- 更新 `persistAlert`，实际写入置信度和数据可靠性字段。
- 更新 REST API 类型，删除前端对不存在字段的假设。
- 给历史告警卡片补齐置信度展示。
- 增加迁移测试和 API contract tests。

### P0：订阅模型去 Stripe 命名

目标：消除 Paddle/Helio 与 `stripe*` 字段命名不一致的问题。

建议任务：

- 新增 provider-neutral 字段：`provider`、`providerSubscriptionId`、`providerPriceId`。
- 迁移旧字段或保留兼容层。
- 更新 Paddle 与 Helio webhook 写入逻辑。
- 更新 Clerk metadata 同步策略，确保 Paddle 订阅也能可靠同步 `subscriptionStatus`。

### P0：生产访问控制

目标：避免公开后端端点泄露实时数据或被滥用。

建议任务：

- 为 `/api/v1/alerts/stream` 增加认证，或限制只允许 Web proxy 访问。
- 为 Telegram bind-code/status 后端端点增加认证。
- 校验 Admin SSE proxy 不把 `ADMIN_API_KEY` 暴露到客户端。
- 补充 rate limit 按端点细分配置。

### P1：Web E2E 与可观测性

目标：减少 Dashboard、支付、回测页面回归。

建议任务：

- 引入 Playwright。
- 覆盖登录后 dashboard paywall、活跃订阅 dashboard、alerts pagination、wallet detail、admin backtest。
- Sentry 增加 release/environment 标记。
- 增加结构化业务事件日志：告警过滤原因、Telegram 发送失败、discovery 变更、订阅 webhook 结果。

### P1：Discovery canonical state

目标：让生产环境以 DB 为权威状态，降低容器文件系统风险。

建议任务：

- discovery state 以 DB 为 canonical source。
- JSON 仅作为本地开发缓存或 debug dump。
- Helius webhook 地址更新后写入版本号和审计记录。
- Admin 页面展示当前监控地址、上次 refresh、上次 webhook sync 结果。

### P2：产品体验打磨

目标：提升付费用户留存和解释透明度。

建议任务：

- 告警详情页展示 enrichment source breakdown。
- 钱包详情页加入历史表现和最近交易统计。
- Telegram 绑定状态区分 `not_bound`、`bound_not_subscribed`、`bound_and_subscribed`。
- 用户自定义 watchlist 或 mute list。
- 告警筛选条件可配置。

## 当前风险登记

| 风险 | 等级 | 说明 | 建议处理阶段 |
| --- | --- | --- | --- |
| 历史告警置信度字段未持久化 | 高 | 前端类型与 DB schema 存在不一致 | Phase 4 P0 |
| 订阅字段命名遗留 Stripe | 中 | 支付 provider 扩展和排障成本高 | Phase 4 P0 |
| SSE 告警端点无鉴权 | 高 | 公开部署可能泄露实时告警 | Phase 4 P0 |
| pinned wallet 配置为空 | 中 | 本地/新环境可能无监控钱包 | Phase 4 P1 |
| Web E2E 覆盖不足 | 中 | 支付、Dashboard、Admin 回归难以及早发现 | Phase 4 P1 |

## 验收命令

常规验证：

```bash
pnpm --filter backend test
pnpm --filter backend typecheck
pnpm --filter web lint
pnpm --filter web build
pnpm --filter @radar/db test
```

回测验证：

```bash
pnpm --filter backend backtest
```

变更审阅：

```bash
git diff --stat
git diff
```


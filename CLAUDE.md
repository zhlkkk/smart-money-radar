# Smart Money Radar

Telegram bot that tracks smart money wallet activity on Solana and pushes real-time alerts. MVP: webhook listener -> parallel enrichment -> AI summary -> Telegram push.

## 必须遵守的工作流
- 所有新功能必须严格执行 docs/templates/combined-workflow.md 中的 6 步组合流程
- 每次修改后必须运行 /ce:compound

---

## 标准 6 步工作流

| 步骤 | 命令 | 核心作用 | 执行者 |
|------|------|----------|--------|
| 1. 产品级发散 | `/superpowers:brainstorm` | 澄清需求、用户故事、风险 | PM（主进程） |
| 2. 永久锁死知识 | `/ce:compound` | 把 PRD、技术决策写入知识库 | PM（主进程） |
| 3. 深度技术规划 | `/ce:plan` | 极深研究，输出详细计划 | PM（主进程） |
| 4. 结构化执行 | `/superpowers:execute-plan` | 强制 TDD、分模块实现 | Execution_Engineer 子代理 |
| 5. 自动 Review | `/ce:review` | 多维度审查 + 驳回/通过 | QA_Reviewer 子代理 |
| 6. 知识复合 | `/ce:compound` | 提炼模式、坑点、最佳实践 | PM（主进程） |

## Tech Stack

- **Runtime**: TypeScript + Node.js + Fastify
- **Data source**: Helius Enhanced Transaction Webhooks (Solana)
- **Enrichment**: DexScreener API (liquidity/FDV) + @solana/kit (mint/freeze authority checks)
- **AI**: Claude claude-3-5-haiku (<50 word Chinese summaries)
- **Delivery**: Telegram Bot API (private channel)
- **Monitoring**: Sentry + structured logging
- **Testing**: Vitest, TDD required (tests before implementation)

## Project Structure (pnpm workspaces monorepo)

```
apps/
  backend/            # Fastify backend service (TypeScript)
    src/
      webhook/        # Helius webhook handling (handler, parse, dedup)
      enrichment/     # Token enrichment (DexScreener, authority check)
      discovery/      # Auto wallet discovery (Birdeye client, scoring, orchestrator, persistence)
      ai/             # Claude AI attribution
      telegram/       # Telegram bot + alert formatting
    test/             # Vitest tests (mirrors src/ structure)
    config/           # Runtime config (smart-money-addresses.json)
  web/                # Next.js frontend (Phase 2, placeholder)
packages/
  shared/             # @radar/shared — shared types + constants (Phase 2)
  db/                 # @radar/db — database schema + clients (Phase 2)
docs/prd/             # Product requirements
docs/plans/           # Implementation plans
docs/solutions/       # Documented solutions and learnings
docs/knowledge-base/  # Compound Engineering 知识沉淀
docs/templates/       # 工作流模板
```

## Conventions

- **Language**: TypeScript strict mode. No `any` types.
- **Framework**: Fastify (NOT Express). Use Fastify plugins for cross-cutting concerns.
- **Package manager**: pnpm
- **Formatting**: Prettier + ESLint
- **Testing**: Vitest. Write tests first, then implementation. Integration tests for the full pipeline.
- **Error handling**: Graceful degradation. External API failures must never crash the service or block alerts. Use `Promise.allSettled` for parallel enrichment, timeouts on every external call, fallback values when data is unavailable.
- **Security**: Validate Helius webhook signatures on every request. Never store private keys. Rate limit all endpoints.
- **No Python**: The entire codebase is TypeScript/Node.js. Do not introduce Python or FastAPI.

## MVP Scope (Phase 1, Weeks 1-4)

The MVP is deliberately minimal. Core concerns:

1. **Monitor**: Receive Helius webhook events for smart money addresses (pinned + auto-discovered via Birdeye scoring pipeline)
2. **Enrich**: Parallel DexScreener + Solana RPC calls within 2-second budget
3. **Push**: Format and send Telegram alert (with AI summary or raw data fallback)
4. **Discover**: Birdeye API -> score & rank wallets -> hot-swap Helius webhook subscriptions (see `src/discovery/`)

**NOT in scope**: Web UI, payment system, backtesting, multi-chain. See `docs/solutions/documentation-gaps/smart-money-radar-mvp-prd-v1-1-2026-03-31.md` for the full PRD.

## 开发进度

### Phase 2a（已完成 ✅）— Unit 1 ~ Unit 4
- Unit 1: 项目骨架搭建（pnpm monorepo, Fastify, Vitest, ESLint/Prettier）
- Unit 2: Helius webhook handler（签名验证、路由注册）
- Unit 3: 交易解析器（Enhanced Transaction → 标准化 ParsedTrade）
- Unit 4: 去重服务（LRU cache + signature-based dedup）

### Phase 2b（已完成 ✅）— Unit 5 ~ Unit 10b
- Unit 5: Fastify REST API 层（X-API-Key 鉴权、游标分页告警、钱包列表/详情、增强 Health Check）✅
- Unit 8: Dashboard 页面（告警历史、钱包列表/详情、侧边栏导航、服务端订阅拦截、API 代理路由）✅
- Unit 9: Pricing 页面 + Landing Page（营销首页、PricingCard、Stripe Checkout Server Action）✅
- Unit 10b: 前端部署准备（Clerk Webhook/Proxy、Vercel 配置、部署清单、@radar/db .js 导入修复）✅
- 详见 `docs/plans/phase_2b_plan.md`

### Phase 3（进行中 🚧）— 产品打磨 + 数据可信度

#### Phase 3a（已完成 ✅）— UI 体验优化
- 明暗模式切换 + Dashboard 层次感优化 ✅
- AI 成本优化 ✅
- 中英文国际化 ✅
- SSE 实时告警推送 ✅

#### Phase 3b（已完成 ✅）— 数据信任层
- 告警置信度评分系统（链上验证 + 数据完整度 + 流动性 + 钱包评分 → 高/中/低）✅
- Telegram 告警模板改造（置信度标签 + 数据源溯源 + disclaimer）✅
- Dashboard 告警卡片置信度展示 ✅
- Landing Page 数据方法论 section ✅
- 侧边栏"数据说明"导航入口 ✅
- 详见 `docs/superpowers/specs/2026-04-02-data-trust-layer-design.md`

#### Phase 3c（已完成 ✅）— 数据可靠性提升
- Birdeye 聪明钱评分回测验证管线（采集 → 价格追踪 → 统计分析 → Markdown 报告，支持断点续跑）✅
- DexScreener LRU+TTL 本地缓存（30s/2000 条）+ stale-while-revalidate 降级 ✅
- Raydium V3 链上价格交叉校验（并行集成到 enrichment 管线，偏差 >5% 标记）✅
- 置信度降分规则（stale 数据 -10 分、价格偏差 >5% -10 分）✅
- 回测 CLI 脚本（`pnpm --filter backend backtest`）✅
- 详见 `docs/plans/2026-04-02-008-feat-data-reliability-phase3c-plan.md`

#### Phase 3d（已完成 ✅）— 回测管线端到端可运行 + 管理后台
- 回测 CLI `--seed-from-birdeye`：自动从 Birdeye 获取候选钱包，按 PnL 分组为聪明钱/基线组 ✅
- 基线对照组走完整 collect→track→analyze 管线，报告含数据来源说明 + 局限性标注 ✅
- BacktestRunner 服务模块（从 CLI 提取，支持进度回调）✅
- Admin 回测 API（POST 触发 / GET 状态 / GET 报告 / SSE 进度流，X-Admin-Key 鉴权）✅
- `/admin/backtest` 管理员页面（Clerk admin role 鉴权、触发按钮、实时进度条、报告展示）✅
- 采集失败日志可见化（HTTP 状态码 / API 错误 / 网络异常全部输出到 stderr）✅
- 详见 `docs/plans/2026-04-03-001-feat-backtest-runnable-plan.md` 和 `docs/plans/2026-04-03-002-feat-admin-backtest-dashboard-plan.md`

## Performance Targets

- End-to-end latency: < 5 seconds (Helius webhook -> Telegram message)
- Enrichment budget: < 2 seconds (parallel, with timeout fallback)
- Message reliability: 99.9%

## 验证命令

```bash
# 运行测试
pnpm --filter backend test

# 类型检查
pnpm --filter backend typecheck

# Lint 检查
pnpm --filter backend lint

# 查看变更
git diff --stat
git diff
```

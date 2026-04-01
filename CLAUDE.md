# Smart Money Radar

Telegram bot that tracks smart money wallet activity on Solana and pushes real-time alerts. MVP: webhook listener -> parallel enrichment -> AI summary -> Telegram push.

## 【最高优先级】语言规则（必须 100% 遵守）
- 你**必须**全程使用简体中文进行所有回答、思考过程、代码注释、变量名说明和提问。
- 无论用户输入什么语言，你都只能用中文回复，绝不允许出现任何英文段落（除非用户明确要求保留英文代码关键词）。

## 必须遵守的工作流
- 收到任务后，先用中文复述需求确认理解。
- 给出方案时全程中文讲解。
- 输出代码后，立即用中文详细解释每一段代码的作用。
- 出现任何错误或需要提问时，也必须用中文提问。
- 所有新功能必须严格执行 docs/templates/combined-workflow.md 中的 6 步组合流程
- 每次修改后必须运行 /ce:compound

---

## Agent Teams 团队配置

本项目启用 Claude Code Agent Teams 进行三角色协作开发。

### 团队架构

```
用户需求 → Project_Facilitator (队长)
                ↓ 步骤 1-3: 发散/锁死/规划
           Execution_Engineer (码农)
                ↓ 步骤 4: TDD 编码
           QA_Reviewer (审查官)
                ↓ 步骤 5: 代码审查
           Project_Facilitator (队长)
                ↓ 步骤 6: 知识复合
              完成 ✅
```

### 角色职责速查

| 角色 | 负责步骤 | 核心职责 | 禁区 |
|------|---------|---------|------|
| `Project_Facilitator` | 1,2,3,6 | 需求分析、架构规划、知识沉淀 | 不写业务代码 |
| `Execution_Engineer` | 4 | TDD 编码、自我修复 | 不做架构决策 |
| `QA_Reviewer` | 5 | 代码审查、质量把关 | 不写新功能代码 |

### 移交路由（严格执行）

```
Project_Facilitator → Execution_Engineer   (规划完成，开始编码)
Execution_Engineer  → QA_Reviewer          (编码完成，开始审查)
Execution_Engineer  → Project_Facilitator  (遇到架构问题求助)
QA_Reviewer         → Execution_Engineer   (审查驳回，要求修复)
QA_Reviewer         → Project_Facilitator  (审查通过，执行知识复合)
```

### 标准 6 步工作流

| 步骤 | 命令 | 核心作用 | 执行人 |
|------|------|----------|--------|
| 1. 产品级发散 | `/superpowers:brainstorm` | 澄清需求、用户故事、风险 | PM |
| 2. 永久锁死知识 | `/ce:compound` | 把 PRD、技术决策写入知识库 | PM |
| 3. 深度技术规划 | `/ce:plan` | 极深研究，输出详细计划 | PM |
| 4. 结构化执行 | `/superpowers:execute-plan` | 强制 TDD、分模块实现 | Coder |
| 5. 自动 Review | `/ce:review` | 多维度审查 + 驳回/通过 | QA |
| 6. 知识复合 | `/ce:compound` | 提炼模式、坑点、最佳实践 | PM |

---

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

### Phase 2b（进行中）— Unit 5 ~ Unit 10b
- 详见 `docs/plans/phase_2b_plan.md`

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

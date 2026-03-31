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

## Tech Stack

- **Runtime**: TypeScript + Node.js + Fastify
- **Data source**: Helius Enhanced Transaction Webhooks (Solana)
- **Enrichment**: DexScreener API (liquidity/FDV) + @solana/kit (mint/freeze authority checks)
- **AI**: Claude claude-3-5-haiku (<50 word Chinese summaries)
- **Delivery**: Telegram Bot API (private channel)
- **Monitoring**: Sentry + structured logging
- **Testing**: Vitest, TDD required (tests before implementation)

## Project Structure

```
src/                  # Application source (TypeScript)
  webhook/            # Helius webhook handling (handler, parse, dedup)
  enrichment/         # Token enrichment (DexScreener, authority check)
  discovery/          # Auto wallet discovery (Birdeye client, scoring, orchestrator, persistence)
  ai/                 # Claude AI attribution
  telegram/           # Telegram bot + alert formatting
docs/prd/             # Product requirements
docs/plans/           # Implementation plans
docs/solutions/       # Documented solutions and learnings, organized by category with YAML frontmatter (module, tags, problem_type). Relevant when implementing or debugging in documented areas.
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

The MVP is deliberately minimal. Only three concerns exist:

1. **Monitor**: Receive Helius webhook events for 20 fixed smart money addresses
2. **Enrich**: Parallel DexScreener + Solana RPC calls within 2-second budget
3. **Push**: Format and send Telegram alert (with AI summary or raw data fallback)

**NOT in MVP**: Web UI, auto wallet discovery, payment system, backtesting, multi-chain. See `docs/solutions/documentation-gaps/smart-money-radar-mvp-prd-v1-1-2026-03-31.md` for the full PRD and cut list.

## Performance Targets

- End-to-end latency: < 5 seconds (Helius webhook -> Telegram message)
- Enrichment budget: < 2 seconds (parallel, with timeout fallback)
- Message reliability: 99.9%

# Smart Money Radar

Telegram bot that tracks smart money wallet activity on Solana and pushes real-time alerts. MVP: webhook listener -> parallel enrichment -> AI summary -> Telegram push.

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
docs/prd/             # Product requirements
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

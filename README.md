# Smart Money Radar 🐋

Telegram bot tracking smart money wallet activity on Solana with real-time alerts.

## Architecture

```
Helius Webhook → Fastify → Parse → Dedup → Enrich (parallel) → AI Summary → Telegram Push
                                              ↓
                                    DexScreener + Authority Check
                                              
Birdeye Discovery (cron) → Score & Rank → Hot-swap Helius Subscriptions
```

## Quick Start

```bash
# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 填入: HELIUS_API_KEY, DEXSCREENER_API_KEY, ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

# 运行测试
pnpm --filter backend test

# 启动开发服务器
pnpm --filter backend dev
```

## Development

### 开发进度

- **Phase 2a** ✅：项目骨架、Webhook Handler、交易解析、去重
- **Phase 2b** 🔄：富集、AI 摘要、Telegram 推送、自动发现、E2E 集成
- 详见 `docs/plans/phase_2b_plan.md`

### Agent Teams 协作开发

本项目使用 Claude Code Agent Teams 三角色协作：

```bash
# 1. 启用 Agent Teams（已在 .claude/settings.json 中配置）
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

# 2. 启动 Claude Code
claude

# 3. 发起开发任务
```

**启动模板**（直接复制使用）：

```
请按照 CLAUDE.md 的 6 步工作流和 docs/plans/phase_2b_plan.md，
继续开发 Phase 2b 的 Unit [N]。

你作为 Project_Facilitator 先执行步骤 1-3，
然后 spawn Execution_Engineer 执行编码，
完成后 spawn QA_Reviewer 审查，
最后你执行步骤 6 知识复合。
```

### 团队角色

| 角色 | 定义文件 | 职责 |
|------|---------|------|
| Project_Facilitator | `.claude/agents/Project_Facilitator.md` | 需求分析、规划、知识沉淀 |
| Execution_Engineer | `.claude/agents/Execution_Engineer.md` | TDD 编码、自我修复 |
| QA_Reviewer | `.claude/agents/QA_Reviewer.md` | 代码审查、质量把关 |

## Tech Stack

- **Runtime**: TypeScript + Node.js + Fastify
- **Data**: Helius Webhooks + DexScreener + @solana/kit
- **AI**: Claude Haiku (中文摘要)
- **Push**: Telegram Bot API
- **Test**: Vitest (TDD)
- **Monitor**: Sentry + Pino

## Performance Targets

| 指标 | 目标 |
|------|------|
| 端到端延迟 | < 5s |
| 富集预算 | < 2s |
| 消息可靠性 | 99.9% |

## License

MIT

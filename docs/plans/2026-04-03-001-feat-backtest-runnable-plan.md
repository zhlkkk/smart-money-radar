---
title: "feat: Make Backtest Pipeline Runnable End-to-End"
type: feat
status: completed
date: 2026-04-03
---

# feat: Make Backtest Pipeline Runnable End-to-End

## Overview

回测管线代码（collect → track-prices → analyze → report）在 Phase 3c 中已 100% 实现，但当前无法产出有意义的结果：钱包地址配置为空，基线对照组是 dummy 占位。本计划补齐这两个数据依赖，使回测可以真正运行并输出有统计意义的验证报告。

## Problem Frame

用户执行 `pnpm --filter backend backtest` 时，CLI 会因 `addresses.length === 0` 直接退出。即使手动填入钱包地址，基线对照组为空数组意味着 `passed` 判定公式 `smartMoneyWinRate > 0.55 && smartMoneyWinRate - baselineWinRate > 0.10` 永远与零比较，失去统计对比意义。

## Requirements Trace

- R1. 回测 CLI 可以一键运行，无需手动准备数据文件
- R2. 聪明钱组使用 Birdeye discovery 管线发现的高评分钱包
- R3. 基线对照组使用随机/低评分钱包，提供统计对比基准
- R4. 报告中明确展示两组对比数据和 pass/fail 结论
- R5. 支持 `--skip-collect` 断点续跑（已实现）

## Scope Boundaries

- 不修改回测的核心分析逻辑（analyze.ts、report.ts）
- 不实现自动化定时回测（cron）
- 不修改 scoring 权重调整（需要回测结果后手动决策）
- 不引入数据库，继续使用 JSON 文件持久化

## Context & Research

### Relevant Code and Patterns

- `apps/backend/src/scripts/backtest/cli.ts` — CLI 编排，需修改钱包加载和基线逻辑
- `apps/backend/src/scripts/backtest/collect.ts` — 采集模块，已支持断点续跑
- `apps/backend/src/discovery/birdeye.ts` — `fetchTopWallets()` 可获取 Birdeye 排行榜钱包
- `apps/backend/src/discovery/scoring.ts` — `scoreWallets()` 百分位评分引擎
- `apps/backend/config/smart-money-addresses.json` — 当前为空 `{}`

### Institutional Learnings

- Auto wallet discovery architecture (`docs/solutions/best-practices/auto-wallet-discovery-architecture-2026-03-31.md`): Birdeye API 30 rpm 限流，percentile normalization 评分模式
- Phase 3c plan 中 Unit 1 的回测采集模块已实现 resume 支持

## Key Technical Decisions

- **种子钱包来源: Birdeye `fetchTopWallets()` API** — 复用已有 Birdeye client 代码，不新增 API 依赖。CLI 增加 `--seed-from-birdeye` 选项，在 `config/smart-money-addresses.json` 为空时自动从 Birdeye 拉取候选钱包，按 PnL 排序后拆分为聪明钱组和基线组。注意：不使用 `scoreWallets()`（该函数为 discovery 管线定制，签名不匹配）
- **基线对照组策略: 随机采样 Birdeye 低排名钱包** — 从 `fetchTopWallets()` 返回的完整列表中取底部 30% 作为基线，无需额外 API 调用。若 API 数据不足，fallback 到完全跳过基线（报告中标注"无基线对照"）
- **保持 CLI 向后兼容** — 已有 `--wallets-file` 参数继续生效，新增选项为附加功能

## Open Questions

### Resolved During Planning

- **Q: Birdeye `trader/gainers-losers` 一次返回多少钱包？** — 根据代码推断约 50-100 个，足够拆分聪明钱组（top 30%）和基线组（bottom 30%）
- **Q: 基线组是否需要独立的采集和价格追踪？** — 是，需要与聪明钱组走完全相同的 4 阶段管线才有可比性

### Deferred to Implementation

- Birdeye API 实际返回的 items 数量需运行时确认
- 若返回不足 10 个钱包，基线组策略需要 fallback 处理

## Implementation Units

- [x] **Unit 1: Birdeye 种子钱包自动获取**

**Goal:** CLI 支持在无预配置钱包时自动从 Birdeye 拉取 top wallets，按评分拆分为聪明钱组和基线对照组

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `apps/backend/src/scripts/backtest/cli.ts`
- Modify: `apps/backend/src/scripts/backtest/types.ts` (新增 BacktestGroup 类型)
- Test: `apps/backend/test/scripts/backtest/cli.test.ts`

**Approach:**
- 在 `cli.ts` 的 `main()` 中，当 `loadWalletAddresses()` 返回空数组时，调用 `fetchTopWallets()` 获取候选列表
- 直接按 `WalletCandidate.pnl` 降序排序（不使用 `scoreWallets()`，该函数为 discovery 管线设计，签名不匹配回测场景——它过滤 pinned 地址、应用 grace period、且只返回 top N 无法保留底部钱包）
- Top 30% 地址 → 聪明钱组，Bottom 30% 地址 → 基线组
- 聪明钱组输出到 `data/backtest/smart-money/`，基线组输出到 `data/backtest/baseline/`
- 两组分别走 collect → trackAllTrades 完整管线
- 新增 CLI 参数 `--seed-from-birdeye` 显式触发（当 addresses 为空时也自动触发并打印提示）
- 注意：基线组是 Birdeye 排行榜的底部钱包（非真正随机钱包），报告中应标注此局限性

**Patterns to follow:**
- `birdeye.ts` 中 `fetchTopWallets()` 的调用方式和错误处理
- 排序逻辑参考 `scoring.ts` 中的 percentile normalization 思路，但直接用简单排序即可

**Test scenarios:**
- Happy path: fetchTopWallets 返回 50 个钱包 → 聪明钱组 15 个，基线组 15 个，两组地址不重叠
- Edge case: fetchTopWallets 返回不足 5 个 → CLI 打印警告并 graceful exit
- Edge case: 配置文件有地址 + `--seed-from-birdeye` → 配置文件优先用于聪明钱组，Birdeye bottom 用于基线
- Error path: BIRDEYE_API_KEY 无效 → 认证错误信息明确
- Error path: Birdeye API 超时 → 非致命错误提示，建议稍后重试

**Verification:**
- `pnpm --filter backend backtest --seed-from-birdeye` 能完整运行并输出包含两组对比数据的报告
- 空 config + 无 `--seed-from-birdeye` 时仍然给出有用错误提示

- [x] **Unit 2: 基线对照组集成到回测管线**

**Goal:** 将基线组从 dummy 空数组替换为真实钱包数据，使 pass/fail 判定有统计意义

**Requirements:** R3, R4

**Dependencies:** Unit 1

**Files:**
- Modify: `apps/backend/src/scripts/backtest/cli.ts` (替换 L235-237 的 dummy 基线)
- Modify: `apps/backend/src/scripts/backtest/report.ts` (报告中区分两组来源说明)
- Test: `apps/backend/test/scripts/backtest/analyze.test.ts` (补充基线对比场景)

**Approach:**
- Unit 1 产出的基线地址列表传入 `collectAllWallets()` 和 `trackAllTrades()`，输出到独立子目录 `data/backtest/baseline/`
- `generateReport()` 接收真实基线数据，pass/fail 判定公式不变（winRate > 55% 且差值 > 10pp）
- `formatMarkdownReport()` 增加数据来源说明段落（聪明钱组: Birdeye top X%，基线组: Birdeye bottom Y%）

**Patterns to follow:**
- 聪明钱组的 collect + track 流程完全复用，仅切换地址列表和输出目录

**Test scenarios:**
- Happy path: 聪明钱组 winRate=65%, 基线组 winRate=45% → passed=true
- Happy path: 聪明钱组 winRate=50%, 基线组 winRate=48% → passed=false（差值不足 10pp）
- Edge case: 基线组为空（fallback 场景）→ 报告标注"无基线对照，结论仅供参考"
- Integration: 完整管线跑完后报告文件包含两组统计表和 pass/fail 结论

**Verification:**
- `data/backtest/report-YYYY-MM-DD.md` 包含聪明钱组和基线组的完整指标对比
- 基线组数据不再全为零
- `--skip-collect` 断点续跑在聪明钱组和基线组双目录下仍然正常工作

## System-Wide Impact

- **Interaction graph:** 仅影响回测 CLI 脚本，不触及线上 webhook 管线或 Telegram 推送
- **Error propagation:** Birdeye API 失败 → CLI 给出错误提示后退出，不影响任何运行中服务
- **State lifecycle risks:** 回测数据写入 `data/backtest/` 目录（gitignored），无持久化状态风险
- **API surface parity:** 不涉及 REST API 或 WebSocket 变更
- **Unchanged invariants:** `analyze.ts` 的 pass/fail 判定公式、`report.ts` 的报告格式保持不变

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Birdeye `trader/gainers-losers` 返回数据不足 | CLI 检查最小阈值（≥10），不足时 graceful exit 并提示 |
| Birdeye free tier 30 rpm 限流导致回测耗时长 | 已有 rate-limiter 控制；CLI 显示进度条；`--skip-collect` 支持断点续跑 |
| 基线组钱包交易数据稀疏 | noDataRatio 已纳入分析指标，报告会标注数据可靠性 |

## Sources & References

- Related code: `apps/backend/src/scripts/backtest/` (完整回测管线)
- Related code: `apps/backend/src/discovery/birdeye.ts` (Birdeye API client)
- Related code: `apps/backend/src/discovery/scoring.ts` (评分引擎)
- Institutional learning: `docs/solutions/best-practices/auto-wallet-discovery-architecture-2026-03-31.md`
- Phase 3c plan: `docs/plans/2026-04-02-008-feat-data-reliability-phase3c-plan.md`

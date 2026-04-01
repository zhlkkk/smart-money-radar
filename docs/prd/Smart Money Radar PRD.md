**Smart Money Radar: 项目演进、MVP 方案与产品需求文档 (PRD)**

**文档状态**: 已完善（v1.1）  
**作者**: John (产品经理 - bmad-agent-pm) + Grok（深度 review & 技术对齐）  
**目标受众**: 内部团队、AI 工程 agents（Superpowers + Compound Engineering）  
**日期**: 2026年3月31日  
**Compound 知识库引用**: `docs/solutions/tech-stack-2026.md` + `docs/solutions/frontend-design-2026.md`

**核心问题**：我们到底在解决什么痛点？  
答案不是“提供链上数据”，而是“帮 Solana Degen 在暴涨前 5 秒上车，同时防 Rug”。  
原则：**Ruthless Cut** —— 砍掉一切不验证核心假设（“用户愿意为比别人快 10 分钟的情报付 $100/月”）的代码。

---

## 一、项目整体演进计划 (Project Evolution Plan)

| 阶段              | 时间线     | 核心目标               | 产品形态                              | 商业目标 (KPI)          |
|-------------------|------------|------------------------|---------------------------------------|-------------------------|
| **Phase 1: MVP**  | 第 1-4 周 | 验证核心需求与支付意愿 | 单向私密 Telegram 频道 + 手动邀请    | 10 个死忠粉 + $1,000 MRR |
| **Phase 2: MLP**  | 第 5-8 周 | 自动化获客与支付闭环   | Stripe/Crypto 支付 + 基础用户管理     | 50 个付费用户 + $5,000 MRR |
| **Phase 3: Seed** | 第 9-12 周| 规模化 + 多链          | Web Dashboard + 自定义监听 + EVM 链   | $10,000 MRR + 融资数据  |

---

## 二、MVP 产品方案 (MVP Product Plan)

**目标用户**：重度 Solana Degen，每天盯盘却常接盘。  
**核心价值**：**比快更快**（聪明钱买入后 5 秒内推送）+ **防 Rug 护航**（2 秒内完成流动性 & 权限检查）。  
**形态**：仅限邀请的 Telegram 私密频道（人工私信 + 手动拉群收款）。  
**定价**：$100 / 月（高价过滤白嫖）。

---

## 三、产品需求设计 (PRD)

### 1. 核心用户故事
- 作为交易员，我希望在聪明钱买入新代币的 **5 秒内** 收到结构化 Telegram 推送，以便在散户涌入前建仓。
- 作为交易员，我希望推送中直接显示流动性、市值、Mint/Freeze 权限状态，以便快速判断 Rug 风险。
- 作为交易员，我希望看到 AI 生成的 **<50 字** 简短归因，帮助我理解买入逻辑。

### 2. 功能需求

#### 2.1 数据监听模块 (Helius Enhanced Webhook) ★ 强制使用已 compound 技术栈
- **技术要求**：使用 **Helius Enhanced Transaction Webhooks**（2026 最新），监听 20 个固定聪明钱地址。
- **业务逻辑**：
  - 在 Helius Dashboard 配置 webhook，过滤 `SWAP` / `TOKEN_TRANSFER` 类型。
  - 接收已解析的 `Enriched Transaction` 数据，提取 `Token Address`、`Amount`、`Buyer Address`。
- **实现框架**：**TypeScript + Node.js + Fastify**（**禁止**使用 FastAPI 或 Python）。

#### 2.2 并发数据富化模块 (Enrichment)
- **要求**：2 秒内完成。
- **动作 A**：调用 **DexScreener API**（`/token-profiles` 或 pair 接口）获取 Liquidity + FDV + Market Cap。
- **动作 B**：使用 `@solana/kit` 调用 RPC `getAccountInfo` 查询 Mint 的 `mintAuthority` 和 `freezeAuthority` 是否为 null。
- **异常处理**：任意 API 超时 → 降级为“Liquidity: N/A | Authorities: unchecked” 并继续推送。

#### 2.3 AI 归因与推送模块 (LLM + Telegram)
- **LLM**：`claude-3-5-haiku`（或最新可用模型），Prompt 严格 <50 字。
- **推送**：Telegram Bot API 发送到固定私密频道。
- **降级**：Claude 失败 → 推送纯数据模板（Token + Liquidity + Authorities + Buyer）。
- **Prompt 示例**（已 compound 进 `docs/solutions/ai-attribution-prompt.md`）：
  > “用 <50 字中文总结这个 Solana 代币为什么被聪明钱买入，只说基本面和叙事，禁止废话。”

### 3. 非功能需求（新增技术 KPI）
- **端到端延迟**：< 5 秒（Helius webhook → Telegram）。
- **可靠性**：99.9% 消息不丢失；任何外部依赖失败不崩溃主进程。
- **安全性**：Webhook 必须验证 Helius 签名；绝不存储私钥；Rate limit 保护。
- **监控**：集成 Sentry + 简单日志；关键错误推送 Telegram 运维群。
- **TDD 要求**：所有模块必须先写测试（Superpowers 强制）。

### 4. 不在 MVP 范围内（坚决砍掉）
- 任何 Web Dashboard / Frontend UI（Phase 2 再用 `frontend-design` + `impeccable`）。
- ~~自动聪明钱发现算法~~ *(已在 Phase 1 提前实现，见 `src/discovery/`：Birdeye API 动态发现 + 评分排名 + Helius webhook 热切换)*。
- 用户订阅/支付系统（人工处理）。
- 历史回测、胜率分析、多链。


---
title: Multi-Layer AI Workflow Enforcement Pattern
date: 2026-03-31
category: best-practices
module: ai-workflow-governance
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - 需要确保 AI 辅助开发工作流在多个会话间保持一致执行
  - 项目组合多种开发范式（如 TDD + 知识沉淀）且不允许跳过任何环节
  - 多人协作项目需要所有开发者与 AI 遵循相同工作流
  - 长期维护项目需要工作流抗上下文压缩和会话边界
tags:
  - workflow-governance
  - claude-md
  - session-persistence
  - enforcement-layers
  - ai-workflow
  - compound-engineering
  - superpowers
---

# Multi-Layer AI Workflow Enforcement Pattern

## Context

在 Smart Money Radar MVP 开发过程中，团队建立了一个结合 Superpowers（TDD 纪律）和 Compound Engineering（知识沉淀）的 6 步组合工作流（详见 [组合工作流模板](combined-superpowers-compound-workflow-template-2026-03-31.md)）。然而，单纯定义工作流模板并不足以保证每次新会话都遵循它。

**核心问题**：AI 会话是无状态的。一个会话中精心建立的工作流纪律，在下一个会话中完全丢失。开发者需要反复重新解释和协商工作流，每次浪费 10-15 分钟。更危险的是，AI 在上下文压缩时会自然倾向于跳过"非必要"步骤（测试、文档），而这恰恰是纪律最需要保障的地方。

## Guidance

使用**四层强制执行模式**（defense in depth）让 AI 开发工作流跨会话持久化：

### Layer 1 — CLAUDE.md（强制执行层）

在项目的 `CLAUDE.md` 中添加简洁的强制规则，指向模板路径而非包含完整定义：

```markdown
## 必须遵守的工作流
- 所有新功能必须严格执行 docs/templates/combined-workflow.md 中的 6 步组合流程
- 每次修改后必须运行 /ce:compound
```

**为什么是最强层**：`CLAUDE.md` 在每次 AI 会话开始时自动加载，是 AI 的"宪法"。规则写在这里等于写入 AI 的初始指令。

**关键原则**：保持简洁，只写引用和强制语句。详细规范放在 Layer 2。

### Layer 2 — 模板文件（规范定义层）

创建独立的、受版本控制的模板文件 `docs/templates/combined-workflow.md`，包含：

- 编号步骤和对应命令
- 场景决策指南（什么情况侧重哪个范式）
- 可复制的每日启动模板

**为什么要分离**：规范可以独立编辑、在 PR 中审查、版本化追踪，而不影响 CLAUDE.md 的简洁性。

### Layer 3 — 知识库文档（可发现性层）

将工作流记录为 `docs/solutions/best-practices/` 中的解决方案条目，带有 YAML frontmatter（module, tags, problem_type）。

**为什么需要这层**：使工作流可通过 compound 知识系统搜索发现，支持交叉引用和未来优化。

### Layer 4 — Auto Memory（弹性兜底层）

保存会话持久化记忆条目（auto memory），概述工作流要求：

```
Every feature must follow the 6-step combined workflow in docs/templates/combined-workflow.md.
Run /ce:compound after every change.
```

**为什么需要这层**：在长对话中 CLAUDE.md 上下文可能被压缩。Auto memory 作为独立通道，确保 AI 即使在上下文紧张时也记得核心义务。

## Why This Matters

单一持久化机制都有弱点：

| 层 | 优势 | 弱点 |
|---|------|------|
| CLAUDE.md | 每次加载，最高权威 | 只能写简要规则，不能包含详细规范 |
| 模板文件 | 详细、可版本化 | AI 不会主动查阅，需要被引导 |
| 知识库 | 可搜索、可交叉引用 | 被动发现，需要 AI 主动搜索 |
| Auto Memory | 抗上下文压缩 | 无版本控制，可被覆盖 |

四层叠加形成**纵深防御**：每层弥补其他层的弱点。任何单一层失效时，其他层仍然维持工作流的执行。

**没有这个模式时**：AI 默认走最简单路径（直接写代码 → 跳过测试 → 跳过文档），违背采用纪律化工作流的初衷。

**有这个模式后**：工作流在会话 1、2、3 和之后都一致执行。如果 AI 偏离，开发者指向 CLAUDE.md 即可立即纠正，因为规范始终可访问且明确。

## When to Apply

- **多会话 AI 辅助项目**：工作流一致性跨天或跨周的开发
- **组合方法论项目**：混合多个范式（如 TDD + 文档），跳过任何一个环节都会降低整体质量
- **团队项目**：多个开发者与 AI 交互，需要相同的工作流强制执行
- **有外部问责的项目**：跳过步骤（测试、文档）会产生真实风险

**不适用于**：一次性脚本、探索性原型、工作流极其简单的项目。

## Examples

**Before（单层，仅 CLAUDE.md 约定）**：

```markdown
## Conventions
- Testing: Vitest. Write tests first, then implementation.
```

- 会话 1：AI 遵循 TDD，写出好测试
- 会话 2：AI 先写实现，测试成为事后补充
- 会话 3：上下文窗口填满时 AI 完全跳过测试
- 开发者每次重新解释工作流，每次浪费 10-15 分钟

**After（四层强制执行）**：

| 层 | 文件 | 内容 |
|---|------|------|
| Layer 1 | `CLAUDE.md` | `所有新功能必须严格执行 docs/templates/combined-workflow.md 中的 6 步组合流程` |
| Layer 2 | `docs/templates/combined-workflow.md` | 完整 6 步流程 + 场景决策指南 + 启动模板 |
| Layer 3 | `docs/solutions/best-practices/combined-superpowers-compound-workflow-template-2026-03-31.md` | YAML frontmatter 可搜索、交叉引用 |
| Layer 4 | Auto Memory | `Every feature must follow the 6-step combined workflow` |

- 会话 1, 2, 3 及以后：AI 一致遵循 6 步流程
- 上下文压缩时：Auto Memory 兜底
- AI 偏离时：开发者指向 CLAUDE.md，立即纠正

## Related

- [Combined Superpowers + Compound Engineering Workflow](combined-superpowers-compound-workflow-template-2026-03-31.md) -- 本模式的具体应用实例（6 步组合工作流本身）

- Template source: `docs/templates/combined-workflow.md`
- Enforcement point: `CLAUDE.md` — "必须遵守的工作流" section

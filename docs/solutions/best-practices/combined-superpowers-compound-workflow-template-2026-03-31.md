---
title: Combined Superpowers + Compound Engineering Workflow for AI-Assisted Feature Development
date: 2026-03-31
category: best-practices
module: development-workflow
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Starting any new feature that will take more than a single session
  - Working on a long-lived TypeScript/Node.js project with accumulated complexity
  - Using AI coding assistants (Claude Code) for feature development
  - Wanting to balance speed of delivery with knowledge retention
  - Team or solo developer repeating similar feature patterns across sprints
tags:
  - ai-workflow
  - superpowers
  - compound-engineering
  - tdd
  - feature-development
  - knowledge-management
---

# Combined Superpowers + Compound Engineering Workflow for AI-Assisted Feature Development

## Context

During Smart Money Radar MVP development (Phase 1), two complementary AI development paradigms emerged but were used in isolation: **Superpowers** (fast, disciplined TDD execution) and **Compound Engineering** (systematic knowledge accumulation). Using only Superpowers produced fast results but the team kept re-solving the same problems -- lessons from Helius payload mismatches, Solana TypeScript gotchas, and graceful degradation patterns had to be rediscovered each session. Using only Compound Engineering produced thorough documentation but sometimes slowed down tight-deadline MVP work. Neither paradigm alone captured the full development lifecycle from requirements through execution to knowledge extraction.

The gap: there was no standard process that combined product-level brainstorming, permanent decision locking, deep technical planning, disciplined TDD execution, automated review, and knowledge compounding into a single repeatable workflow.

Reference template: `docs/templates/combined-workflow.md`

## Guidance

Use a 6-step combined workflow that interleaves Superpowers and Compound Engineering at the right moments:

| Step | Command | Core Purpose | Lead Paradigm |
|------|---------|-------------|---------------|
| 1. Product divergence | `/superpowers:brainstorm <requirement>` | Clarify requirements, user stories, risks | Superpowers |
| 2. Lock decisions | `/ce:compound "feature name"` | Persist PRD and technical decisions into knowledge base | Compound |
| 3. Deep technical plan | `/ce:plan` (ultrathink mode) | 40+ agent deep research, output detailed plan | Compound |
| 4. Structured execution | `/superpowers:execute-plan` or `/lfg` | Forced TDD, modular implementation | Superpowers |
| 5. Automated review | `/ce:review` | Multi-agent parallel review + auto-fix | Compound |
| 6. Knowledge compound | `/ce:compound` | Extract patterns, pitfalls, best practices for permanent accumulation | Compound |

**Scenario decision guide** for choosing emphasis:

| Scenario | Superpowers (fast + disciplined) | Compound (system gets smarter) | Recommendation |
|----------|--------------------------------|-------------------------------|----------------|
| MVP / tight deadline | Strongly recommended | - | Superpowers-led |
| Long-term maintained project | - | Strongly recommended | Compound-led |
| Large codebase | - | Strongly recommended | Compound-led |
| New domain research | - | Prioritize | Compound first for planning |
| Preventing AI mistakes | Prioritize | - | Superpowers first with TDD |
| Repeating similar features | - | Strongly recommended | Compound to reuse patterns |
| Solo/small team long-term | - | Best choice | Compound primary + Superpowers discipline |

**Mnemonic**:
- "Want fast, disciplined, no rework" --> Superpowers
- "Want the system to get smarter over time" --> Compound

**Daily quick-start template** (copy-paste to begin any feature):

```markdown
/superpowers:brainstorm + /ce:plan
Requirement: [describe your requirement here]

Execute strictly per combined workflow:
1. brainstorm to clarify requirements
2. /ce:compound to lock decisions
3. /ce:plan (ultrathink) to generate detailed plan
4. /superpowers:execute-plan to implement
5. /ce:review + /ce:compound
```

## Why This Matters

**Without this workflow**:
- Brainstorming and execution happen ad-hoc; requirements are unclear, leading to rework
- Technical decisions are made implicitly and forgotten between sessions
- Solved problems (e.g., Helius payload format quirks, Solana `@solana/kit` migration gotchas) get re-solved from scratch
- Code reviews happen inconsistently or not at all
- Knowledge stays in chat history and is lost when the session ends

**With this workflow**:
- Every feature starts with explicit requirement clarification (step 1), reducing mid-implementation pivots
- Decisions are locked into the knowledge base (step 2) before any code is written, preventing drift
- Deep planning with multi-agent research (step 3) catches architecture issues early
- TDD enforcement (step 4) catches bugs at write-time, not deploy-time
- Automated multi-perspective review (step 5) catches issues a single developer would miss
- Knowledge compounding (step 6) means the second webhook handler, the third enrichment pipeline, the fourth Telegram formatter all benefit from documented patterns of the first

In the Smart Money Radar project, this workflow turned one-off solutions (like the `parseSwap` Helius payload mismatch fix and the fire-and-forget webhook pattern) into reusable documented patterns in `docs/solutions/`, making each subsequent feature faster to build correctly.

## When to Apply

- **Always apply** when starting a new feature that will touch multiple modules or external APIs
- **Always apply** when the feature involves patterns you have seen before in this codebase (check `docs/solutions/` first)
- **Simplify to steps 1+4 only** for trivial bug fixes or one-line changes
- **Emphasize steps 2+3+6** when entering a new technical domain (e.g., first time integrating Solana RPC, first time using DexScreener API)
- **Emphasize step 4** when deadline pressure is high but quality cannot slip
- **Skip step 3** (deep plan) only for features where the implementation path is already well-understood from prior compound knowledge

## Examples

**Before (ad-hoc development)**:
1. Developer reads a requirement, jumps straight into coding
2. Hits Helius payload format issue mid-implementation, spends 30 minutes debugging
3. Fixes it, but the fix is only in code comments -- next feature hits the same issue
4. No review, ships with a subtle bug in error handling
5. Next sprint, same payload issue resurfaces in a different handler

**After (combined workflow)**:
1. `/superpowers:brainstorm "add Jupiter swap detection"` -- clarifies that Jupiter uses a different program ID, identifies risk of payload format differences
2. `/ce:compound "jupiter-swap-detection"` -- locks the decision to reuse existing `parseSwap` with a new program ID check, references the documented Helius payload mismatch pattern from `docs/solutions/runtime-errors/parseswap-helius-payload-mismatch-2026-03-31.md`
3. `/ce:plan` -- multi-agent research confirms Jupiter transaction structure, outputs a 12-step plan with test cases
4. `/superpowers:execute-plan` -- TDD: writes failing test for Jupiter swap parsing first, then implements, all tests green
5. `/ce:review` -- catches missing timeout on new RPC call, auto-fixes
6. `/ce:compound` -- documents Jupiter-specific parsing pattern, adds to `docs/solutions/` for future reference

Result: Feature shipped in one session with zero rework. The Jupiter parsing pattern is now available for the next DEX integration.

## Related


- [parseSwap Helius Payload Mismatch](../runtime-errors/parseswap-helius-payload-mismatch-2026-03-31.md) -- example of compound documentation output from this workflow
- [Solana TypeScript Implementation Gotchas](../developer-experience/solana-typescript-implementation-gotchas-2026-03-31.md) -- example of knowledge compounding from development experience
- [Fire-and-Forget Webhook Graceful Degradation](../best-practices/fire-and-forget-webhook-graceful-degradation-2026-03-31.md) -- best practice pattern captured via compound workflow
- [Multi-Layer AI Workflow Enforcement Pattern](multi-layer-ai-workflow-enforcement-pattern-2026-03-31.md) -- 如何让此工作流跨会话持久化和强制执行
- Template source: `docs/templates/combined-workflow.md`

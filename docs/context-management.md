---
name: context-management
description: LLM 对话上下文管理方案的设计思路、架构决策、当前三阶段管线实现与未来规划
---

# 对话上下文管理

## 问题域

文字冒险游戏每轮产生约 600 tokens 旁白 + 100 tokens 玩家选择，对话历史线性增长。核心矛盾：

1. **上下文窗口有限**：DeepSeek 支持 128K，但太长导致注意力衰减 + 成本线性增长
2. **稳定性差异**：`deepseek-v4-flash` 指令遵循弱于 Pro，需将复杂任务拆分到多个专用调用
3. **记忆保真度**：简单窗口裁剪丢失早期剧情，AI 摘要存在漂移风险

## 当前架构（2026-06-18）

AI 引擎已重构为**三阶段管线**，每个阶段独立注入上下文：

```
┌─ Stage 1: Plan ─────────────────────────────────┐
│  POST /api/adventure/plan                         │
│  System Prompt  ~1500-2500 tokens                 │
│  世界设定 + 玩家属性 + NPC 关系 + 规则            │
│  （buildPlannerSystemPrompt）                     │
│                                                   │
│  [已知线索]  ~50-200 tokens                       │
│  memoryFacts 结构化记忆槽                          │
│                                                   │
│  [对话历史]  ~2000-8000 tokens                    │
│  slice(-6) 条原文                                │
│                                                   │
│  [当前行动]  ~50 tokens                           │
│  玩家本轮选择                                     │
└───────────────────────────────────────────────────┘

┌─ Stage 2: Narrate ────────────────────────────────┐
│  POST /api/adventure/narrate                      │
│  System Prompt  ~1000-2000 tokens                 │
│  世界设定 + 语言风格                              │
│  （buildNarratorSystemPrompt）                    │
│                                                   │
│  [已知线索]  ~50-200 tokens                       │
│  memoryFacts                                      │
│                                                   │
│  [对话历史]  ~2000-8000 tokens                    │
│  slice(-8) 条原文                                │
│                                                   │
│  [当前行动 + 已确定变更]  ~100 tokens             │
│  玩家选择 + Stage 1 输出的 stateChanges           │
└───────────────────────────────────────────────────┘

┌─ Stage 3: Choices ────────────────────────────────┐
│  POST /api/adventure/choices                      │
│  System Prompt  ~1000-2000 tokens                 │
│  世界设定 + 选项生成规则                          │
│  （buildChoicesSystemPrompt）                     │
│                                                   │
│  [叙述全文]  ~600 tokens                          │
│  Stage 2 生成的完整旁白                           │
│                                                   │
│  [玩家最新状态]  ~300 tokens                      │
│  已应用 stateChanges 后的 playerState             │
└───────────────────────────────────────────────────┘
```

### 各层职责

| 层 | 实现 | 生命周期 | 可控性 |
|----|------|---------|--------|
| System Prompt | 各端点独立 build*SystemPrompt | 每轮重建（动态数据） | 确定性代码 |
| 已知线索 | `memoryFacts` → build*Messages 注入 | 回合间累积（存档持久化） | 确定性代码 + AI 提取 |
| 对话历史 | `build*Messages` + `slice(-6~-8)` | 归档到 `dialogueHistory` | 确定性代码 |
| 状态变更 | `planSchema` → `APPLY_STATE_CHANGES` | 每轮 Stage 1 输出 | AI 决策 + Zod 校验 |

## 设计决策记录

### 决策 1：不用 AI 摘要，用结构化事实

**考虑过**：AI 每 6 轮生成叙事性摘要，替换旧历史。

**放弃理由**：
- 摘要漂移：多次压缩后关键信息逐渐稀释
- 事实矛盾：后期剧情可能推翻早期"事实"，但摘要不会自我修正

**选定的方案**：结构化记忆槽（`memoryFacts`）
- 独立 API 调用提取，不耦合任何阶段
- 每条 ≤15 字，自然控制 token
- 客户端 Levenshtein 去重，不靠 AI 自觉
- `replaceFacts` 字段支持事实修正
- 成本：每轮 ~300 tokens 入 + ~100 tokens 出

### 决策 2：memoryFacts 不放 PlayerState

**考虑过**：作为 `PlayerState` 字段嵌入。

**放弃理由**：PlayerState 是玩家属性（勇气、智力等），读档时恢复；memoryFacts 是会话级元数据，生命周期不同。

**选定的方案**：放在 `GamePlayContext`（与 `dialogueHistory` 同级），存档时作为 `SaveData` 顶层字段。

### 决策 3：三阶段独立调用替代单次 Tool Use

**旧方案**：单次 `streamText` + `update_state` tool call，要求 AI 同时完成叙述 + 状态变更 + 选项生成。

**问题**：DeepSeek Flash 模型频繁跳过工具调用（~40% 失败率），fallback 逻辑层层叠加仍不稳定。

**新方案**：
- Stage 1（Plan）用 `generateText + Output.json()` 强制输出状态变更 JSON
- Stage 2（Narrate）用 `streamText` 纯叙事，无格式约束
- Stage 3（Choices）用 `generateText + Output.json()` 强制输出选项 JSON
- 每个调用职责单一，弱模型也能稳定遵循

### 决策 4：先决策再叙事

**考虑过**：先让 AI 写叙述，再从叙述中提取状态变更。

**放弃理由**：叙述成为"事实"后再改状态会让玩家感觉状态滞后或叙事与数值脱节。

**选定的方案**：Plan 阶段先确定变更，Narrate 阶段基于已确定的变更展开故事，确保叙事与状态一致。

### 决策 5：对话历史不追加工具调用提醒

**旧方案**：每条 user 消息追加"请先写叙述，然后必须调用 update_state 工具"。

**新方案**：三阶段无 tool call，user/assistant 消息保持自然对话格式，无需额外提醒。

## 放弃的方案

| 方案 | 放弃原因 |
|------|---------|
| 单次调用 + Tool Use | Flash 模型工具调用不稳定，fallback 逻辑复杂 |
| LangChain Memory 模块 | 与 Vercel AI SDK 框架冲突；功能已有等价实现 |
| Mem0/Zep | 引入重依赖；核心卖点（结构化记忆）已自研覆盖 |
| `toolChoice: 'required'` | DeepSeek API 不兼容 |
| AI 动态摘要（每 6 轮） | 漂移 + 耦合工具调用不稳定性 |
| 正则提取事实 | 中文叙事格式多变，漏检率高 |

## 未来规划

1. **Token 计数器**：用 `js-tiktoken` 做精确 token 计数，`slice(-12)` 改为基于 token 的动态裁剪（如 max 8000 tokens）
2. **可观测性**：日志代理记录每轮实际 token 消耗、缓存命中情况
3. **记忆槽检索**：facts 过多时按相关性排序注入（如最近提及的 NPC/地点优先），而非全量发送
4. **Stage 间缓存**：System Prompt 静态部分走 Provider 磁盘缓存

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/app/api/adventure/plan/route.ts` | Stage 1：状态变更决策 |
| `src/app/api/adventure/narrate/route.ts` | Stage 2：叙事 SSE 流 |
| `src/app/api/adventure/choices/route.ts` | Stage 3：选项生成 |
| `src/app/api/adventure/extract-facts/route.ts` | 事实提取端点：从旁白中提取 ≤15 字关键事实 |
| `src/lib/fact-dedup.ts` | Levenshtein 距离去重 |
| `src/lib/tool-schema.ts` | `planSchema` 和 `choicesSchema` Zod 定义 |
| `src/lib/game-play-context.tsx` | GamePlayState（含 memoryFacts、dialogueHistory） |
| `src/lib/player-state-context.tsx` | `APPLY_STATE_CHANGES` reducer |
| `src/components/GameScreen.tsx` | 客户端三阶段编排 + SSE 消费 |
| `docs/business/ai-engine.md` | AI 引擎业务文档 |

## 相关文档

→ ai-engine.md：三阶段管线架构、Provider 选择、SSE 流处理
→ state-management.md：三层 Context 架构
→ save-system.md：存档系统（含 memoryFacts 持久化）
→ event-bus-typewriter.md：SSE 流客户端消费和打字机效果
→ game-options-conditions.md：Choices 生成的 options 条件评估

## 边界

本文件覆盖 LLM 对话上下文的分层管理、memoryFacts 生命周期、三阶段管线的上下文注入策略。
不覆盖：具体模型调用实现（见 ai-engine.md）、状态存储（见 state-management.md）、存档（见 save-system.md）、打字机渲染（见 event-bus-typewriter.md）。

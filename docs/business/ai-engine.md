---
name: ai-engine
description: 三阶段管线架构（Turn Planner / Story Writer / Choices Maker）、generateText + Output.json() 策略、SSE 流叙事、Provider 选择规则、API 配置面板（预设切换/自定义预设/协议兼容）、AI SDK v6 API 差异、结构化记忆槽
---

# AI 引擎

## 架构概览：三阶段管线

AI 引擎从**单次 API 调用 + Tool Use** 重构为**三阶段独立管线**，每阶段只做一件事：

```
玩家选择
  │
  ├─ [1-2s] POST /api/adventure/plan      ← generateText
  │         输出：状态变更 JSON（属性/好感度/物品/旗标）
  │
  ├─ [流式] POST /api/adventure/narrate    ← streamText
  │         输出：SSE text-delta 流 → 打字机渲染
  │
  │                              流结束 ┤
  │          ┌─────────────────────────┤
  ├─ [1-2s] POST /api/adventure/choices    POST /api/adventure/extract-facts
  │          generateText → 选项 JSON    （并行，已有，不变）
  │
  ▼
  选项出现，等待玩家
```

### 设计决策

| 决策 | 选定 | 放弃 | 理由 |
|------|------|------|------|
| 编排方式 | 客户端三端点 | 服务端单 SSE | 每步独立，失败隔离 |
| 状态输出 | `generateText + Output.json()` | tool call | Provider 层面强制 JSON，不存在"跳过"可能；比 `generateObject` 兼容更多第三方 Provider |
| 叙述与状态顺序 | 先决策再叙事 | 先叙事再提取 | 叙事能准确反映已确定的变更结果 |
| 工具层 | `generateText + Output.json()` + `streamText` | 手搓/LangChain | 轻量 Provider 抽象，无需 tool call |

## Stage 1：Turn Planner

**端点**：`POST /api/adventure/plan`（`src/app/api/adventure/plan/route.ts`）

**职责**：理解玩家意图，决定本轮状态变更

**实现**：使用 `generateText` + `Output.json()`（AI SDK v6），强制输出 JSON 对象：

```ts
const planSchema = z.object({
  attributeChanges: z.record(z.string(), z.number()).optional(),
  npcAffinityChanges: z.record(z.string(), z.number()).optional(),
  newFlags: z.array(z.string()).optional(),
  lostFlags: z.array(z.string()).optional(),
  itemsGained: z.array(z.string()).optional(),
  itemsLost: z.array(z.string()).optional(),
})
```

**System Prompt 要点**（`buildPlannerSystemPrompt`）：
- 注入世界设定、玩家属性、NPC 关系、物品栏、旗标、故事进度
- 属性变化幅度规则（同现有约束表）
- 好感度变化规则
- 明确说"只输出变更，不写叙述，不生成选项"

**输入**：`worldCard, playerState, playerAction, dialogueHistory, memoryFacts, npcAffinities, npcRuntime`

**输出**：`{ attributeChanges?, npcAffinityChanges?, newFlags?, lostFlags?, itemsGained?, itemsLost? }`

**失败降级**：返回空对象 `{}`（本轮无状态变化，不阻塞后续阶段）

## Stage 2：Story Writer

**端点**：`POST /api/adventure/narrate`（`src/app/api/adventure/narrate/route.ts`）

**职责**：把变更结果 + 玩家行动写成沉浸式叙述（SSE 流）

**实现**：使用 `streamText`，纯创意写作，零格式约束：

```ts
const result = streamText({
  model: modelInstance,
  system: buildNarratorSystemPrompt(worldCard, updatedPlayerState),
  messages: buildNarratorMessages(dialogueHistory, memoryFacts, playerAction, stateChanges),
  temperature: 0.7,
})
return result.toUIMessageStreamResponse()
```

**System Prompt 要点**（`buildNarratorSystemPrompt`）：
- 世界设定和玩家当前状态
- "写一段 200-400 字的中文叙述，语言有画面感"
- "本轮已发生以下变化：[变更摘要]"，据此展开故事
- 无任何结构化输出要求，纯文本

**状态注入**：服务端接收 stateChanges 后，在 prompt 中注入变更摘要，同时自身也临时应用变更以便叙述准确反映最新状态（`applyStateChangesToPlayer`）。

**输入**：`worldCard, playerState(已更新), playerAction, stateChanges, dialogueHistory, memoryFacts`

**输出**：SSE text-delta 流 → 客户端打字机渲染（sharedEventBus）

**失败降级**：返回 500 错误，客户端显示错误提示

## Stage 3：Choices Maker

**端点**：`POST /api/adventure/choices`（`src/app/api/adventure/choices/route.ts`）

**职责**：基于叙事内容生成下一步选项

**实现**：使用 `generateText` + `Output.json()`，配合 `choicesSchema` 做服务端校验：

```ts
const choicesSchema = z.object({
  options: z.array(
    z.object({
      text: z.string(),
      attributeChecks: z.record(z.string(), z.string()).optional(),
      npcAffinityChecks: z.record(z.string(), z.string()).optional(),
      flagChecks: z.array(z.string()).optional(),
      flagNot: z.array(z.string()).optional(),
      itemChecks: z.array(z.string()).optional(),
      itemNot: z.array(z.string()).optional(),
    })
  ).min(2).max(4),
})
```

**System Prompt 要点**（`buildChoicesSystemPrompt`）：
- 世界设定、玩家最新状态（已包含变更）
- "生成 2-4 个具体、有画面感的选项"
- 只输出 JSON，不包含任何其他文本

**输入**：`narration（Stage 2 全文）, playerAction, worldCard, playerState（已更新）`

**输出**：`{ options: [{ text, attributeChecks?, ... }] }`

**失败降级**：注入默认选项 `["继续前进", "仔细观察周围", "与附近的人交谈"]`

## 客户端编排（GameScreen.tsx）

核心流程在 `submitAction` 中实现：

1. **Stage 1**：fetch → `/api/adventure/plan` → 解析 JSON stateChanges
2. **本地计算**：`computeUpdatedPlayerState()` 基于当前 state 和 stateChanges 计算更新后的玩家状态（用于后续阶段请求体），同时 `actions.applyStateChanges()` 异步 dispatch 到 React
3. **Stage 2**：fetch → `/api/adventure/narrate` → `readDataStream` 消费 SSE → `sharedEventBus.append()` 逐字推送打字机渲染
4. **Stage 3**：`Promise.all([choicesRes, factsRes])` 并行请求选项和记忆提取
5. **收尾**：`actions.setOptions()`、`actions.updateMemoryFacts()`、`actions.archiveDialogue()`、`debouncedAutoSave()`

注意：
- 状态变更在 Plan 完成后立即 dispatch，但 Narrate 请求体中使用的是本地计算的 `updatedPlayerState`（避免依赖 React 异步状态更新）
- AbortController 在每轮开始时取消上一轮未完成的流
- 无需任何 Tool Use 相关处理（无 `tool-input-available` 事件、无 fallback、无监控指标）

## Provider 选择规则

| Provider | 工厂函数 | SDK 包 | API 协议 | 关键差异 |
|----------|---------|--------|---------|---------|
| anthropic | `createAnthropic({ apiKey })` | `@ai-sdk/anthropic` | Anthropic Messages API | — |
| openai（本家） | `createOpenAI({ apiKey })` | `@ai-sdk/openai` | OpenAI **Responses API** | v3 默认用 Responses |
| deepseek | `createOpenAICompatible({ name, apiKey, baseURL })` | `@ai-sdk/openai-compatible` | Chat Completions API | **不支持** Responses |
| custom | `createOpenAICompatible({ name, apiKey, baseURL })` | `@ai-sdk/openai-compatible` | Chat Completions API | 同上 |

### 为什么 DeepSeek 和 Custom 必须用 `@ai-sdk/openai-compatible`

`@ai-sdk/openai` v3.0.71 默认使用 OpenAI 的 Responses API（`POST /responses`）。DeepSeek 和其他第三方只实现了 Chat Completions API（`POST /v1/chat/completions`）。直接使用 `createOpenAI` 会导致 `AI_APICallError: Not Found`。

`@ai-sdk/openai-compatible` 是 Vercel 官方包，专为 OpenAI 兼容第三方设计，走传统 Chat Completions 路径。需要传入 `name` 字段（必填）。

### API Key 必须显式传入

`createAnthropic`、`createOpenAI`、`createOpenAICompatible` 必须通过 `{ apiKey }` 显式传入 key。默认导出的 `anthropic()` / `openai()` 单例只读取环境变量 `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`，忽略用户在 UI 输入的 key。

### `test-connection` 路由

`src/app/api/test-connection/route.ts` 使用 `generateText`（非 stream）发送一个简单的 "Reply with just 'ok'" 请求测试连接。API key 和 provider 的传递方式同上。

## Schema 定义

`src/lib/tool-schema.ts` 定义两个独立 Zod Schema：

- `planSchema`：状态变更（attributeChanges, npcAffinityChanges, itemsGained/lost, newFlags/lostFlags）—— 全部 optional
- `choicesSchema`：选项数组（2-4 个，每个含 text + 可选条件检查）

## AI SDK v6 API 关键差异

| 旧 API（v5） | 新 API（v6） |
|-------------|-------------|
| `toolName: { description, parameters }` | `tool({ description, inputSchema: zodSchema(...) })` |
| `maxSteps: 2` | 不再使用（无 tool call） |
| `toDataStreamResponse()` | `toUIMessageStreamResponse()` |
| `readDataStream` 从 `ai` 导出 | 已移除，需手动实现 SSE 解析 |
| Zod 的 `z.record()` 一个参数 | `z.record(keySchema, valueSchema)` 两个参数 |

## API 配置面板（SystemSettings）

`src/components/SystemSettings.tsx` 提供完整的 API 配置 UI，包含预设选择、参数编辑、连接测试等功能。

### PRESETS 数组

四个内置预设供应商：

| ID | 名称 | provider | 默认模型 | Protocol |
|----|------|----------|---------|----------|
| openai | OpenAI | openai | gpt-4o | openai |
| anthropic | Anthropic | anthropic | claude-sonnet-4-6 | anthropic |
| deepseek | DeepSeek | deepseek | deepseek-chat | openai |
| custom | 自定义 | custom | （空） | openai |

### 自定义预设 CRUD

自定义预设与内置预设分开存储在独立的 localStorage key `adventure_custom_presets` 中。

### Protocol 对高级参数面板的影响

高级参数面板根据 `state.protocol` 分叉渲染：

**OpenAI 协议** 显示：推理力度、流式输出、温度、最大令牌数、核采样

**Anthropic 协议** 显示：思考模式、流式输出、最大令牌数、温度、核采样、候选数

### 连接测试全链路

`/api/test-connection` 使用 `generateText` 发送简单测试请求，返回延迟。

## 结构化记忆槽

为解决 `slice(-12)` 丢弃旧对话导致 AI 丢失早期剧情记忆的问题，引入独立于管线的记忆槽机制。

### 数据流

```
第 N 轮（三阶段管线结束后）：
  客户端收到完整旁白 → 与 Choices 并行调 POST /api/adventure/extract-facts
  → AI 从旁白提取新事实 → 客户端 Levenshtein 去重 → 写入 GamePlayContext

第 N+1 轮：
  Plan / Narrate / Choices 三阶段请求均携带 memoryFacts
  → 注入 [已知线索] 段落到各阶段的 prompt 中
```

### 端点

`POST /api/adventure/extract-facts`（`src/app/api/adventure/extract-facts/route.ts`）
- 输入：`narration`、`existingFacts`、API 配置
- 输出：`{ facts: string[], replaceFacts: string[] }`
- 温度 0.1 提高提取稳定性

## 删除的复杂度（相对旧版）

| 移除项 | 原因 |
|--------|------|
| 旧 `src/app/api/adventure/route.ts` | 三阶段替换单次调用 |
| `src/app/api/adventure/fallback/route.ts` | 不再需要 |
| fallback 调用逻辑（GameScreen） | 同上 |
| 工具调用提醒（每条消息追加） | 不再依赖 tool call |
| `stopWhen: stepCountIs(2)` | 无工具调用 step |
| `tool_call_metrics` localStorage 记录 | 无 fallback = 无需监控 |
| DeepSeek 默认温度 0.3 hack | 各阶段独立控温 |

## 延迟与成本预估

| 指标 | 旧方案 | 新方案 |
|------|--------|--------|
| 首字出现时间 | ~1s | ~2-3s |
| 选项出现时间 | 流结束即出现 | 流结束后 +1-2s |
| API 调用次数/轮 | 1-2 次 + 1 次 extract | 3 次 + 1 次 extract |
| Token 总成本 | ~1500-2000 入 + ~800 出 | 相当 |
| 可靠性 | ~60% 主成功，~90% 含 fallback | ~99%（generateObject 极少失败） |

## 相关文档
→ state-management.md：AppConfigContext 管理 provider/model/apiKey 状态
→ save-system.md：apiKey 在存档中的处理策略
→ world-card-system.md：world settings 注入 system prompt 的格式
→ game-options-conditions.md：Choices 生成的 options 最终流入 OptionsPanel
→ event-bus-typewriter.md：Narrate SSE 流通过 sharedEventBus 接入打字机渲染

## 边界
本文件覆盖 AI 引擎的三阶段管线架构、Provider 选择、Schema 定义、SSE 流处理和 API 配置面板。
不覆盖：状态存储（见 state-management.md）、存档（见 save-system.md）、打字机渲染（见 event-bus-typewriter.md）、选项条件评估（见 game-options-conditions.md）。

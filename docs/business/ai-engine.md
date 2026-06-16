---
name: ai-engine
description: Provider 选择规则（anthropic/deepseek/openai/custom 的工厂函数和 SDK 包）、Tool Use 协议（update_state schema）、SSE 流处理（streamText/generateText）、/api/adventure 和 /api/test-connection 的路由内部逻辑、SystemSettings API 配置面板（预设切换/自定义预设/协议兼容）、AI SDK v6 API 差异
---

# AI 引擎

## 核心 API Route：`src/app/api/adventure/route.ts`

使用 Vercel AI SDK v6 的 `streamText()` + Tool Use 协议实现 model→tool→model 两轮往返：

1. AI 输出叙述文本（200-400 字）→ SSE `text-delta` 事件
2. AI 调用 `update_state` 工具 → `tool-input-available` 事件
3. `stopWhen: stepCountIs(2)` 确保工具调用后即停止

### System Prompt（`buildSystemPrompt`）

注入世界设定、玩家属性、NPC 关系、物品栏、旗标、故事节拍进度。关键约束：

> 叙述结束后，**必须**调用 update_state 工具输出选项/属性变化/物品变化/旗标变化
> **当你调用 update_state 工具后，本回合即告结束，请勿在工具调用后继续输出任何文本。**

### Messages 构建（`buildMessages`）

- 返回 `Array<{ role: 'user' | 'assistant'; content: string }>`（Vercel AI SDK 统一格式）
- 最近 12 条对话，player → `[玩家选择]:`，narrator → assistant
- 无历史时注入初始场景提示

## Provider 选择规则

这是最容易出错的部分，四个提供商的 API 协议不同：

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

`src/app/api/test-connection/route.ts` 使用 `generateText`（非 stream）发送一个简单的 "Reply with just 'ok'" 请求测试连接。API key 和 provider 的传递方式同上，用 `createAnthropic`/`createOpenAI`/`createOpenAICompatible` 显式传入 apiKey。

## Tool Use Schema

`src/lib/tool-schema.ts` — 用 Zod v4 定义 `update_state` 工具的参数结构：

- `options`：**必填**，1-4 个选项，每个包含 text + 可选的条件检查
- `attributeChanges`、`npcAffinityChanges`、`itemsGained`、`itemsLost`、`newFlags`、`lostFlags`：全部 **optional**

## AI SDK v6 API 关键差异

| 旧 API（v5） | 新 API（v6） |
|-------------|-------------|
| `toolName: { description, parameters }` | `tool({ description, inputSchema: zodSchema(...) })` |
| `maxSteps: 2` | `stopWhen: stepCountIs(2)` |
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

预设按钮使用 `@lobehub/icons` 的 `ModelIcon` 组件展示对应品牌图标。点击预设时触发 `dispatch({ type: 'APPLY_PRESET', preset, ... })`，通过 `setAll` 批量更新 AppConfigContext。

### 自定义预设 CRUD

自定义预设与内置预设分开存储在独立的 localStorage key `adventure_custom_presets` 中：

```ts
interface CustomPreset {
  id: string
  name: string
  provider: 'custom'
  apiKey: string
  apiBaseURL: string
  model: string
  protocol: Protocol
  advancedParams?: Record<string, unknown>
}
```

- **创建**：仅在 provider 为 `custom` 时显示"添加供应商"按钮，将当前表单值保存为新预设
- **读取**：`loadCustomPresets()` 启动时从 localStorage 读取
- **更新**：暂不支持编辑，需删除后重新添加
- **删除**：每个自定义预设按钮右侧有删除图标，删除后如果该预设正被激活，自动切回默认自定义预设

### Protocol 对高级参数面板的影响

高级参数面板根据 `state.protocol` 分叉渲染：

**OpenAI 协议** 显示：
- 推理力度（reasoning_effort）：low / medium / high
- 流式输出（stream）：toggle
- 温度（temperature）：0-2
- 最大令牌数（max_tokens）：1-128000
- 核采样（top_p）：0-1

**Anthropic 协议** 显示：
- 思考模式（thinking）：enabled / disabled
- 流式输出（stream）：toggle
- 最大令牌数（max_tokens）：1-128000
- 温度（temperature）：0-1
- 核采样（top_p）：0-1
- 候选数（top_k）：0-100

### 连接测试全链路

用户点击"测试连接"时：

1. **前端** `handleTest` 函数构建 payload `{ apiKey, provider, model, customBaseURL }`
2. **前端** `fetch('/api/test-connection', { method: 'POST', body: JSON.stringify(payload), signal })` 发送请求，10秒超时（AbortController）
3. **后端** `src/app/api/test-connection/route.ts` 使用 `generateText` 发送简单测试请求，计时并返回延迟
4. **后端** 响应 `{ ok: true, latency: number }` 或 `{ ok: false, error: string }`
5. **前端** 根据 `data.ok` 显示绿色"连接成功 · Xms"或红色错误消息
6. 测试中按钮显示 "⏳ 测试中..." 并禁用

### 自动填充检测机制

API Key 输入框通过 CSS animation 检测浏览器的自动填充行为：

```ts
const handleApiKeyAnimationStart: React.AnimationEventHandler<HTMLInputElement> = (e) => {
  if (e.animationName === 'huashijie-autofill-detected') {
    autofillRef.current = true      // 标记自动填充
  } else if (e.animationName === 'huashijie-autofill-cleared') {
    autofillRef.current = false     // 标记清除
  }
}
```

- `handleApiKeyChange` 在 `autofillRef.current === true` 时拒绝对值的修改
- 浏览器自动填入的密码管理数据不会写进 state
- CSS 类名 `huashijie-apikey` 配合 `huashijie-autofill-detected` / `huashijie-autofill-cleared` 动画实现检测

## Bug 记录：DeepSeek 工具调用失败（已修复）

### 症状

新游戏第一轮正常（`toolCall: true`），第二轮起 AI 仅生成叙述文本不调用 `update_state` 工具（`toolCall: false`）。属性变化和 NPC 好感度完全停滞。

### 排查过程

| 尝试 | 方法 | 结果 |
|------|------|------|
| 1 | 重写系统提示词（数值约束表、强制工具调用规则） | 局部改善，不够稳定 |
| 2 | 工具描述标注"每次必须调用" | 无明显影响 |
| 3 | `toolChoice: 'required'` 强制调用 | DeepSeek 跳过叙述直接调工具，文本为 0 字 |
| 4 | 删除提示词中"Flash 不支持工具调用"（自证预言） | 必要但不够 |
| 5 | 过滤 `advancedParams` 中 `thinking`/`reasoning_effort` 非标准参数 | 无影响 |
| 6 | 换模型 `deepseek-v4-pro` | 都能调，排除模型差异 |
| 7 | curl 用完整蒸汽苍穹世界卡 + 29 条对话 + thinking 参数测试 | 稳定调用，排除载荷大小 |
| 8 | **新开游戏** | 第一轮成功，第二轮起失败 — 定位到 `buildMessages` |

### 根因

`buildMessages` 函数中，新游戏第一轮注入初始消息时附带明确的工具调用指令：

```
[游戏开始]
初始场景：...
请根据以上场景开始叙述，并调用 update_state 工具。
```

但后续轮次只输出 `[玩家选择]: xxx`，没有工具调用提醒。DeepSeek 模型需要每条用户消息都包含明确指令才能稳定调用工具。

### 修复

**文件**: `src/app/api/adventure/route.ts` — `buildMessages` 函数

在处理完常规消息后，向最后一条用户消息追加工具调用提醒：

```ts
if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
  messages[messages.length - 1].content += '\n\n（请先写叙述，然后必须调用 update_state 工具。）'
}
```

同时进行的配套修复：
- 模型适配注释从"Flash 不支持工具调用"改为"双模型验证通过"
- 默认模型名 `deepseek-chat` → `deepseek-v4-pro`（DeepSeek 官方已更名）
- 默认 `advancedParams` 移除 `thinking`/`reasoning_effort`（非标准参数，避免干扰）
- 服务端显式过滤 `advancedParams`，仅传递 `temperature`/`max_tokens`/`top_p`

### 验证结果

新游戏连续交互 11+ 轮，工具调用率 100%，属性变化和好感度变化正常。

## 相关文档
→ state-management.md：AppConfigContext 管理 provider/model/apiKey 状态
→ save-system.md：apiKey 在存档中的处理策略（上传时置空）
→ world-card-system.md：world settings 注入 system prompt 的格式
→ game-options-conditions.md：AI 生成的 options 最终流入 OptionsPanel

## 边界
本文件覆盖 AI 引擎的 Provider 选择、Tool Use 协议、SSE 流处理和 API 配置面板。
不覆盖：状态存储（见 state-management.md）、存档（见 save-system.md）、打字机渲染（见 event-bus-typewriter.md）。

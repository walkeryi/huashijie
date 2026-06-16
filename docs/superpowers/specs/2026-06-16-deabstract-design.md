# 去抽象化极简方案 — 架构设计文档

> 状态：定稿
> 日期：2026-06-16
> 目标：消除不必要的抽象层，减少代码间接性，提升运行时性能和可维护性

---

## 概述

本方案从四个维度对项目进行去抽象化改造：

| 模块 | 核心策略 | 效果 |
|------|---------|------|
| 一、渲染与架构减负 | 交互孤岛 + Context 频率分离 + React 19 `use()` | 消减 7 个 `'use client'` 组件，根除高频无效重渲染 |
| 二、核心热点去抽象化 | RAF 原生打字机 + CSS content-visibility | 打字机零 JS state 开销，长列表零布局开销 |
| 三、AI 引擎重构 | Vercel AI SDK + Tool Use + SSE 物理隔离 | 0 正则、0 括号计数、0 字符串截断；API Route 缩减 80% |
| 四、状态反馈与样式极简 | useOptimistic + CSS data-theme | 瞬时 UI 反馈，零 JS 运行时换肤 |

---

## 一、渲染与架构减负

### 1.1 交互孤岛策略

将纯展示 UI 降级为 RSC（服务端组件），客户端 JS 仅保留交互节点。

**组件分类：**

```
RSC 层（无 'use client'，server-only）
├── app/layout.tsx         — 根布局
├── app/page.tsx           — 首页（菜单/世界选择/读档）
├── app/creator/layout.tsx — 创作台固定框架
├── app/creator/page.tsx   — 创作台内容
└── app/guide/page.tsx     — 纯静态文档，零 JS

客户端岛屿（仅 5 个 'use client' 节点）
├── GameIsland      — GameScreen → DialogueBox + OptionsPanel
├── StatusIsland    — StatusPanel → NPCPanel + InventoryPanel + FlagPanel
├── SettingsIsland  — SystemSettings
├── AccountIsland   — AccountButton
└── CreatorIsland   — WorldCreator（表格/输入的交互节点）
```

**数据获取边界：**

- RSC 层使用 `cookies()` 读取账户 token / 主题偏好；`fetch()` 获取云端数据。
- RSC 不碰 `localStorage`。本地存档读取下沉到客户端岛屿内完成。
- RSC 将云端数据作为 Promise 传给客户端岛屿。

### 1.2 Context 三层分离 + 打字机外部通道

将原来的单体 `GameContext` 拆为三个独立 Context，按变更频率物理隔离：

#### AppConfigContext（变更频率：用户手动操作）

```
字段: apiKey, provider, model, advancedParams, saveMode, accountName, theme
消费者: SystemSettings, AccountButton
```

#### PlayerStateContext（变更频率：每次 AI 响应后更新一次）

```
字段: attributes, inventory, flags, npcAffinities, npcRuntime, worldCard, screen
消费者: StatusPanel, NPCPanel, InventoryPanel, FlagPanel
```

#### GamePlayContext（变更频率：用户交互 + AI 流结束后写一次完整文本）

```
字段: dialogueHistory（完整文本，不含逐字进度）, currentOptions, isLoading, error
消费者: GameScreen, OptionsPanel
```

**打字机完全脱离 React Context：**

```
DialogueBox 内部:
  completeText  ← 从 GamePlayContext 读取完整文本（归档用）
  useRef        → 指向 <p> DOM 节点
  useEffect     → SSE chunk 到达时启动 RAF 循环
                   requestAnimationFrame → domRef.textContent += char
                   React 层面永远只渲染一次，无逐字 setState

光标: span::after { content: "▍"; animation: blink 1s step-end infinite; }
      @keyframes blink { 50% { opacity: 0; } }
      彻底与 JS 打字逻辑解耦
```

#### SSE 外部通道架构

```
SSE chunk 到达
     │
     ▼
┌─────────────┐     text-delta chunk     ┌──────────┐
│  EventBus    │ ──────────────────────►  │   DOM    │
│  (useRef)    │       绕过 React         │ 打字机    │
└──────┬──────┘                          └──────────┘
       │
       │ tool-call 事件
       ▼
┌─────────────────┐
│ dispatch 到      │  SDK 已保证 JSON 合法完整
│ PlayerStateContext│
└─────────────────┘
       │
       │ 流结束
       ▼
┌─────────────────┐
│ 完整文本写入      │  仅此一次触发 React 重渲染
│ GamePlayContext  │
└─────────────────┘
```

### 1.3 React 19 `use()` 消除瀑布流

RSC 层预取数据，传 Promise 给客户端，客户端用 `use()` + Suspense 消费，消除 `useEffect → setState → 重渲染` 瀑布流。

```tsx
// app/game/page.tsx (RSC)
export default function GamePage() {
  const cloudSaves = fetchCloudSaves(cookies().get('token'))
  return <GameIsland cloudSaves={cloudSaves} />
}

// components/GameIsland.tsx ('use client')
function GameIsland({ cloudSaves }: { cloudSaves: Promise<SaveMeta[]> }) {
  const remote = use(cloudSaves)  // Suspense 自动承接
  const [saves] = useState(() => remote.length ? remote : localLoadSaves())
  // ...
}
```

---

## 二、核心热点"去抽象化"

### 2.1 打字机原生驱动

实现细节：

```
SSE chunk 抵达
     │
     ▼
EventBus.append(chunk)
     │
     ├─ 追加到 bufferRef（累积完整文本供归档）
     │
     └─ 若 RAF 未运行，启动 RAF 循环:
           │
           ▼
        ┌──────────────────────┐
        │ 每帧取 bufferRef 中   │
        │ 未渲染的字符区间      │
        │ domRef.textContent    │
        │ += pendingChars       │
        │ (每帧 2-3 字符)      │
        └──────┬───────────────┘
               │ buffer 耗尽
               ▼
        暂停 RAF (等待下一个 chunk)

流结束信号 →
     1. RAF 耗尽所有剩余字符
     2. 将 bufferRef 完整文本写入 GamePlayContext 归档
     3. 自毁 RAF 循环
```

**关键约束：**

- RAF 每帧输出 2-3 个中文字符（约 40-60ms/字，接近自然阅读节奏）
- 若 buffer 积压超过阈值（用户快速跳过快进），一次性输出全部，不卡帧
- 打字机 DOM 节点用 `ref` 持有，`React.memo` 保护外层，React 不参与逐字渲染
- 闪烁光标用纯 CSS 实现（`span::after + animation: blink 1s step-end infinite`），与 JS 打字逻辑彻底解耦

### 2.2 长列表渲染卸载

纯 CSS 方案，零 JS 开销：

```css
.dialogue-entry {
  content-visibility: auto;
  contain-intrinsic-size: auto 80px;
}
```

- 屏幕外的对话条目浏览器直接跳过布局/绘制计算
- `contain-intrinsic-size` 保持滚动条稳定
- 若对话气泡有淡入动画 → 用 IntersectionObserver 加 `data-visible` 属性作为 CSS 选择器钩子，仅对距视口 > 2 屏的条目禁用动画
- 组件卸载或条目移除时必须 `unobserve()` 防止内存泄漏

---

## 三、AI 引擎与数据流重构

### 3.1 SDK 替换

```
删除:
  @anthropic-ai/sdk
  openai

引入:
  ai (Vercel AI SDK)
  @ai-sdk/anthropic
  @ai-sdk/openai
```

### 3.2 Tool Use 协议

**核心原则：文本与数据在协议层物理隔离。** 模型调用 `update_state` 工具输出结构化数据，SDK 自动拼装完整 JSON Object。前端 0 正则、0 括号计数、0 字符串截断拼接。

#### API Route 骨架

```ts
// app/api/adventure/route.ts
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'  // 或内联 JSON Schema

const tools = {
  update_state: {
    description: '更新游戏状态、选项、属性和物品。调用后本回合即告结束。',
    parameters: z.object({
      options: z.array(z.object({
        text: z.string(),
        attributeChecks: z.record(z.string()).optional(),
        npcAffinityChecks: z.record(z.string()).optional(),
        flagChecks: z.array(z.string()).optional(),
        flagNot: z.array(z.string()).optional(),
        itemChecks: z.array(z.string()).optional(),
        itemNot: z.array(z.string()).optional(),
      })),
      attributeChanges: z.record(z.number()).optional(),
      npcAffinityChanges: z.record(z.number()).optional(),
      newFlags: z.array(z.string()).optional(),
      lostFlags: z.array(z.string()).optional(),
      itemsGained: z.array(z.string()).optional(),
      itemsLost: z.array(z.string()).optional(),
    }),
  },
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { worldCard, playerState, dialogueHistory, apiKey, provider, model, customBaseURL, advancedParams } = body

  const result = streamText({
    model: provider === 'anthropic'
      ? anthropic(model || 'claude-sonnet-4-6')
      : openai(model || 'gpt-4o', customBaseURL ? { baseURL: customBaseURL } : undefined),
    system: buildSystemPrompt(worldCard, playerState, body.npcAffinities, body.npcRuntime),
    messages: buildMessages(dialogueHistory, worldCard),  // Vercel AI SDK 统一格式
    tools,
    maxSteps: 2,
  })

  return result.toDataStreamResponse()
}
```

#### System Prompt 关键约束

```
当你调用 update_state 工具后，本回合即告结束，请勿在工具调用后继续输出任何文本。
```

#### 辅助函数改造范围

| 函数 | 改造内容 |
|------|---------|
| `buildSystemPrompt()` | 追加 Tool Use 相关指令（"调用工具后本回合即告结束"、"必须调用 `update_state` 工具输出游戏数据"）；移除旧的 JSON 输出格式说明 |
| `buildMessages()` | 返回值改为 Vercel AI SDK 的 `CoreMessage[]` 格式（`{ role: 'user' \| 'assistant', content: string }`）；移除 Anthropic 原生 `MessageParam[]` 格式分支 |

### 3.3 客户端消费（物理隔离）

使用 `readDataStream` 底层 API 消费流，接入 EventBus 外部通道：

```ts
const response = await fetch('/api/adventure', { method: 'POST', body: ... })
const reader = readDataStream(response.body!)

for await (const part of reader) {
  if (part.type === 'text-delta') {
    eventBus.append(part.textDelta)        // → RAF → 打字机 DOM（绕过 React）
  }
  else if (part.type === 'tool-call' && part.toolName === 'update_state') {
    dispatch({ type: 'UPDATE_STATE', payload: part.args })  // → PlayerStateContext
  }
}
// 流结束后: 完整文本归档 GamePlayContext，dispatch isLoading: false
```

选择 `readDataStream` 而非 `useChat` 的原因：打字机走 EventBus 外部通道，`useChat` 的内置 messages 管理是多余抽象。

### 3.4 生命周期管理

用户中途退出或切换页面时，后台流仍在消耗内存和网络带宽。使用 `AbortController` 强制回收：

```ts
const abortRef = useRef<AbortController>()

async function submitAction(optionText: string) {
  // 取消上一轮未完成的流（如有）
  abortRef.current?.abort()

  const controller = new AbortController()
  abortRef.current = controller

  try {
    const response = await fetch('/api/adventure', {
      method: 'POST',
      body: ...,
      signal: controller.signal,
    })
    // ... readDataStream
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    // 正常错误处理
  }
}

// 组件卸载时清理
useEffect(() => {
  return () => abortRef.current?.abort()
}, [])
```

### 3.5 降级兜底

```
流结束后 toolCalls.length === 0
    ↓
注入默认选项: [继续前进] [观察周围] [交谈]
显示灰色提示: "信号波动，时光微微停滞..."
```

### 3.6 删除代码清单

| 文件/函数 | 原因 |
|-----------|------|
| `adventure/route.ts` → `parseAIResponse()` | Tool Use 协议层隔离 |
| `adventure/route.ts` → `extractJsonFromText()` | 同上 |
| `adventure/route.ts` → `validateAIResponse()` | Zod schema 自动校验 |
| `adventure/route.ts` → `buildAnthropicMessages()` | Vercel AI SDK 统一处理 |
| `adventure/route.ts` → `buildOpenAIMessages()` | 同上 |
| `adventure/route.ts` → `callAnthropic()` | 内联到 `streamText` |
| `adventure/route.ts` → `callOpenAI()` | 同上 |
| `adventure/route.ts` → `detectProvider()` | 前端已传 provider 字段 |
| `game-context.tsx` → 高频状态字段 | 拆分至三个 Context |
| `game-context.tsx` → `migratePollutedApiConfigs()` | 运行已久，污染数据已修复 |

`adventure/route.ts` 预计从 404 行缩减至约 80 行（-80%）。

---

## 四、状态反馈与样式极简

### 4.1 存档乐观更新

使用 React 19 `useOptimistic` 实现存/读档 UI 瞬时反馈：

```tsx
const [saveSlots, setSaveSlots] = useState<SaveData[]>([])
const [optimisticSlots, addOptimistic] = useOptimistic(
  saveSlots,
  (state, newSlot: SaveData) => [newSlot, ...state.filter(s => s.id !== newSlot.id)]
)

async function handleSave(slot: number) {
  const data = buildSaveData()
  addOptimistic(data)                      // UI 瞬时响应
  await saveService.saveToSlot(slot, data)  // 后台静默写入
  setSaveSlots(await refreshSaves())        // 以服务器为准最终校对
}
```

#### 防抖策略

自动存档的防抖：每次 AI 响应后触发 autoSave → debounce 2s（若 2s 内又有新响应，取消前一次）→ 写入（在线失败时静默回退 localStorage）。激烈战斗/快速对话时不排队堆积 I/O。

#### 触发语境

React 19 中 `useOptimistic` 配合 async action 是标准模式。`addOptimistic` 与 `await saveService` 之间无同步阻塞，结构正确。`useOptimistic` 的 reducer 在 `await` 后自动回退到 `saveSlots` 的真实值，最终 `setSaveSlots` 触发最终一致性校对。

### 4.2 主题 CSS 变量化

借助 Tailwind v4 原生能力，将 4 套主题切换逻辑从 JS 类名计算降维为纯 CSS 变量切换：

```css
/* globals.css */
[data-theme="golden"] {
  --accent: #f59e0b;
  --accent-hover: #d97706;
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-card: #1e293b;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --border: #334155;
}

[data-theme="steam"] { /* ... */ }
[data-theme="zhumo"] { /* ... */ }
[data-theme="cyber"] { /* ... */ }
```

切换逻辑降为一行属性设置：

```tsx
// layout.tsx
<html data-theme={getThemeCookie()}>

// 用户切换主题时：
function setTheme(themeId: string) {
  document.documentElement.setAttribute('data-theme', themeId)
  // 同步到客户端存储和 Cookie
  localStorage.setItem('theme', themeId)
  document.cookie = `theme=${themeId}; path=/; max-age=31536000; SameSite=Lax`
}
```

#### Cookie 同步

必要性：仅写 `localStorage` 会导致 SSR/RSC 首屏用默认主题，客户端 hydration 时闪烁切换。`document.cookie` 是服务端获取主题偏好的唯一通道。

```
getThemeCookie() — 服务端 cookies().get('theme')?.value → 设置 <html data-theme>
setTheme()       — 同时写入:
                   ├── document.documentElement.setAttribute('data-theme', id)  // 即时 UI
                   ├── localStorage.setItem('theme', id)                        // 客户端持久化
                   └── document.cookie = `theme=${id};...`                      // RSC 首屏可达
```

**删除文件：** `components/ThemeProvider.tsx`（整个文件消失，零 JS 运行时换肤）

---

## 整体变更清单

### 新增依赖
| 包 | 用途 |
|----|------|
| `ai` | Vercel AI SDK 核心 |
| `@ai-sdk/anthropic` | Anthropic provider |
| `@ai-sdk/openai` | OpenAI provider |
| `zod` | Tool schema 定义与校验 |

### 删除依赖
| 包 | 原因 |
|----|------|
| `@anthropic-ai/sdk` | Vercel AI SDK 替代 |
| `openai` | Vercel AI SDK 替代 |

### 删除文件
| 文件 | 原因 |
|------|------|
| `components/ThemeProvider.tsx` | CSS `data-theme` 替代，零 JS 换肤 |

### 重构文件（核心）
| 文件 | 变更 |
|------|------|
| `app/api/adventure/route.ts` | 404 行 → ~80 行，Tool Use + Vercel AI SDK |
| `lib/game-context.tsx` | 单体 Context → 三层分离（AppConfig / PlayerState / GamePlay） |
| `components/DialogueBox.tsx` | setState 打字 → RAF + DOM 原生 textContent |
| `components/GameScreen.tsx` | 整合 EventBus 通道，`readDataStream` 消费 |
| `app/page.tsx` | RSC 化，客户端岛屿拆分 |
| `app/game/page.tsx` | RSC + React 19 `use()` |

### 已删除函数
| 函数 | 原位置 |
|------|--------|
| `parseAIResponse()` | `adventure/route.ts` |
| `extractJsonFromText()` | `adventure/route.ts` |
| `validateAIResponse()` | `adventure/route.ts` |
| `buildAnthropicMessages()` | `adventure/route.ts` |
| `buildOpenAIMessages()` | `adventure/route.ts` |
| `callAnthropic()` | `adventure/route.ts` |
| `callOpenAI()` | `adventure/route.ts` |
| `detectProvider()` | `adventure/route.ts` |
| `migratePollutedApiConfigs()` | `game-context.tsx` |

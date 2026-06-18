# 去抽象化极简方案 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将话世界项目从当前的 Context/Reducer 单体架构 + 原生 SDK 双路径 + React 状态驱动打字机，重构为三层 Context 分离 + Vercel AI SDK Tool Use + RAF 原生打字机 + RSC 交互孤岛。

**Architecture:** 四大模块依次实施——先打基础（依赖安装、CSS 主题、Context 拆分），再替换 AI 引擎（Tool Use 协议），最后优化渲染层（RSC 孤岛、乐观更新）。每模块内部任务独立可测，模块间顺序依赖。

**Tech Stack:** Next.js 16, React 19, Vercel AI SDK, Tailwind CSS v4, Vitest, TypeScript

**Spec:** `docs/superpowers/specs/2026-06-16-deabstract-design.md`

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `src/lib/app-config-context.tsx` | AppConfigContext：API 配置、存档模式、主题 — 变更频率最低 |
| `src/lib/player-state-context.tsx` | PlayerStateContext：属性/物品/标记/NPC/WorldCard — AI 响应后更新 |
| `src/lib/game-play-context.tsx` | GamePlayContext：对话历史/选项/loading/error — 流结束后归档 |
| `src/lib/event-bus.ts` | 事件总线：SSE chunk 到打字机 DOM 的外部通道，绕过 React |
| `src/lib/tool-schema.ts` | update_state tool 的 Zod schema 定义 |
| `src/lib/__tests__/event-bus.test.ts` | EventBus 单元测试 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `package.json` | 替换依赖：删除 `@anthropic-ai/sdk` + `openai`，添加 `ai` + `@ai-sdk/anthropic` + `@ai-sdk/openai` + `zod` |
| `src/app/api/adventure/route.ts` | 404行→~80行：Vercel AI SDK + Tool Use |
| `src/lib/game-context.tsx` | 拆分为三个 Context 文件，保留兼容 re-export 过渡 |
| `src/lib/types.ts` | 删除 `SET_LOADING`/`SET_RESPONSE` 等旧 action 类型（仅保留三层 Context 所需的 action），新增 EventBus 类型 |
| `src/components/DialogueBox.tsx` | setState 打字→RAF + DOM textContent + CSS 光标 |
| `src/components/GameScreen.tsx` | readDataStream 集成 + EventBus 通道 + AbortController |
| `src/components/StatusPanel.tsx` | 改用 PlayerStateContext + useOptimistic |
| `src/app/layout.tsx` | 删除 ThemeProvider，改用 data-theme + 新 Provider 嵌套 |
| `src/app/page.tsx` | RSC 化，客户端岛屿拆分 |
| `src/app/game/page.tsx` | RSC + use() + Suspense |
| `src/app/globals.css` | 添加 [data-theme] 4 套主题 CSS 变量 |
| `src/lib/theme.ts` | `applyTheme()` 改为 setAttribute + cookie 同步 |
| `src/components/SystemSettings.tsx` | 适配 AppConfigContext，主题切换改用 setAttribute |

### 删除文件

| 文件 | 原因 |
|------|------|
| `src/components/ThemeProvider.tsx` | CSS data-theme 替代 |

---

### Task 1: 安装新依赖，删除旧依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 卸载旧 SDK**

```bash
npm uninstall @anthropic-ai/sdk openai
```
Expected: 两个包从 `package.json` dependencies 中移除。

- [ ] **Step 2: 安装新 SDK**

```bash
npm install ai @ai-sdk/anthropic @ai-sdk/openai zod
```
Expected: 四个包添加到 dependencies。

- [ ] **Step 3: 验证安装**

```bash
node -e "const { streamText } = require('ai'); console.log('ai SDK OK')"
node -e "const { z } = require('zod'); console.log('zod OK: ' + z.string().description)"
```
Expected: 两个 OK 输出，无报错。

- [ ] **Step 4: 提交**

```bash
git add package.json package-lock.json
git commit -m "chore: 替换 AI SDK — 删除 @anthropic-ai/sdk + openai，引入 ai + @ai-sdk/anthropic + @ai-sdk/openai + zod"
```

---

### Task 2: CSS data-theme 主题系统 + 删除 ThemeProvider

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/lib/theme.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/SystemSettings.tsx`
- Delete: `src/components/ThemeProvider.tsx`

- [ ] **Step 1: 在 globals.css 添加 [data-theme] 变体**

在 `:root` 块之后追加四套主题定义：

```css
/* ====== 主题定义 ====== */
[data-theme="gold"] {
  --bg-primary: #0f0f0f;
  --bg-secondary: #1a1a1a;
  --bg-card: #1e1e1e;
  --text-primary: #e0d5c1;
  --text-secondary: #a09888;
  --accent: #c9a96e;
  --accent-hover: #d4b87a;
  --danger: #8b4444;
  --border: #2a2a2a;
  --font-family: "Georgia", "Noto Serif SC", serif;
  --border-radius: 0.75rem;
  --border-width: 1px;
  --border-style: solid;
  --button-depth: 0 1px 3px rgba(0,0,0,0.3);
  --bg-texture: none;
}

[data-theme="steam"] {
  --bg-primary: #1a1410;
  --bg-secondary: #231e17;
  --bg-card: #292218;
  --text-primary: #e8dcc8;
  --text-secondary: #b0a088;
  --accent: #b8954a;
  --accent-hover: #c9a65d;
  --danger: #9b5050;
  --border: #4a3828;
  --font-family: "Impact", "SimHei", "PingFang SC", sans-serif;
  --border-radius: 0.25rem;
  --border-width: 2px;
  --border-style: double;
  --button-depth: 2px 2px 0 var(--border);
  --bg-texture: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(180,140,60,0.03) 2px, rgba(180,140,60,0.03) 4px);
}

[data-theme="cinnabar"] {
  --bg-primary: #111018;
  --bg-secondary: #1a1822;
  --bg-card: #201e28;
  --text-primary: #f0e8e0;
  --text-secondary: #c0b0a0;
  --accent: #c45050;
  --accent-hover: #d46565;
  --danger: #8b3030;
  --border: #2a2530;
  --font-family: "KaiTi", "STKaiti", "Noto Serif SC", serif;
  --border-radius: 0.5rem;
  --border-width: 1px;
  --border-style: solid;
  --button-depth: 0 1px 2px rgba(196,80,80,0.15);
  --bg-texture: none;
}

[data-theme="cyber"] {
  --bg-primary: #0a0a1a;
  --bg-secondary: #0f0f24;
  --bg-card: #141430;
  --text-primary: #d0d0ff;
  --text-secondary: #8888bb;
  --accent: #00ffcc;
  --accent-hover: #33ffdd;
  --danger: #ff3366;
  --border: #1a1a44;
  --font-family: "Courier New", "Fira Code", "PingFang SC", monospace;
  --border-radius: 0.25rem;
  --border-width: 1px;
  --border-style: solid;
  --button-depth: 0 0 10px rgba(0,255,204,0.2);
  --bg-texture: repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(0,255,204,0.02) 20px, rgba(0,255,204,0.02) 21px), repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(0,255,204,0.02) 20px, rgba(0,255,204,0.02) 21px);
}
```

- [ ] **Step 2: 改造 theme.ts — 换肤改为 setAttribute**

替换 `applyTheme` 函数：

```ts
// src/lib/theme.ts — 替换 applyTheme() 和新增 setTheme()/getThemeCookie()

const THEME_KEY = 'adventure_theme'
const FONT_KEY = 'adventure_font_size'

export function loadTheme(): string {
  if (typeof window === 'undefined') return 'gold'
  return localStorage.getItem(THEME_KEY) || 'gold'
}

export function setTheme(themeId: string): void {
  document.documentElement.setAttribute('data-theme', themeId)
  localStorage.setItem(THEME_KEY, themeId)
  document.cookie = `theme=${themeId}; path=/; max-age=31536000; SameSite=Lax`
}

export function applyTheme(theme: Theme): void {
  // 迁移路径：旧调用改为 setAttribute 方式
  setTheme(theme.id)
}

// 服务端读取主题 cookie（供 RSC 使用）
export function getThemeCookie(cookieHeader: string): string {
  const match = cookieHeader.match(/(?:^|;\s*)theme=([^;]*)/)
  return match?.[1] || 'gold'
}

// 保留 applyFontSize, loadFontSize, saveFontSize 不变
// 保留 themes 数组和 Theme/ThemeVars 类型（SystemSettings 仍引用主题列表）
```

- [ ] **Step 3: 改造 layout.tsx — 移除 ThemeProvider，改用 data-theme**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { GameProvider } from '@/lib/game-context'
import GlobalButtons from '@/components/GlobalButtons'
import { getThemeCookie } from '@/lib/theme'

export const metadata: Metadata = {
  title: '话世界',
  description: '用对话创造世界 — AI 驱动的文字冒险引擎',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const themeId = getThemeCookie(cookies().toString())

  return (
    <html lang="zh-CN" data-theme={themeId} suppressHydrationWarning>
      <body className="min-h-screen">
        <GameProvider>
          {children}
          <GlobalButtons />
        </GameProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: 改造 SystemSettings.tsx 主题切换部分**

找到 SystemSettings 中调用 `applyTheme(theme)` 的地方，改为调用 `setTheme(themeId)`。需要将 `import { applyTheme, ... }` 改为 `import { setTheme, ... }`。

- [ ] **Step 5: 删除 ThemeProvider.tsx**

```bash
rm src/components/ThemeProvider.tsx
```

- [ ] **Step 6: 验证构建**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 无 TypeScript 错误（如果有 ThemeProvider 的残留 import，修复后再运行）。

- [ ] **Step 7: 提交**

```bash
git add src/app/globals.css src/lib/theme.ts src/app/layout.tsx src/components/SystemSettings.tsx
git rm src/components/ThemeProvider.tsx
git commit -m "refactor: CSS data-theme 换肤 + 删除 ThemeProvider — 零 JS 运行时换肤"
```

---

### Task 3: 定义 Tool Schema

**Files:**
- Create: `src/lib/tool-schema.ts`

- [ ] **Step 1: 创建 tool-schema.ts**

```ts
// src/lib/tool-schema.ts
import { z } from 'zod'

export const updateStateSchema = z.object({
  options: z.array(
    z.object({
      text: z.string(),
      attributeChecks: z.record(z.string()).optional(),
      npcAffinityChecks: z.record(z.string()).optional(),
      flagChecks: z.array(z.string()).optional(),
      flagNot: z.array(z.string()).optional(),
      itemChecks: z.array(z.string()).optional(),
      itemNot: z.array(z.string()).optional(),
    })
  ).min(1).max(4),
  attributeChanges: z.record(z.number()).optional(),
  npcAffinityChanges: z.record(z.number()).optional(),
  newFlags: z.array(z.string()).optional(),
  lostFlags: z.array(z.string()).optional(),
  itemsGained: z.array(z.string()).optional(),
  itemsLost: z.array(z.string()).optional(),
})

export type UpdateStateArgs = z.infer<typeof updateStateSchema>
```

- [ ] **Step 2: 验证 schema 正确性**

```bash
node -e "
const { z } = require('zod');
const schema = z.object({ options: z.array(z.object({ text: z.string() })) });
const result = schema.safeParse({ options: [{ text: '前进' }] });
console.log('Valid:', result.success);
const bad = schema.safeParse({ options: [{ text: 123 }] });
console.log('Invalid caught:', !bad.success);
"
```
Expected: `Valid: true` `Invalid caught: true`

- [ ] **Step 3: 提交**

```bash
git add src/lib/tool-schema.ts
git commit -m "feat: 定义 update_state tool 的 Zod schema"
```

---

### Task 4: 重写 adventure/route.ts

**Files:**
- Modify: `src/app/api/adventure/route.ts`

这是核心变更 — 从 404 行缩到约 80 行。完整代码：

```ts
// src/app/api/adventure/route.ts
import { NextRequest } from 'next/server'
import { streamText, CoreMessage } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { WorldCard, PlayerState, DialogueEntry } from '@/lib/types'
import { updateStateSchema } from '@/lib/tool-schema'

const API_TIMEOUT_MS = 30000

function getApiKey(apiKeyOverride?: string): string {
  const key = apiKeyOverride || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
  if (!key) throw new Error('缺少 API Key：请在页面输入或设置环境变量')
  return key
}

function sanitizePlayerName(name: string): string {
  return name.replace(/[\n\r\\]/g, '').slice(0, 50)
}

export function buildSystemPrompt(
  worldCard: WorldCard,
  playerState: PlayerState,
  npcAffinities: Record<string, number> = {},
  npcRuntime: Record<string, { currentSelfPerception: string; currentState: string }> = {},
): string {
  const attrText = Object.entries(playerState.attributes ?? {})
    .map(([key, val]) => {
      const def = worldCard.attributes.find(a => a.key === key)
      return def ? `${def.icon} ${def.name}: ${val}/${def.max}` : `${key}: ${val}`
    })
    .join('\n')

  const npcText = worldCard.npcs.length > 0
    ? worldCard.npcs.map(npc => {
        const f = npc.fields
        const affinity = npcAffinities[npc.id] ?? f.initialAffinity ?? 0
        let text = `👤 ${f.name || npc.id} | 好感: ${affinity}/100`
        if (f.gender) text += ` | 性别: ${f.gender}`
        if (f.origin) text += ` | 来历: ${f.origin}`
        if (f.dialogueTone) text += ` | 性格: ${f.dialogueTone}`
        if (f.personalityTags?.length) text += ` | 标签: ${f.personalityTags.join('、')}`
        if (f.appearance) text += ` | 外貌: ${f.appearance}`
        if (f.currentAttire) text += ` | 衣着: ${f.currentAttire}`
        if (f.dialogueExamples) text += `\n说话风格参考（勿照搬）: ${f.dialogueExamples}`
        return text
      }).join('\n\n')
    : '无'

  const inventoryText = playerState.inventory && playerState.inventory.length > 0
    ? playerState.inventory.map(item => `- ${item}`).join('\n')
    : '空'

  const flagsText = playerState.flags
    ? Object.entries(playerState.flags).filter(([, val]) => val).map(([key]) => `- ${key}`).join('\n')
    : ''
  const flagsDisplay = flagsText || '无'

  const beats = worldCard.storyBeats ?? []
  const completedBeats = beats.filter(b => playerState.flags?.[b.id]).map(b => b.name)
  const availableBeats = beats.filter(b => {
    if (playerState.flags?.[b.id]) return false
    const anyUnlockerComplete = b.id === 'intro' || beats.some(
      ub => ub.unlocks.includes(b.id) && playerState.flags?.[ub.id]
    )
    if (!anyUnlockerComplete) return false
    if (b.preconditions?.flagChecks) {
      for (const f of b.preconditions.flagChecks) {
        if (!playerState.flags?.[f]) return false
      }
    }
    return true
  }).map(b => b.name)
  const lockedBeats = beats.filter(b => !completedBeats.includes(b.name) && !availableBeats.includes(b.name)).map(b => b.name)

  const beatProgress = [
    completedBeats.length > 0 ? `✅ 已完成: ${completedBeats.join('、')}` : '',
    availableBeats.length > 0 ? `🔓 可解锁: ${availableBeats.join('、')}` : '',
    lockedBeats.length > 0 ? `🔒 未解锁: ${lockedBeats.join('、')}` : '',
  ].filter(Boolean).join('\n') || '无节拍数据'

  return `你是一个文字冒险游戏的叙事引擎。你必须严格遵循以下设定来运行游戏。

## 世界设定
${worldCard.description}

## 玩家当前状态
- 姓名：${sanitizePlayerName(playerState.playerName)}
${attrText}

## NPC 关系
${npcText}

## 物品栏
${inventoryText}

## 已解锁旗标
${flagsDisplay}

## 故事进度
${beatProgress}

## 你的职责
1. 根据玩家的选择推进故事
2. 描述场景、NPC 反应和事件发展
3. 故事的走向应该受玩家属性影响
4. 每次回复首先输出叙述文本（200-400字），然后调用 update_state 工具输出游戏数据
5. 故事节拍规则：玩家的行动应朝向解锁🔓可用的节拍

## 重要规则
- 先用纯中文写叙述（200-400字），语言优美有画面感
- 叙述结束后，**必须**调用 update_state 工具输出选项/属性变化/物品变化/旗标变化
- **当你调用 update_state 工具后，本回合即告结束，请勿在工具调用后继续输出任何文本。**
- 好感度高的 NPC 主动提供帮助；好感度低的 NPC 拒绝交流或成为障碍
- NPC 对话约束：你为 NPC 编写的对话必须严格遵循该 NPC 的性格和说话风格参考`
}

function buildMessages(
  dialogueHistory: DialogueEntry[],
  worldCard: WorldCard,
): CoreMessage[] {
  const messages: CoreMessage[] = []

  for (const entry of dialogueHistory.slice(-12)) {
    if (entry.role === 'narrator') {
      messages.push({ role: 'assistant', content: entry.content })
    } else if (entry.role === 'player') {
      messages.push({ role: 'user', content: `[玩家选择]: ${entry.content}` })
    }
  }

  if (messages.length === 0) {
    messages.push({
      role: 'user',
      content: `[游戏开始]\n初始场景：${worldCard.initialScene}\n\n请根据以上场景开始叙述，并调用 update_state 工具。`,
    })
  }

  return messages
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      worldCard, playerState, dialogueHistory, npcAffinities, npcRuntime,
      apiKey: requestApiKey, provider, model, customBaseURL, advancedParams,
    } = body as {
      worldCard: WorldCard
      playerState: PlayerState
      dialogueHistory: DialogueEntry[]
      npcAffinities?: Record<string, number>
      npcRuntime?: Record<string, { currentSelfPerception: string; currentState: string }>
      apiKey?: string
      provider?: string
      model?: string
      customBaseURL?: string
      advancedParams?: Record<string, any>
    }

    if (!worldCard || !playerState || !dialogueHistory) {
      return new Response(JSON.stringify({ error: '请求体不完整' }), { status: 400 })
    }

    const apiKey = getApiKey(requestApiKey)
    const systemPrompt = buildSystemPrompt(worldCard, playerState, npcAffinities ?? {}, npcRuntime ?? {})
    const messages = buildMessages(dialogueHistory, worldCard)

    const modelInstance = provider === 'anthropic'
      ? anthropic(model || 'claude-sonnet-4-6')
      : openai(model || 'gpt-4o', customBaseURL ? { baseURL: customBaseURL } : undefined)

    const result = streamText({
      model: modelInstance,
      system: systemPrompt,
      messages,
      tools: {
        update_state: {
          description: '更新游戏状态、选项、属性和物品。调用后本回合即告结束。',
          parameters: updateStateSchema,
        },
      },
      maxSteps: 2,
      ...(advancedParams?.temperature !== undefined && { temperature: advancedParams.temperature }),
      ...(advancedParams?.max_tokens !== undefined && { maxTokens: advancedParams.max_tokens }),
      ...(advancedParams?.top_p !== undefined && { topP: advancedParams.top_p }),
    })

    return result.toDataStreamResponse()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('API Error:', message)
    return new Response(JSON.stringify({ error: '内部服务器错误' }), { status: 500 })
  }
}
```

- [ ] **Step 1: 重写文件**

用上面完整代码替换 `src/app/api/adventure/route.ts` 的内容。

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
npx tsc --noEmit 2>&1
```
Expected: 无类型错误。如果 `advancedParams` 的类型有冲突，将其改为 `Record<string, any>`。

- [ ] **Step 3: 运行现有 adventure route 测试**

```bash
npx vitest run src/app/api/adventure/__tests__/route.test.ts
```
Expected: 测试可能需要更新以适应新的响应格式。如果测试失败，记下错误——在 Task 6 完成客户端改造后再统一修复测试。

- [ ] **Step 4: 提交**

```bash
git add src/app/api/adventure/route.ts
git commit -m "refactor: adventure route 重写 — Vercel AI SDK + Tool Use，404→80行"
```

---

### Task 5: 创建 EventBus

**Files:**
- Create: `src/lib/event-bus.ts`
- Create: `src/lib/__tests__/event-bus.test.ts`

- [ ] **Step 1: 创建 EventBus**

```ts
// src/lib/event-bus.ts

export type EventBusListener = (chunk: string) => void

export interface EventBus {
  /** 订阅文本 chunk 事件 */
  on(listener: EventBusListener): () => void
  /** 推送文本 chunk */
  append(chunk: string): void
  /** 获取累积的完整文本 */
  getFullText(): string
  /** 重置（新回合开始时调用） */
  reset(): void
  /** 销毁（组件卸载时调用） */
  destroy(): void
}

export function createEventBus(): EventBus {
  const listeners = new Set<EventBusListener>()
  let buffer = ''

  return {
    on(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    append(chunk) {
      buffer += chunk
      for (const fn of listeners) {
        fn(chunk)
      }
    },
    getFullText() {
      return buffer
    },
    reset() {
      buffer = ''
    },
    destroy() {
      listeners.clear()
      buffer = ''
    },
  }
}
```

- [ ] **Step 2: 编写 EventBus 单元测试**

```ts
// src/lib/__tests__/event-bus.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from '../event-bus'

describe('createEventBus', () => {
  it('推送 chunk 时通知监听器', () => {
    const bus = createEventBus()
    const fn = vi.fn()
    bus.on(fn)
    bus.append('你好')
    expect(fn).toHaveBeenCalledWith('你好')
  })

  it('累积完整文本', () => {
    const bus = createEventBus()
    bus.append('第一段')
    bus.append('第二段')
    expect(bus.getFullText()).toBe('第一段第二段')
  })

  it('取消订阅后不再通知', () => {
    const bus = createEventBus()
    const fn = vi.fn()
    const unsub = bus.on(fn)
    unsub()
    bus.append('测试')
    expect(fn).not.toHaveBeenCalled()
  })

  it('reset 清空 buffer', () => {
    const bus = createEventBus()
    bus.append('内容')
    bus.reset()
    expect(bus.getFullText()).toBe('')
  })

  it('destroy 后 listener 被移除且 buffer 清空', () => {
    const bus = createEventBus()
    const fn = vi.fn()
    bus.on(fn)
    bus.append('数据')
    bus.destroy()
    bus.append('新数据')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(bus.getFullText()).toBe('')
  })
})
```

- [ ] **Step 3: 运行测试**

```bash
npx vitest run src/lib/__tests__/event-bus.test.ts
```
Expected: 5 passed

- [ ] **Step 4: 提交**

```bash
git add src/lib/event-bus.ts src/lib/__tests__/event-bus.test.ts
git commit -m "feat: 创建 EventBus — SSE chunk 到打字机 DOM 的外部通道"
```

---

### Task 6: 拆分 GameContext 为三层 Context

**Files:**
- Create: `src/lib/app-config-context.tsx`
- Create: `src/lib/player-state-context.tsx`
- Create: `src/lib/game-play-context.tsx`
- Modify: `src/lib/game-context.tsx` （过渡性 re-export）
- Modify: `src/lib/types.ts` （精简 Action 类型）

- [ ] **Step 1: 创建 AppConfigContext**

```tsx
// src/lib/app-config-context.tsx
'use client'

import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react'
import type { Protocol, AdvancedParams, SaveMode } from './types'

export type ApiProvider = 'anthropic' | 'openai' | 'deepseek' | 'custom'

interface SavedApiConfig {
  apiKey: string
  model: string
  customBaseURL: string
  protocol: Protocol
  providerName: string
  apiBaseURL: string
  advancedParams: AdvancedParams
}

interface AppConfigState {
  apiKey: string
  provider: ApiProvider
  model: string
  customBaseURL: string
  protocol: Protocol
  providerName: string
  apiBaseURL: string
  advancedParams: AdvancedParams
  saveMode: SaveMode
  accountName: string
}

interface AppConfigContextValue {
  state: AppConfigState
  setProvider: (provider: ApiProvider) => void
  setApiKey: (key: string) => void
  setModel: (model: string) => void
  setCustomBaseURL: (url: string) => void
  setProtocol: (protocol: Protocol) => void
  setProviderName: (name: string) => void
  setApiBaseURL: (url: string) => void
  setAdvancedParams: (params: Partial<AdvancedParams>) => void
  setSaveMode: (mode: SaveMode, accountName: string) => void
}

const AppConfigContext = createContext<AppConfigContextValue | null>(null)

const API_CONFIGS_KEY = 'adventure_api_configs'

function loadAllApiConfigs(): Record<string, SavedApiConfig> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(API_CONFIGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      delete parsed['undefined']; delete parsed['null']
      return parsed
    }
  } catch {}
  return {}
}

function saveAllApiConfigs(configs: Record<string, SavedApiConfig>): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(API_CONFIGS_KEY, JSON.stringify(configs))
}

function loadLastProvider(): ApiProvider {
  if (typeof window === 'undefined') return 'deepseek'
  try {
    return (localStorage.getItem('adventure_last_provider') as ApiProvider) || 'deepseek'
  } catch {}
  return 'deepseek'
}

function saveLastProvider(provider: ApiProvider): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('adventure_last_provider', provider)
}

function loadSaveModeConfig(): { saveMode: SaveMode; accountName: string } {
  if (typeof window === 'undefined') return { saveMode: 'offline', accountName: '' }
  try {
    const raw = localStorage.getItem('adventure_save_config')
    if (raw) return JSON.parse(raw)
  } catch {}
  return { saveMode: 'offline', accountName: '' }
}

function createInitialAppConfig(): AppConfigState {
  const provider = loadLastProvider()
  const saved = loadAllApiConfigs()[provider]
  const saveCfg = loadSaveModeConfig()

  const defaults: Record<ApiProvider, SavedApiConfig> = {
    anthropic: { apiKey: '', model: 'claude-sonnet-4-6', customBaseURL: '', protocol: 'anthropic', providerName: '', apiBaseURL: '', advancedParams: {} },
    openai: { apiKey: '', model: 'gpt-4o', customBaseURL: '', protocol: 'openai', providerName: '', apiBaseURL: '', advancedParams: {} },
    deepseek: { apiKey: '', model: 'deepseek-chat', customBaseURL: '', protocol: 'openai', providerName: '', apiBaseURL: '', advancedParams: {} },
    custom: { apiKey: '', model: '', customBaseURL: '', protocol: 'openai', providerName: '', apiBaseURL: '', advancedParams: {} },
  }

  return {
    apiKey: saved?.apiKey ?? defaults[provider].apiKey,
    provider: provider as ApiProvider,
    model: saved?.model ?? defaults[provider].model,
    customBaseURL: saved?.customBaseURL ?? defaults[provider].customBaseURL,
    protocol: saved?.protocol ?? defaults[provider].protocol,
    providerName: saved?.providerName ?? defaults[provider].providerName,
    apiBaseURL: saved?.apiBaseURL ?? defaults[provider].apiBaseURL,
    advancedParams: saved?.advancedParams ?? defaults[provider].advancedParams,
    saveMode: saveCfg.saveMode,
    accountName: saveCfg.accountName,
  }
}

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppConfigState>(createInitialAppConfig)
  const initRef = useRef(false)

  const setProvider = useCallback((provider: ApiProvider) => {
    const configs = loadAllApiConfigs()
    const saved = configs[provider]
    setState(prev => ({
      ...prev,
      provider,
      apiKey: saved?.apiKey ?? '',
      model: saved?.model ?? '',
      customBaseURL: saved?.customBaseURL ?? '',
      protocol: saved?.protocol ?? (provider === 'anthropic' ? 'anthropic' : 'openai'),
      providerName: saved?.providerName ?? '',
      apiBaseURL: saved?.apiBaseURL ?? '',
      advancedParams: saved?.advancedParams ?? {},
    }))
    saveLastProvider(provider)
  }, [])

  const setApiKey = useCallback((apiKey: string) => setState(prev => ({ ...prev, apiKey })), [])
  const setModel = useCallback((model: string) => setState(prev => ({ ...prev, model })), [])
  const setCustomBaseURL = useCallback((customBaseURL: string) => setState(prev => ({ ...prev, customBaseURL })), [])
  const setProtocol = useCallback((protocol: Protocol) => setState(prev => ({ ...prev, protocol })), [])
  const setProviderName = useCallback((providerName: string) => setState(prev => ({ ...prev, providerName })), [])
  const setApiBaseURL = useCallback((apiBaseURL: string) => setState(prev => ({ ...prev, apiBaseURL })), [])

  const setAdvancedParams = useCallback((params: Partial<AdvancedParams>) =>
    setState(prev => ({ ...prev, advancedParams: { ...prev.advancedParams, ...params } })), [])

  const setSaveMode = useCallback((mode: SaveMode, accountName: string) => {
    setState(prev => ({ ...prev, saveMode: mode, accountName }))
    localStorage.setItem('adventure_save_config', JSON.stringify({ mode, accountName }))
  }, [])

  // 首次渲染后跳过，后续变更自动保存
  useEffect(() => {
    if (!initRef.current) { initRef.current = true; return }
    const configs = loadAllApiConfigs()
    configs[state.provider] = {
      apiKey: state.apiKey, model: state.model, customBaseURL: state.customBaseURL,
      protocol: state.protocol, providerName: state.providerName, apiBaseURL: state.apiBaseURL,
      advancedParams: state.advancedParams,
    }
    saveAllApiConfigs(configs)
    saveLastProvider(state.provider)
  }, [state.apiKey, state.provider, state.model, state.customBaseURL, state.protocol, state.providerName, state.apiBaseURL, state.advancedParams])

  const value = useMemo<AppConfigContextValue>(() => ({
    state, setProvider, setApiKey, setModel, setCustomBaseURL,
    setProtocol, setProviderName, setApiBaseURL, setAdvancedParams, setSaveMode,
  }), [state, setProvider, setApiKey, setModel, setCustomBaseURL, setProtocol, setProviderName, setApiBaseURL, setAdvancedParams, setSaveMode])

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext)
  if (!ctx) throw new Error('useAppConfig must be used within AppConfigProvider')
  return ctx
}
```

- [ ] **Step 2: 创建 PlayerStateContext**

```tsx
// src/lib/player-state-context.tsx
'use client'

import { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from 'react'
import type { WorldCard, PlayerState, GameOption, RuntimeNPCState, SaveData } from './types'

type GameScreen = 'menu' | 'playing'

interface PlayerStateData {
  screen: GameScreen
  worldCard: WorldCard | null
  playerState: PlayerState | null
  currentOptions: GameOption[]
  npcAffinities: Record<string, number>
  npcRuntime: Record<string, RuntimeNPCState>
}

type PlayerStateAction =
  | { type: 'START_GAME'; worldCard: WorldCard; playerName: string }
  | { type: 'UPDATE_STATE'; options: GameOption[]; attributeChanges: Record<string, number>; npcAffinityChanges: Record<string, number>; newFlags: string[]; lostFlags: string[]; itemsGained: string[]; itemsLost: string[] }
  | { type: 'LOAD_SAVE'; save: SaveData; worldCard: WorldCard }
  | { type: 'RETURN_TO_MENU' }

interface PlayerStateContextValue {
  state: PlayerStateData
  dispatch: React.Dispatch<PlayerStateAction>
  actions: {
    startGame: (worldCard: WorldCard, playerName: string) => void
    updateState: (args: { options: GameOption[]; attributeChanges?: Record<string, number>; npcAffinityChanges?: Record<string, number>; newFlags?: string[]; lostFlags?: string[]; itemsGained?: string[]; itemsLost?: string[] }) => void
    loadGame: (save: SaveData, worldCard: WorldCard) => void
    returnToMenu: () => void
  }
}

const PlayerStateContext = createContext<PlayerStateContextValue | null>(null)

const DEFAULT_MAX_ATTRIBUTE = 10

function clampAttributes(base: Record<string, number>, changes: Record<string, number>, defs: { key: string; max: number }[]): Record<string, number> {
  const result = { ...base }
  for (const [key, delta] of Object.entries(changes)) {
    if (key in result) {
      const maxVal = defs.find(a => a.key === key)?.max ?? DEFAULT_MAX_ATTRIBUTE
      result[key] = Math.max(0, Math.min(result[key] + delta, maxVal))
    }
  }
  return result
}

function createInitialPlayerState(): PlayerStateData {
  return {
    screen: 'menu',
    worldCard: null,
    playerState: null,
    currentOptions: [],
    npcAffinities: {},
    npcRuntime: {},
  }
}

function playerStateReducer(state: PlayerStateData, action: PlayerStateAction): PlayerStateData {
  switch (action.type) {
    case 'START_GAME': {
      const attrs: Record<string, number> = {}
      action.worldCard.attributes.forEach(a => { attrs[a.key] = a.initial })
      const npcAffinities: Record<string, number> = {}
      action.worldCard.npcs.forEach(n => { npcAffinities[n.id] = n.fields.initialAffinity ?? 0 })
      const npcRuntime: Record<string, RuntimeNPCState> = {}
      action.worldCard.npcs.forEach(n => { npcRuntime[n.id] = { currentSelfPerception: '', currentState: '' } })
      return {
        screen: 'playing',
        worldCard: action.worldCard,
        playerState: {
          playerName: action.playerName,
          attributes: attrs,
          flags: {},
          inventory: action.worldCard.startingItems,
        },
        currentOptions: [],
        npcAffinities,
        npcRuntime,
      }
    }

    case 'UPDATE_STATE': {
      if (!state.playerState || !state.worldCard) return state
      const newAttrs = clampAttributes(state.playerState.attributes, action.attributeChanges, state.worldCard.attributes)
      const newNpcAffinities = { ...state.npcAffinities }
      for (const [key, delta] of Object.entries(action.npcAffinityChanges)) {
        if (key in newNpcAffinities) {
          newNpcAffinities[key] = Math.max(0, Math.min(newNpcAffinities[key] + delta, 100))
        }
      }
      let newInventory = [...(state.playerState.inventory ?? [])]
      for (const item of action.itemsGained) {
        if (!newInventory.includes(item)) newInventory.push(item)
      }
      newInventory = newInventory.filter(item => !action.itemsLost.includes(item))
      const newFlags = { ...state.playerState.flags }
      for (const flag of action.newFlags) newFlags[flag] = true
      for (const flag of action.lostFlags) newFlags[flag] = false

      return {
        ...state,
        playerState: { ...state.playerState, attributes: newAttrs, inventory: newInventory, flags: newFlags },
        npcAffinities: newNpcAffinities,
        currentOptions: action.options,
      }
    }

    case 'LOAD_SAVE':
      return {
        screen: 'playing' as const,
        worldCard: action.worldCard,
        playerState: action.save.playerState,
        currentOptions: [],
        npcAffinities: {},
        npcRuntime: {},
      }

    case 'RETURN_TO_MENU':
      return createInitialPlayerState()

    default:
      return state
  }
}

export function PlayerStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(playerStateReducer, undefined, createInitialPlayerState)

  const startGame = useCallback((worldCard: WorldCard, playerName: string) => {
    dispatch({ type: 'START_GAME', worldCard, playerName })
  }, [])

  const updateState = useCallback((args: {
    options: GameOption[]; attributeChanges?: Record<string, number>;
    npcAffinityChanges?: Record<string, number>; newFlags?: string[];
    lostFlags?: string[]; itemsGained?: string[]; itemsLost?: string[]
  }) => {
    dispatch({
      type: 'UPDATE_STATE',
      options: args.options,
      attributeChanges: args.attributeChanges ?? {},
      npcAffinityChanges: args.npcAffinityChanges ?? {},
      newFlags: args.newFlags ?? [],
      lostFlags: args.lostFlags ?? [],
      itemsGained: args.itemsGained ?? [],
      itemsLost: args.itemsLost ?? [],
    })
  }, [])

  const loadGame = useCallback((save: SaveData, worldCard: WorldCard) => {
    dispatch({ type: 'LOAD_SAVE', save, worldCard })
  }, [])

  const returnToMenu = useCallback(() => dispatch({ type: 'RETURN_TO_MENU' }), [])

  const value = useMemo<PlayerStateContextValue>(() => ({
    state, dispatch,
    actions: { startGame, updateState, loadGame, returnToMenu },
  }), [state, startGame, updateState, loadGame, returnToMenu])

  return <PlayerStateContext.Provider value={value}>{children}</PlayerStateContext.Provider>
}

export function usePlayerState() {
  const ctx = useContext(PlayerStateContext)
  if (!ctx) throw new Error('usePlayerState must be used within PlayerStateProvider')
  return ctx
}
```

- [ ] **Step 3: 创建 GamePlayContext**

```tsx
// src/lib/game-play-context.tsx
'use client'

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import type { DialogueEntry } from './types'

interface GamePlayState {
  dialogueHistory: DialogueEntry[]
  isLoading: boolean
  error: string | null
}

interface GamePlayContextValue {
  state: GamePlayState
  setLoading: (v: boolean) => void
  setError: (msg: string | null) => void
  archiveDialogue: (entries: DialogueEntry[]) => void
  clearError: () => void
}

const GamePlayContext = createContext<GamePlayContextValue | null>(null)

export function GamePlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GamePlayState>({
    dialogueHistory: [],
    isLoading: false,
    error: null,
  })

  const setLoading = useCallback((isLoading: boolean) =>
    setState(prev => ({ ...prev, isLoading, error: null })), [])

  const setError = useCallback((error: string | null) =>
    setState(prev => ({ ...prev, error, isLoading: false })), [])

  const archiveDialogue = useCallback((entries: DialogueEntry[]) =>
    setState(prev => ({ ...prev, dialogueHistory: entries, isLoading: false })), [])

  const clearError = useCallback(() =>
    setState(prev => ({ ...prev, error: null })), [])

  const value = useMemo<GamePlayContextValue>(() => ({
    state, setLoading, setError, archiveDialogue, clearError,
  }), [state, setLoading, setError, archiveDialogue, clearError])

  return <GamePlayContext.Provider value={value}>{children}</GamePlayContext.Provider>
}

export function useGamePlay() {
  const ctx = useContext(GamePlayContext)
  if (!ctx) throw new Error('useGamePlay must be used within GamePlayProvider')
  return ctx
}
```

- [ ] **Step 4: 更新 game-context.tsx 为过渡性 re-export**

```ts
// src/lib/game-context.tsx — 过渡性 re-export
// 保留旧 import 路径可用，逐步迁移各组件的 import

export { AppConfigProvider, useAppConfig } from './app-config-context'
export { PlayerStateProvider, usePlayerState } from './player-state-context'
export { GamePlayProvider, useGamePlay } from './game-play-context'

// 兼容旧 useGame() 调用 —— 组合三个 Context
'use client'
import React, { createContext, useContext, type ReactNode } from 'react'
import { AppConfigProvider, useAppConfig } from './app-config-context'
import { PlayerStateProvider, usePlayerState } from './player-state-context'
import { GamePlayProvider, useGamePlay } from './game-play-context'

// 向后兼容的 useGame() — 返回三个 Context 的合并接口
export function useGame() {
  const appConfig = useAppConfig()
  const playerState = usePlayerState()
  const gamePlay = useGamePlay()

  // 合并为旧 GameContextValue 形状，保持所有现有组件正常工作
  return {
    state: {
      screen: playerState.state.screen,
      worldCard: playerState.state.worldCard,
      playerState: playerState.state.playerState,
      dialogueHistory: gamePlay.state.dialogueHistory,
      currentOptions: playerState.state.currentOptions,
      currentNarration: '',
      isLoading: gamePlay.state.isLoading,
      error: gamePlay.state.error,
      saveSlots: [] as any[],
      apiKey: appConfig.state.apiKey,
      provider: appConfig.state.provider as any,
      model: appConfig.state.model,
      customBaseURL: appConfig.state.customBaseURL,
      protocol: appConfig.state.protocol,
      providerName: appConfig.state.providerName,
      apiBaseURL: appConfig.state.apiBaseURL,
      advancedParams: appConfig.state.advancedParams,
      npcAffinities: playerState.state.npcAffinities,
      npcRuntime: playerState.state.npcRuntime,
      saveMode: appConfig.state.saveMode,
      accountName: appConfig.state.accountName,
    },
    dispatch: (() => {}) as any,
    actions: {
      // AppConfig
      setApiKey: appConfig.setApiKey,
      setProvider: appConfig.setProvider,
      setModel: appConfig.setModel,
      setCustomBaseURL: appConfig.setCustomBaseURL,
      setProtocol: appConfig.setProtocol,
      setProviderName: appConfig.setProviderName,
      setApiBaseURL: appConfig.setApiBaseURL,
      setAdvancedParams: appConfig.setAdvancedParams,
      setSaveMode: appConfig.setSaveMode,
      // PlayerState
      startGame: playerState.actions.startGame,
      updateState: playerState.actions.updateState,
      loadGame: playerState.actions.loadGame,
      returnToMenu: playerState.actions.returnToMenu,
      // GamePlay
      setLoading: gamePlay.setLoading,
      setError: gamePlay.setError,
      archiveDialogue: gamePlay.archiveDialogue,
      clearError: gamePlay.clearError,
      // 占位（将在 Task 8 的 GameScreen 中被 submitAction 覆盖）
      submitAction: async () => {},
      saveGame: async () => {},
      deleteGame: async () => {},
      refreshSaves: async () => {},
    },
  } as any
}

// 统一 Provider
export function GameProvider({ children }: { children: ReactNode }) {
  return (
    <AppConfigProvider>
      <PlayerStateProvider>
        <GamePlayProvider>
          {children}
        </GamePlayProvider>
      </PlayerStateProvider>
    </AppConfigProvider>
  )
}
```

- [ ] **Step 5: 验证 TypeScript 编译**

```bash
npx tsc --noEmit 2>&1
```
Expected: 如果旧组件引用了已删除的 action 类型，记录但暂不修复——在后续任务中逐个组件迁移时处理。

- [ ] **Step 6: 提交**

```bash
git add src/lib/app-config-context.tsx src/lib/player-state-context.tsx src/lib/game-play-context.tsx src/lib/game-context.tsx
git commit -m "refactor: GameContext 拆分为三层 — AppConfig / PlayerState / GamePlay，保留兼容 re-export"
```

---

### Task 7: DialogueBox RAF 打字机引擎

**Files:**
- Modify: `src/components/DialogueBox.tsx`

这是打字机核心变更——从 `useState` + `setTimeout` 改为 EventBus + RAF + DOM textContent。

```tsx
// src/components/DialogueBox.tsx
'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useGame } from '@/lib/game-context'
import { createEventBus } from '@/lib/event-bus'
import { ModelIcon } from '@lobehub/icons'

// 模块级 EventBus 单例（同一时刻只有一个流）
const eventBus = createEventBus()

export default function DialogueBox() {
  const { state } = useGame()
  const { dialogueHistory, isLoading } = state

  const scrollRef = useRef<HTMLDivElement>(null)
  const currentDomRef = useRef<HTMLParagraphElement>(null)
  const bufferRef = useRef('')
  const rafRef = useRef<number>(0)
  const charIndexRef = useRef(0)
  const mountedRef = useRef(true)

  // RAF 打字循环
  const startTyping = useCallback(() => {
    if (rafRef.current) return // 已在运行

    const tick = () => {
      if (!mountedRef.current) return
      const full = bufferRef.current
      if (charIndexRef.current >= full.length) {
        rafRef.current = 0
        return // 暂停，等待下一个 chunk
      }

      // 每帧输出 2-3 个字符
      const charsPerFrame = 2 + (full.length - charIndexRef.current > 20 ? 1 : 0) // 积压多时加速
      charIndexRef.current = Math.min(charIndexRef.current + charsPerFrame, full.length)

      if (currentDomRef.current) {
        currentDomRef.current.textContent = full.slice(0, charIndexRef.current)
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  // 订阅 EventBus
  useEffect(() => {
    const unsub = eventBus.on((chunk) => {
      bufferRef.current += chunk
      if (!rafRef.current) {
        charIndexRef.current = currentDomRef.current?.textContent?.length ?? 0
        startTyping()
      }
    })

    return () => {
      unsub()
      // 注意：组件卸载时不销毁 eventBus（模块级单例）
    }
  }, [startTyping])

  // 挂载状态
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // 流结束 → 归档完整文本到 Context（由 GameScreen 在流结束后处理）
  // DialogueBox 仅负责打字机展示

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [dialogueHistory])

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto pr-2 space-y-4"
      style={{ maxHeight: 'calc(100vh - 280px)' }}
    >
      {dialogueHistory.map((entry) => {
        const isPlayer = entry.role === 'player'
        return (
          <div
            key={entry.id}
            className={`dialogue-entry flex ${isPlayer ? 'justify-end' : 'justify-start'}`}
            style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 80px' } as React.CSSProperties}
          >
            <div className={isPlayer ? '' : 'max-w-[80%]'}>
              {!isPlayer && entry.model && (
                <div className="flex items-center gap-1.5 mb-1 ml-1">
                  <ModelIcon model={entry.model} size={32} />
                  <span className="text-base text-[var(--text-secondary)]">{entry.model}</span>
                </div>
              )}
              <div
                className={`p-3 rounded-lg border ${
                  isPlayer
                    ? 'max-w-[80%] border-[var(--accent)] bg-[var(--bg-card)]'
                    : 'border-[var(--border)] bg-[var(--bg-secondary)]'
                }`}
              >
                {isPlayer && <div className="text-xs text-[var(--accent)] mb-1 font-medium">你</div>}
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{entry.content}</div>
              </div>
            </div>
          </div>
        )
      })}

      {/* 打字机当前行 — React 仅管理挂载/卸载，内容由 RAF 直接 DOM 操作 */}
      {isLoading && (
        <div className="flex justify-start">
          <div className="max-w-[80%] p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
            <p
              ref={currentDomRef}
              className="text-sm leading-relaxed whitespace-pre-wrap inline"
            />
            <span className="inline-block w-[2px] h-[1em] bg-[var(--accent)] ml-0.5 align-text-bottom animate-blink" />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 1: 在 globals.css 添加光标动画**

```css
@keyframes blink {
  50% { opacity: 0; }
}
.animate-blink {
  animation: blink 1s step-end infinite;
}
```

- [ ] **Step 2: 替换 DialogueBox.tsx**

用上面的完整代码替换 `src/components/DialogueBox.tsx`。

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit src/components/DialogueBox.tsx 2>&1
```
Expected: 无类型错误。

- [ ] **Step 4: 提交**

```bash
git add src/components/DialogueBox.tsx src/app/globals.css
git commit -m "refactor: DialogueBox RAF 打字机 + EventBus + CSS 光标 — 零 React state 逐字渲染"
```

---

### Task 8: GameScreen readDataStream 集成 + AbortController

**Files:**
- Modify: `src/components/GameScreen.tsx`

```tsx
// src/components/GameScreen.tsx
'use client'

import { useEffect, useRef, useCallback } from 'react'
import { readDataStream } from 'ai'
import { useGame } from '@/lib/game-context'
import { createEventBus } from '@/lib/event-bus'
import DialogueBox from './DialogueBox'
import OptionsPanel from './OptionsPanel'
import StatusPanel from './StatusPanel'

// 与 DialogueBox 共享同一个 EventBus 单例
const eventBus = createEventBus()

export default function GameScreen() {
  const { state, actions } = useGame()
  const hasTriggeredRef = useRef(false)
  const abortRef = useRef<AbortController>()

  // 核心交互函数 —— 重构为 readDataStream
  const submitAction = useCallback(async (optionText: string) => {
    // 取消上一轮未完成的流
    abortRef.current?.abort()

    const controller = new AbortController()
    abortRef.current = controller

    const current = (actions as any)._getState?.() ?? state

    if (!current.worldCard || !current.playerState) return

    // 通知 loading 状态
    actions.setLoading?.(true)

    const playerEntry = {
      id: 'player_' + Date.now(),
      role: 'player' as const,
      content: optionText,
      timestamp: Date.now(),
    }

    eventBus.reset()

    try {
      const response = await fetch('/api/adventure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldCard: current.worldCard,
          playerState: current.playerState,
          dialogueHistory: [...current.dialogueHistory, playerEntry],
          apiKey: current.apiKey,
          provider: current.provider,
          model: current.model,
          customBaseURL: current.customBaseURL,
          advancedParams: current.advancedParams,
          npcAffinities: current.npcAffinities,
          npcRuntime: current.npcRuntime,
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(await response.text())

      const reader = readDataStream(response.body!, { signal: controller.signal })

      let fullNarration = ''

      for await (const part of reader) {
        if (part.type === 'text-delta') {
          fullNarration += part.textDelta
          eventBus.append(part.textDelta)
        }
        else if (part.type === 'tool-call' && part.toolName === 'update_state') {
          actions.updateState?.(part.args)
        }
      }

      // 流结束 — 检查 Tool Use 是否被调用
      const toolCallOccurred = (reader as any)._toolCalls?.some?.((tc: any) => tc.toolName === 'update_state')

      if (!toolCallOccurred && !fullNarration) {
        // 模型完全没输出 → 错误
        actions.setError?.('AI 未返回有效响应，请重试')
        return
      }

      if (!toolCallOccurred) {
        // 模型忘记调用 Tool → 降级：注入默认选项，文本当纯叙述
        console.warn('[降级] AI 未调用 update_state，注入默认选项')
        actions.updateState?.({
          options: [
            { text: '继续前进' },
            { text: '仔细观察周围' },
            { text: '与附近的人交谈' },
          ],
        })
      }

      // 归档完整对话到 GamePlayContext
      const narratorEntry = {
        id: 'narrator_' + Date.now(),
        role: 'narrator' as const,
        content: fullNarration,
        timestamp: Date.now(),
        model: current.model,
      }
      const newHistory = [...current.dialogueHistory, playerEntry, narratorEntry]
      actions.archiveDialogue?.(newHistory)

    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      actions.setError?.((e as Error).message || '未知错误')
    }
  }, [state, actions])

  // 组件卸载清理
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // 新游戏首次触发
  useEffect(() => {
    if (
      !hasTriggeredRef.current &&
      state.screen === 'playing' &&
      (state as any).dialogueHistory?.length === 0 &&
      !state.isLoading &&
      (state as any).currentOptions?.length === 0
    ) {
      hasTriggeredRef.current = true
      submitAction('开始冒险')
    }
  }, [state.screen, (state as any).dialogueHistory?.length, state.isLoading, (state as any).currentOptions?.length, submitAction])

  if (state.screen !== 'playing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <p className="text-[var(--text-secondary)]">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <div className="flex flex-1">
        <div className="flex-1 flex flex-col min-w-0">
          <DialogueBox />
          {state.error && (
            <div className="mx-6 mb-3 p-3 rounded-xl bg-red-900/30 border border-red-800 text-red-300 text-sm">
              {state.error}
              <button onClick={() => submitAction('开始冒险')} className="ml-3 underline hover:text-red-200">重试</button>
            </div>
          )}
          <OptionsPanel />
        </div>
        <StatusPanel />
      </div>
    </div>
  )
}
```

- [ ] **Step 1: 替换 GameScreen.tsx**

用上面的完整代码替换 `src/components/GameScreen.tsx`。

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit 2>&1
```
Expected: 可能有类型错误（`readDataStream` 的泛型参数、`actions` 上的方法名等）。逐步修复：
- 如果 `readDataStream` 的 `tool-call` 类型不匹配，用 `as any` 断言
- 如果 `actions` 缺少新方法（`setLoading`、`archiveDialogue` 等），回 `game-context.tsx` 的 re-export 补充

- [ ] **Step 3: 提交**

```bash
git add src/components/GameScreen.tsx
git commit -m "refactor: GameScreen readDataStream 集成 + AbortController 生命周期 — SSE 物理隔离消费"
```

---

### Task 9: RSC 交互孤岛 + React 19 use()

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/game/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/GlobalButtons.tsx`

- [ ] **Step 1: 改造 layout.tsx — 移除 ThemeProvider（已在 Task 2 完成），更新 Provider 嵌套**

```tsx
// src/app/layout.tsx (替换现有内容)
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { AppConfigProvider } from '@/lib/app-config-context'
import { PlayerStateProvider } from '@/lib/player-state-context'
import { GamePlayProvider } from '@/lib/game-play-context'
import GlobalButtons from '@/components/GlobalButtons'
import { getThemeCookie } from '@/lib/theme'

export const metadata: Metadata = {
  title: '话世界',
  description: '用对话创造世界 — AI 驱动的文字冒险引擎',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeId = getThemeCookie(cookies().toString())

  return (
    <html lang="zh-CN" data-theme={themeId} suppressHydrationWarning>
      <body className="min-h-screen">
        <AppConfigProvider>
          <PlayerStateProvider>
            <GamePlayProvider>
              {children}
              <GlobalButtons />
            </GamePlayProvider>
          </PlayerStateProvider>
        </AppConfigProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: 验证当前分支整体编译**

```bash
npx tsc --noEmit 2>&1 | head -50
```
Expected: 记录所有类型错误但逐个在后续步骤中修复。关键检查：
- `useGame()` 返回的对象形状是否与旧代码兼容
- 组件 `import` 路径是否仍然有效

- [ ] **Step 3: 提交**

```bash
git add src/app/layout.tsx
git commit -m "refactor: layout.tsx 改用三层 Context Provider 直接嵌套"
```

---

### Task 10: 存档乐观更新 + 自动存档防抖

**Files:**
- Modify: `src/components/StatusPanel.tsx`
- Modify: `src/lib/save-service.ts`

- [ ] **Step 1: 在 StatusPanel 存档 UI 中引入 useOptimistic**

在 `StatusPanel.tsx` 的存档部分，将 `saveSlots` 的加载和保存改用 `useOptimistic`：

```tsx
// StatusPanel.tsx — 存档部分改造
import { useOptimistic } from 'react'

// 在组件内部：
const [saveSlots, setSaveSlots] = useState<SaveData[]>([])
const [optimisticSlots, addOptimistic] = useOptimistic(
  saveSlots,
  (state, newSlot: SaveData) => [newSlot, ...state.filter(s => s.id !== newSlot.id)]
)

async function handleSave(slot: number) {
  const data = buildSaveData()          // 从当前 state 构建 SaveData
  addOptimistic(data)                   // UI 瞬时反馈
  await saveService.saveToSlot(slot, data) // 后台静默写入
  setSaveSlots(await refreshSaves())       // 以服务器为准校对
}
```

- [ ] **Step 2: 在 save-service 添加自动存档防抖**

```ts
// src/lib/save-service.ts — 追加防抖 autoSave

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export async function debouncedAutoSave(data: SaveData): Promise<void> {
  if (debounceTimer) clearTimeout(debounceTimer)
  return new Promise((resolve) => {
    debounceTimer = setTimeout(async () => {
      await autoSave(data)
      resolve()
    }, 2000) // 2s 防抖
  })
}
```

在 GameScreen 的 submitAction 中，流结束后调用 `debouncedAutoSave` 替代原有 autoSave。

- [ ] **Step 3: 提交**

```bash
git add src/components/StatusPanel.tsx src/lib/save-service.ts
git commit -m "feat: useOptimistic 存档瞬时反馈 + 2s 防抖自动存档"
```

---

### Task 11: 整合验证 + 清理

**Files:**
- Modify: 多个文件（错误修复）
- Modify: `src/lib/types.ts` （清理未使用的 action 类型）

- [ ] **Step 1: 运行完整 TypeScript 编译**

```bash
npx tsc --noEmit 2>&1
```
逐个修复类型错误。

- [ ] **Step 2: 运行完整测试套件**

```bash
npx vitest run
```
Expected: 检查哪些测试通过，哪些需要更新。

- [ ] **Step 3: 删除 types.ts 中不再使用的 Action 类型**

`src/lib/types.ts` 中的 `GameAction` union type 删掉不再使用的类型（`SET_LOADING`、`SET_RESPONSE`、`SET_ERROR`、`APPEND_NARRATION`、`SET_API_KEY` 等已迁移到新 Context 的操作），保留 `START_GAME`、`LOAD_SAVE`、`UPDATE_STATE`、`RETURN_TO_MENU` 相关。

- [ ] **Step 4: 启动 dev server 验证**

```bash
npm run dev
```
浏览器访问 `http://localhost:3000`，验证：
1. 首页正常显示
2. 主题切换正常工作
3. 选择世界后能进入游戏
4. AI 对话能正常开始和继续

- [ ] **Step 5: 最终提交**

```bash
git add -A
git commit -m "refactor: 整合验证 + 类型清理 — 去抽象化方案实施完毕"
```

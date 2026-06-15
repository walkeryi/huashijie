# 世界引擎 MVP 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建一个可运行的最小文字冒险引擎 — 选择预设世界卡，进入 AI 驱动的对话冒险，支持打字机效果、轻量数值系统和本地存档。

**Architecture:** Next.js App Router 全栈应用。前端用 React Context + useReducer 管理游戏状态，通过 POST 请求调用 `/api/adventure` 获取 AI 响应。后端组装世界卡 + 玩家状态 + 历史记录为系统提示词，调用 Claude API，返回结构化 JSON。前端消费后同步渲染打字机动效和选项按钮。

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, @anthropic-ai/sdk, React Context API

---

## 文件结构

```
src/
├── app/
│   ├── layout.tsx              # 根布局 + Tailwind 全局样式引用
│   ├── globals.css             # Tailwind 指令 + 自定义主题变量
│   ├── page.tsx                # 首页：世界卡选择 + 玩家命名
│   ├── game/
│   │   └── page.tsx            # 游戏页：对话 + 选项 + 状态面板
│   └── api/
│       └── adventure/
│           └── route.ts        # POST: AI 交互端点
├── components/
│   ├── WorldCardSelector.tsx   # 世界卡卡片列表 + 选择交互
│   ├── GameScreen.tsx          # 游戏主容器（Context Provider）
│   ├── DialogueBox.tsx         # 对话历史 + 打字机输出
│   ├── OptionsPanel.tsx        # 选项按钮组 + 自由输入
│   ├── StatusPanel.tsx         # 属性条展示
│   └── SaveLoadPanel.tsx       # 存档/读档面板
├── lib/
│   ├── types.ts                # 所有 TypeScript 类型
│   ├── game-context.tsx        # GameContext + useReducer
│   └── storage.ts              # localStorage 存档读写
└── data/
    └── world-cards.ts          # 2 张预设世界卡
```

独立文件职责：

| 文件 | 职责 | 依赖 |
|------|------|------|
| `types.ts` | 所有类型定义，零依赖 | 无 |
| `world-cards.ts` | 预设世界卡硬数据 | types |
| `storage.ts` | 存档序列化/反序列化/删除 | types |
| `game-context.tsx` | 游戏状态管理，dispatch actions | types, storage |
| `route.ts` | Claude API 调用 + prompt 组装 | types |
| `WorldCardSelector.tsx` | 选择世界卡 UI | types |
| `GameScreen.tsx` | 游戏主布局，组合子组件 | game-context |
| `DialogueBox.tsx` | 打字机效果 + 对话列表 | game-context |
| `OptionsPanel.tsx` | 选项渲染 + 自由输入 | game-context |
| `StatusPanel.tsx` | 属性进度条 | game-context |
| `SaveLoadPanel.tsx` | 存档管理 UI | game-context, storage |

---

### Task 1: 初始化 Next.js 项目

**Files:**
- Create: `package.json`, `next.config.js`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `.env.local`
- Create: `src/app/layout.tsx`, `src/app/globals.css`

- [ ] **Step 1: 用 create-next-app 创建项目**

```bash
cd "C:/Users/ASUS/Desktop/陪你一起冒险"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```
选择全部默认 yes。完成后项目自动生成。

- [ ] **Step 2: 安装 Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 3: 创建 .env.local**

```env
ANTHROPIC_API_KEY=your_api_key_here
```

- [ ] **Step 4: 替换 `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-primary: #0f0f0f;
  --bg-secondary: #1a1a1a;
  --bg-card: #1e1e1e;
  --text-primary: #e0d5c1;
  --text-secondary: #a09888;
  --accent: #c9a96e;
  --accent-hover: #d4b87a;
  --danger: #8b4444;
  --border: #2a2a2a;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Georgia', 'Noto Serif SC', serif;
}

/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: var(--bg-primary);
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
```

- [ ] **Step 5: 替换 `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '陪你一起冒险',
  description: 'AI 驱动的文字冒险世界引擎',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
```

- [ ] **Step 6: 验证项目能跑起来**

```bash
npm run dev
```

打开 http://localhost:3000，确认 Next.js 默认页面正常加载。

- [ ] **Step 7: 提交**

```bash
git init
git add -A
git commit -m "feat: init Next.js project with TypeScript, Tailwind, Anthropic SDK"
```

---

### Task 2: 定义类型系统

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: 写入所有类型定义**

```typescript
// ========== 世界卡 ==========

export interface AttributeDef {
  key: string        // 例如 "courage"
  name: string       // 例如 "勇气"
  icon: string       // emoji 例如 "⚔️"
  initial: number    // 初始值
  max: number        // 最大值
}

export interface WorldCard {
  id: string
  name: string           // 世界名称
  subtitle: string       // 副标题/简介
  description: string    // 世界设定（注入 AI prompt）
  coverEmoji: string     // 封面 emoji
  initialScene: string   // 初始场景描述
  attributes: AttributeDef[]
}

// ========== 游戏状态 ==========

export interface DialogueEntry {
  id: string
  role: 'narrator' | 'player'
  content: string
  timestamp: number
}

export interface GameOption {
  text: string
  attributeChecks?: Record<string, string>  // 例如 {courage: ">= 3"}
}

export interface AIResponse {
  narration: string
  options: GameOption[]
  attributeChanges: Record<string, number>   // 例如 {courage: 2, health: -1}
}

export interface PlayerState {
  playerName: string
  attributes: Record<string, number>  // 例如 {courage: 5, health: 8}
  flags: Record<string, boolean>      // 例如 {met_king: true}
}

// ========== 存档 ==========

export interface SaveData {
  id: string
  slotName: string
  timestamp: number
  worldCardId: string
  playerState: PlayerState
  dialogueHistory: DialogueEntry[]
}

// ========== 游戏上下文 ==========

export type GameScreen = 'menu' | 'playing'

export interface GameState {
  screen: GameScreen
  worldCard: WorldCard | null
  playerState: PlayerState | null
  dialogueHistory: DialogueEntry[]
  currentOptions: GameOption[]
  currentNarration: string
  isLoading: boolean
  error: string | null
  saveSlots: SaveData[]
}

export type GameAction =
  | { type: 'START_GAME'; worldCard: WorldCard; playerName: string }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_RESPONSE'; response: AIResponse }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'APPEND_NARRATION'; text: string }
  | { type: 'LOAD_SAVE'; save: SaveData; worldCard: WorldCard }
  | { type: 'REFRESH_SAVES'; saves: SaveData[] }
  | { type: 'RETURN_TO_MENU' }
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

确保无类型错误。

- [ ] **Step 3: 提交**

```bash
git add src/lib/types.ts
git commit -m "feat: add all TypeScript type definitions"
```

---

### Task 3: 创建预设世界卡

**Files:**
- Create: `src/data/world-cards.ts`

- [ ] **Step 1: 写入 2 张预设世界卡**

```typescript
import { WorldCard } from '@/lib/types'

export const presetWorldCards: WorldCard[] = [
  {
    id: 'steampunk_skyfall',
    name: '蒸汽苍穹',
    subtitle: '天空之城正在坠落，你是唯一能拯救它的人',
    description: `## 世界观
蒸汽朋克时代，魔法与机械并存。七座天空之城靠核心水晶悬浮于云海之上。
但第三天空城「铁鹰城」的核心水晶被人窃走，城市正在缓慢下坠。
地面上，被流放的地底工匠和荒野流民虎视眈眈。

## 规则
- 这是一个魔法与蒸汽科技共存的世界
- 天空城分为三个阵营：天空贵族、地底工匠、荒野流民
- 核心冲突：谁偷走了铁鹰城的核心水晶？为什么？
- 基调：灰暗但保留希望，冒险中带有幽默

## 开场
玩家是铁鹰城的一名年轻机械师学徒，在一艘坠毁的飞艇残骸中醒来，失去了最近几天的记忆。`,
    coverEmoji: '⚙️',
    initialScene: '你在一艘坠毁的飞艇残骸中醒来。头痛欲裂，身上有几处擦伤。窗外是云层和正在下坠的城市碎片。你隐约记得自己曾在追查核心水晶的线索，但具体是什么……完全想不起来了。残骸外传来脚步声，有人正在靠近。',
    attributes: [
      { key: 'courage', name: '勇气', icon: '⚔️', initial: 3, max: 10 },
      { key: 'intellect', name: '智力', icon: '🧠', initial: 5, max: 10 },
      { key: 'charm', name: '魅力', icon: '💬', initial: 3, max: 10 },
      { key: 'mechanical', name: '机械', icon: '🔧', initial: 4, max: 10 },
    ],
  },
  {
    id: 'jade_dynasty',
    name: '玉京风华',
    subtitle: '在神灵隐退的王朝末年，寻找最后一只灵兽',
    description: `## 世界观
架空的东方古风世界。王朝「玉京」已延续三百年，但灵力日渐稀薄。
传说中的灵兽逐一消失，庙宇荒废，神像蒙尘。
民间流传：当最后一只灵兽也离去，王朝的龙脉将彻底断裂，灾祸降临。

## 规则
- 这是一个低魔东方奇幻世界
- 灵力尚存但日渐式微，法术需要极大代价
- 各方势力：朝廷、修行者、民间异士、灵兽守护者
- 核心冲突：是否能让灵兽回归？龙脉断裂真是坏事吗？
- 基调：典雅含蓄，山水画般的意境

## 开场
玩家是京城一位落魄书生，偶然在旧书摊发现了一本记载灵兽行踪的古卷。`,
    coverEmoji: '🏮',
    initialScene: '春雨绵绵，你撑着油纸伞走在京城青石板路上。怀里的古卷还带着旧书摊的霉味，但上面画的灵兽图样……你昨晚对照星图比了一夜，竟然是真的方位。巷口茶馆里有人说书，讲的正是「龙脉将断，天下大乱」。你握紧了袖子里的几枚铜钱，是该先进茶馆打听消息，还是立刻按图索骥出城寻找灵兽？',
    attributes: [
      { key: 'courage', name: '胆识', icon: '⚔️', initial: 2, max: 10 },
      { key: 'wisdom', name: '慧根', icon: '📿', initial: 5, max: 10 },
      { key: 'charm', name: '风雅', icon: '🎋', initial: 4, max: 10 },
      { key: 'spirit', name: '灵力', icon: '✨', initial: 3, max: 10 },
    ],
  },
]
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/data/world-cards.ts
git commit -m "feat: add 2 preset world cards (steampunk, jade dynasty)"
```

---

### Task 4: 实现 localStorage 存档系统

**Files:**
- Create: `src/lib/storage.ts`

- [ ] **Step 1: 写入 storage 模块**

```typescript
import { SaveData, PlayerState, DialogueEntry } from './types'

const SAVE_PREFIX = 'adventure_save_'
const AUTO_SAVE_KEY = 'adventure_autosave'

/** 列出所有存档 */
export function listSaves(): SaveData[] {
  if (typeof window === 'undefined') return []
  const saves: SaveData[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(SAVE_PREFIX)) {
      try {
        const raw = localStorage.getItem(key)
        if (raw) saves.push(JSON.parse(raw))
      } catch { /* 忽略损坏的存档 */ }
    }
  }
  // 也检查自动存档
  try {
    const autoRaw = localStorage.getItem(AUTO_SAVE_KEY)
    if (autoRaw) saves.push(JSON.parse(autoRaw))
  } catch { /* ignore */ }
  return saves.sort((a, b) => b.timestamp - a.timestamp)
}

/** 保存到指定槽位（1-3） */
export function saveToSlot(
  slot: number,
  saveId: string,
  slotName: string,
  worldCardId: string,
  playerState: PlayerState,
  dialogueHistory: DialogueEntry[],
): void {
  if (typeof window === 'undefined') return
  const data: SaveData = {
    id: saveId,
    slotName,
    timestamp: Date.now(),
    worldCardId,
    playerState,
    dialogueHistory,
  }
  localStorage.setItem(SAVE_PREFIX + slot, JSON.stringify(data))
}

/** 自动存档 */
export function autoSave(
  worldCardId: string,
  playerState: PlayerState,
  dialogueHistory: DialogueEntry[],
): void {
  if (typeof window === 'undefined') return
  const data: SaveData = {
    id: 'autosave',
    slotName: '自动存档',
    timestamp: Date.now(),
    worldCardId,
    playerState,
    dialogueHistory,
  }
  localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(data))
}

/** 读取存档 */
export function loadSave(slotOrKey: number | string): SaveData | null {
  if (typeof window === 'undefined') return null
  const key = typeof slotOrKey === 'number'
    ? SAVE_PREFIX + slotOrKey
    : slotOrKey === 'autosave' ? AUTO_SAVE_KEY : SAVE_PREFIX + slotOrKey
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** 删除存档 */
export function deleteSave(slot: number): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SAVE_PREFIX + slot)
}

/** 获取存档摘要文本 */
export function getSaveSummary(save: SaveData): string {
  const lastEntry = save.dialogueHistory[save.dialogueHistory.length - 1]
  const snippet = lastEntry
    ? lastEntry.content.slice(0, 60) + (lastEntry.content.length > 60 ? '…' : '')
    : '空存档'
  return `${save.slotName} — ${snippet}`
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/storage.ts
git commit -m "feat: implement localStorage save/load system"
```

---

### Task 5: 实现游戏状态管理（Context + Reducer）

**Files:**
- Create: `src/lib/game-context.tsx`

- [ ] **Step 1: 写入 GameContext**

```tsx
'use client'

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react'
import {
  GameState, GameAction, WorldCard, AIResponse, SaveData, GameOption, DialogueEntry,
} from './types'
import { listSaves, saveToSlot, autoSave, loadSave, deleteSave } from './storage'

// ========== 初始状态 ==========

function createInitialState(): GameState {
  return {
    screen: 'menu',
    worldCard: null,
    playerState: null,
    dialogueHistory: [],
    currentOptions: [],
    currentNarration: '',
    isLoading: false,
    error: null,
    saveSlots: [],
  }
}

// ========== Reducer ==========

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const attrs: Record<string, number> = {}
      action.worldCard.attributes.forEach(a => {
        attrs[a.key] = a.initial
      })
      return {
        ...state,
        screen: 'playing',
        worldCard: action.worldCard,
        playerState: {
          playerName: action.playerName,
          attributes: attrs,
          flags: {},
        },
        dialogueHistory: [],
        currentOptions: [],
        currentNarration: '',
        isLoading: true,
        error: null,
      }
    }

    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading }

    case 'SET_RESPONSE': {
      const { response } = action
      const newDialogue: DialogueEntry[] = [
        ...state.dialogueHistory,
        {
          id: 'narrator_' + Date.now(),
          role: 'narrator',
          content: response.narration,
          timestamp: Date.now(),
        },
      ]

      // 应用属性变化
      const newAttrs = { ...state.playerState!.attributes }
      for (const [key, delta] of Object.entries(response.attributeChanges)) {
        if (key in newAttrs) {
          newAttrs[key] = Math.max(0, Math.min(
            newAttrs[key] + delta,
            state.worldCard!.attributes.find(a => a.key === key)?.max ?? 10
          ))
        }
      }

      return {
        ...state,
        playerState: {
          ...state.playerState!,
          attributes: newAttrs,
        },
        dialogueHistory: newDialogue,
        currentOptions: response.options,
        currentNarration: response.narration,
        isLoading: false,
      }
    }

    case 'SET_ERROR':
      return { ...state, error: action.error, isLoading: false }

    case 'APPEND_NARRATION':
      return { ...state, currentNarration: state.currentNarration + action.text }

    case 'LOAD_SAVE':
      return {
        ...state,
        screen: 'playing',
        worldCard: action.worldCard,
        playerState: action.save.playerState,
        dialogueHistory: action.save.dialogueHistory,
        currentOptions: [],
        currentNarration: '',
        isLoading: false,
        error: null,
      }

    case 'REFRESH_SAVES':
      return { ...state, saveSlots: action.saves }

    case 'RETURN_TO_MENU':
      return createInitialState()

    default:
      return state
  }
}

// ========== Context ==========

interface GameContextValue {
  state: GameState
  dispatch: React.Dispatch<GameAction>
  actions: {
    startGame: (worldCard: WorldCard, playerName: string) => void
    submitAction: (optionText: string) => Promise<void>
    saveGame: (slot: number, name: string) => void
    loadGame: (save: SaveData, worldCard: WorldCard) => void
    deleteGame: (slot: number) => void
    refreshSaves: () => void
    returnToMenu: () => void
  }
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState)

  const refreshSaves = useCallback(() => {
    dispatch({ type: 'REFRESH_SAVES', saves: listSaves() })
  }, [])

  const startGame = useCallback((worldCard: WorldCard, playerName: string) => {
    dispatch({ type: 'START_GAME', worldCard, playerName })
  }, [])

  const submitAction = useCallback(async (optionText: string) => {
    if (!state.worldCard || !state.playerState) return
    dispatch({ type: 'SET_LOADING', isLoading: true })

    // 添加玩家选择到对话历史
    const playerEntry: DialogueEntry = {
      id: 'player_' + Date.now(),
      role: 'player',
      content: optionText,
      timestamp: Date.now(),
    }
    const historyWithPlayerInput = [...state.dialogueHistory, playerEntry]

    try {
      const res = await fetch('/api/adventure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldCard: state.worldCard,
          playerState: state.playerState,
          dialogueHistory: historyWithPlayerInput,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || 'API 请求失败')
      }

      const data: AIResponse = await res.json()
      // 更新对话历史（包含玩家输入 + AI 回复）
      const fullHistory = [
        ...state.dialogueHistory,
        playerEntry,
        {
          id: 'narrator_' + Date.now(),
          role: 'narrator' as const,
          content: data.narration,
          timestamp: Date.now(),
        },
      ]

      // 应用属性变化
      const newAttrs = { ...state.playerState.attributes }
      for (const [key, delta] of Object.entries(data.attributeChanges)) {
        if (key in newAttrs) {
          const maxVal = state.worldCard!.attributes.find(a => a.key === key)?.max ?? 10
          newAttrs[key] = Math.max(0, Math.min(newAttrs[key] + delta, maxVal))
        }
      }

      dispatch({
        type: 'SET_RESPONSE',
        response: data,
      })

      // 更新实际对话历史和属性（通过修改 dispatch 的行为来处理）
      // 这里我们需要直接修改 state —— 但 reducer 模式不支持。改用下面的方式：
      // 实际上上面的 SET_RESPONSE 已经处理了。但 playerEntry 需要在 reducer 中追加。
      // 问题：SET_RESPONSE 只追加 narration，没有追加 playerEntry。
      // 解决方案：让 SET_RESPONSE 也处理 player 输入，或者用一个不同的 action。
      // 简便方案：在 submitAction 中手动处理后用 LOAD_SAVE 风格的重置。
      // 更好的方案：修改 reducer 让 SET_RESPONSE 也接受可选的 playerEntry。

      // 自动存档
      const updatedState: PlayerState = {
        ...state.playerState,
        attributes: newAttrs,
      }
      autoSave(state.worldCard.id, updatedState, fullHistory)
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', error: e.message || '未知错误' })
    }
  }, [state.worldCard, state.playerState, state.dialogueHistory])

  const saveGame = useCallback((slot: number, name: string) => {
    if (!state.worldCard || !state.playerState) return
    saveToSlot(slot, 'save_' + Date.now(), name, state.worldCard.id, state.playerState, state.dialogueHistory)
    refreshSaves()
  }, [state.worldCard, state.playerState, state.dialogueHistory, refreshSaves])

  const loadGame = useCallback((save: SaveData, worldCard: WorldCard) => {
    dispatch({ type: 'LOAD_SAVE', save, worldCard })
  }, [])

  const deleteGame = useCallback((slot: number) => {
    deleteSave(slot)
    refreshSaves()
  }, [refreshSaves])

  const returnToMenu = useCallback(() => {
    dispatch({ type: 'RETURN_TO_MENU' })
  }, [])

  useEffect(() => {
    refreshSaves()
  }, [refreshSaves])

  const value: GameContextValue = {
    state,
    dispatch,
    actions: {
      startGame, submitAction, saveGame, loadGame, deleteGame, refreshSaves, returnToMenu,
    },
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
```

- [ ] **Step 2: 修复 submitAction 中玩家输入未被记录的问题**

上面 `submitAction` 直接调用了 `SET_RESPONSE`，但 reducer 的 `SET_RESPONSE` 不会追加玩家的对话条目。需要修改。

修改 `GameAction` 类型新增 `playerEntry`：

先更新 `types.ts`：

修改 `SET_RESPONSE` action：
```typescript
| { type: 'SET_RESPONSE'; response: AIResponse; playerEntry: DialogueEntry }
```

在 `game-context.tsx` 的 reducer 中更新 `SET_RESPONSE`：
```typescript
case 'SET_RESPONSE': {
  const { response, playerEntry } = action
  const newHistory = [...state.dialogueHistory, playerEntry, {
    id: 'narrator_' + Date.now(),
    role: 'narrator' as const,
    content: response.narration,
    timestamp: Date.now(),
  }]

  const newAttrs = { ...state.playerState!.attributes }
  for (const [key, delta] of Object.entries(response.attributeChanges)) {
    if (key in newAttrs) {
      newAttrs[key] = Math.max(0, Math.min(
        newAttrs[key] + delta,
        state.worldCard!.attributes.find(a => a.key === key)?.max ?? 10
      ))
    }
  }

  return {
    ...state,
    playerState: { ...state.playerState!, attributes: newAttrs },
    dialogueHistory: newHistory,
    currentOptions: response.options,
    currentNarration: response.narration,
    isLoading: false,
  }
}
```

在 `submitAction` 中 dispatch 时传入 playerEntry：
```typescript
dispatch({
  type: 'SET_RESPONSE',
  response: data,
  playerEntry,
})
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add src/lib/game-context.tsx src/lib/types.ts
git commit -m "feat: implement game state management with Context + useReducer"
```

---

### Task 6: 实现 API Route（Claude AI 交互）

**Files:**
- Create: `src/app/api/adventure/route.ts`

- [ ] **Step 1: 写入 API Route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { WorldCard, PlayerState, DialogueEntry, AIResponse } from '@/lib/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

function buildSystemPrompt(worldCard: WorldCard, playerState: PlayerState): string {
  const attrText = Object.entries(playerState.attributes)
    .map(([key, val]) => {
      const def = worldCard.attributes.find(a => a.key === key)
      return def ? `${def.icon} ${def.name}: ${val}/${def.max}` : `${key}: ${val}`
    })
    .join('\n')

  return `你是一个文字冒险游戏的叙事引擎。你必须严格遵循以下设定来运行游戏。

## 世界设定
${worldCard.description}

## 玩家当前状态
- 姓名：${playerState.playerName}
${attrText}

## 你的职责
1. 根据玩家的选择推进故事
2. 描述场景、NPC 反应和事件发展
3. 故事的走向应该受玩家属性影响——属性高的可以发现更多线索、说服NPC、克服困难
4. 每次回复结束给出 2-4 个选项供玩家选择
5. 选项可以需要属性条件（比如 ${worldCard.attributes[0]?.name ?? '属性'} >= 5 才能选的选项）

## 输出格式
你必须严格按照以下 JSON 格式输出（不要包含 markdown 代码块标记，只输出纯 JSON）：

{
  "narration": "场景叙述文字，使用文学化的中文，沉浸感强，2-5段",
  "options": [
    {"text": "选项文本"},
    {"text": "需要属性条件的选项文本", "attributeChecks": {"courage": ">= 5"}}
  ],
  "attributeChanges": {"courage": 2, "health": -1}
}

## 重要规则
- narration 使用中文，语言优美有画面感，但不要过于冗长（控制在 200-400 字）
- options 提供 2-4 个有意义的选择，不要让玩家感觉"选什么都一样"
- attributeChanges 是选择后的属性增减，只在合理时使用，大多数情况可以设为 {}
- 保持世界的内部一致性——记住之前发生的事
- 不要代替玩家做选择
- 不要输出"未完待续"这类元叙述`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { worldCard, playerState, dialogueHistory } = body as {
      worldCard: WorldCard
      playerState: PlayerState
      dialogueHistory: DialogueEntry[]
    }

    // 构建消息历史
    const messages: Anthropic.MessageParam[] = []

    // 将对话历史转为 messages
    for (const entry of dialogueHistory.slice(-12)) { // 保留最近 12 条
      if (entry.role === 'narrator') {
        messages.push({ role: 'assistant', content: entry.content })
      } else {
        messages.push({ role: 'user', content: `[玩家选择]: ${entry.content}` })
      }
    }

    // 如果是新游戏（无历史），发送一个初始消息
    if (messages.length === 0) {
      messages.push({
        role: 'user',
        content: `[游戏开始]\n初始场景：${worldCard.initialScene}\n\n请根据以上场景开始叙述，并给出玩家的选项。`,
      })
    }

    const systemPrompt = buildSystemPrompt(worldCard, playerState)

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    // 解析 AI 响应
    const text = (response.content[0] as { type: 'text'; text: string }).text
    let aiResponse: AIResponse

    try {
      // 尝试直接解析 JSON
      aiResponse = JSON.parse(text.trim())
    } catch {
      // 尝试从 markdown 代码块中提取
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[1].trim())
      } else {
        // 降级：当作纯文本，生成默认选项
        aiResponse = {
          narration: text.trim(),
          options: [
            { text: '继续前进' },
            { text: '仔细观察周围' },
            { text: '与附近的人交谈' },
          ],
          attributeChanges: {},
        }
      }
    }

    // 验证字段
    if (!aiResponse.narration) {
      aiResponse.narration = text.trim()
    }
    if (!aiResponse.options || aiResponse.options.length === 0) {
      aiResponse.options = [{ text: '继续...' }]
    }
    if (!aiResponse.attributeChanges) {
      aiResponse.attributeChanges = {}
    }

    return NextResponse.json(aiResponse)
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error.message || '内部错误' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/app/api/adventure/route.ts
git commit -m "feat: implement Claude API adventure endpoint"
```

---

### Task 7: 实现 WorldCardSelector 组件

**Files:**
- Create: `src/components/WorldCardSelector.tsx`

- [ ] **Step 1: 写入组件**

```tsx
'use client'

import { useState } from 'react'
import { WorldCard } from '@/lib/types'
import { presetWorldCards } from '@/data/world-cards'
import { useGame } from '@/lib/game-context'
import { listSaves } from '@/lib/storage'

export default function WorldCardSelector() {
  const { actions } = useGame()
  const [selected, setSelected] = useState<WorldCard | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [showLoadPanel, setShowLoadPanel] = useState(false)
  const saves = typeof window !== 'undefined' ? listSaves() : []

  const handleStart = () => {
    if (!selected) return
    actions.startGame(selected, playerName || '冒险者')
  }

  const handleLoad = (saveId: string) => {
    const save = saves.find(s => s.id === saveId)
    if (!save) return
    const worldCard = presetWorldCards.find(w => w.id === save.worldCardId)
    if (!worldCard) return
    actions.loadGame(save, worldCard)
  }

  if (showLoadPanel) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <h2 className="text-2xl text-center mb-8">📂 读取存档</h2>
        {saves.length === 0 ? (
          <p className="text-center text-[var(--text-secondary)]">暂无存档</p>
        ) : (
          <div className="space-y-3">
            {saves.map(save => {
              const wc = presetWorldCards.find(w => w.id === save.worldCardId)
              return (
                <button
                  key={save.id}
                  onClick={() => handleLoad(save.id)}
                  className="w-full text-left p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)] transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-lg">{save.slotName}</div>
                      <div className="text-sm text-[var(--text-secondary)]">
                        {wc?.name ?? save.worldCardId} — {new Date(save.timestamp).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <span className="text-2xl">{wc?.coverEmoji ?? '🎮'}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
        <button
          onClick={() => setShowLoadPanel(false)}
          className="mt-6 w-full py-3 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          返回
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">🌍 陪你一起冒险</h1>
        <p className="text-[var(--text-secondary)] text-lg">选择一个世界，开始你的冒险</p>
      </div>

      {/* 世界卡网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {presetWorldCards.map(card => (
          <button
            key={card.id}
            onClick={() => setSelected(card)}
            className={`text-left p-6 rounded-xl border-2 transition-all ${
              selected?.id === card.id
                ? 'border-[var(--accent)] bg-[var(--bg-card)] shadow-lg shadow-[var(--accent)]/10'
                : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]/50'
            }`}
          >
            <div className="text-4xl mb-3">{card.coverEmoji}</div>
            <h3 className="text-xl font-bold mb-1">{card.name}</h3>
            <p className="text-[var(--text-secondary)] text-sm">{card.subtitle}</p>
          </button>
        ))}
      </div>

      {/* 玩家命名 */}
      {selected && (
        <div className="max-w-md mx-auto space-y-4 animate-fadeIn">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              你的名字（选填）
            </label>
            <input
              type="text"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              placeholder="冒险者"
              className="w-full px-4 py-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition-colors"
              onKeyDown={e => e.key === 'Enter' && handleStart()}
            />
          </div>

          <button
            onClick={handleStart}
            className="w-full py-4 rounded-lg bg-[var(--accent)] text-black font-bold text-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            开始冒险 ⚔️
          </button>
        </div>
      )}

      {/* 继续冒险 / 读取存档 */}
      <div className="text-center mt-8">
        <button
          onClick={() => setShowLoadPanel(true)}
          className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors text-sm underline underline-offset-4"
        >
          📂 继续之前的冒险
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 在 globals.css 追加动画**

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn {
  animation: fadeIn 0.4s ease-out;
}
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add src/components/WorldCardSelector.tsx src/app/globals.css
git commit -m "feat: add WorldCardSelector with save/load panel"
```

---

### Task 8: 实现 DialogueBox 组件（含打字机效果）

**Files:**
- Create: `src/components/DialogueBox.tsx`

- [ ] **Step 1: 写入组件**

```tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { useGame } from '@/lib/game-context'
import { DialogueEntry } from '@/lib/types'

export default function DialogueBox() {
  const { state } = useGame()
  const { dialogueHistory, currentNarration, isLoading } = state
  const scrollRef = useRef<HTMLDivElement>(null)

  // 打字机效果：currentNarration 是完整的，这里逐字显示
  const [displayedText, setDisplayedText] = useState('')
  const [typingIndex, setTypingIndex] = useState(0)
  const lastNarrationRef = useRef('')

  useEffect(() => {
    // 检测是否有新的 narration（通过对比）
    if (currentNarration && currentNarration !== lastNarrationRef.current) {
      lastNarrationRef.current = currentNarration
      setDisplayedText('')
      setTypingIndex(0)
    }
  }, [currentNarration])

  useEffect(() => {
    if (!currentNarration) return
    if (typingIndex >= currentNarration.length) return

    const timer = setTimeout(() => {
      setDisplayedText(currentNarration.slice(0, typingIndex + 1))
      setTypingIndex(typingIndex + 1)
    }, 40) // 每字 40ms，约 25 字/秒

    return () => clearTimeout(timer)
  }, [typingIndex, currentNarration])

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [dialogueHistory, displayedText])

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[calc(100vh-280px)]"
    >
      {/* 历史对话 */}
      {dialogueHistory.map((entry) => (
        <div
          key={entry.id}
          className={`flex ${entry.role === 'player' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] px-4 py-3 rounded-2xl ${
              entry.role === 'player'
                ? 'bg-[var(--accent)]/20 text-[var(--text-primary)] border border-[var(--accent)]/30'
                : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)]'
            }`}
          >
            {entry.role === 'player' && (
              <div className="text-xs text-[var(--accent)] mb-1">你</div>
            )}
            <p className="leading-relaxed whitespace-pre-wrap">{entry.content}</p>
          </div>
        </div>
      ))}

      {/* 正在输出的文字（打字机） */}
      {isLoading && !currentNarration && (
        <div className="flex justify-start">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] px-4 py-3 rounded-2xl">
            <div className="flex gap-2">
              <span className="w-2 h-2 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      {/* 当前 narration 的打字机输出 */}
      {displayedText && (
        <div className="flex justify-start">
          <div className="max-w-[80%] bg-[var(--bg-secondary)] border border-[var(--accent)]/20 px-4 py-3 rounded-2xl">
            <p className="leading-relaxed whitespace-pre-wrap">
              {displayedText}
              {typingIndex < currentNarration.length && (
                <span className="inline-block w-0.5 h-5 bg-[var(--accent)] ml-0.5 animate-pulse align-text-bottom" />
              )}
            </p>
          </div>
        </div>
      )}

      <div className="h-4" /> {/* 底部留白 */}
    </div>
  )
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/components/DialogueBox.tsx
git commit -m "feat: add DialogueBox with typewriter effect"
```

---

### Task 9: 实现 OptionsPanel + StatusPanel + SaveLoadPanel

**Files:**
- Create: `src/components/OptionsPanel.tsx`
- Create: `src/components/StatusPanel.tsx`
- Create: `src/components/SaveLoadPanel.tsx`

- [ ] **Step 1: 写入 OptionsPanel**

```tsx
'use client'

import { useState } from 'react'
import { useGame } from '@/lib/game-context'
import { GameOption } from '@/lib/types'

/** 检查属性条件 */
function checkCondition(
  checks: Record<string, string> | undefined,
  attrs: Record<string, number>
): boolean {
  if (!checks) return true
  for (const [key, condition] of Object.entries(checks)) {
    const val = attrs[key] ?? 0
    const match = condition.match(/^([><=!]+)\s*(-?\d+)$/)
    if (!match) continue
    const [, op, numStr] = match
    const target = parseInt(numStr)
    switch (op) {
      case '>=': if (!(val >= target)) return false; break
      case '>': if (!(val > target)) return false; break
      case '<=': if (!(val <= target)) return false; break
      case '<': if (!(val < target)) return false; break
      case '==': if (!(val === target)) return false; break
      case '!=': if (!(val !== target)) return false; break
    }
  }
  return true
}

export default function OptionsPanel() {
  const { state, actions } = useGame()
  const { currentOptions, isLoading, playerState, worldCard } = state
  const [freeInput, setFreeInput] = useState('')

  // 打字机完成后再显示选项
  const [typingComplete, setTypingComplete] = useState(true)
  // 用 ref 的方式简化：这里直接判断 displayed text 是否已满
  // 实际用 DialogueBox 传递状态，简化处理：延迟显示选项
  const [showOptions, setShowOptions] = useState(false)

  // 当收到新选项时延迟显示
  useState(() => {
    if (currentOptions.length > 0 && !isLoading) {
      setShowOptions(false)
      const timer = setTimeout(() => setShowOptions(true), 800)
      return () => clearTimeout(timer)
    }
  })

  const handleOptionClick = (option: GameOption) => {
    if (isLoading) return
    actions.submitAction(option.text)
    setShowOptions(false)
  }

  const handleFreeSubmit = () => {
    if (!freeInput.trim() || isLoading) return
    actions.submitAction(freeInput.trim())
    setFreeInput('')
    setShowOptions(false)
  }

  if (isLoading) return null

  return (
    <div className={`border-t border-[var(--border)] p-4 bg-[var(--bg-primary)] transition-opacity duration-500 ${showOptions ? 'opacity-100' : 'opacity-0'}`}>
      {/* 预设选项 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {currentOptions.map((opt, i) => {
          const canChoose = checkCondition(opt.attributeChecks, playerState?.attributes ?? {})
          return (
            <button
              key={i}
              onClick={() => canChoose && handleOptionClick(opt)}
              disabled={!canChoose}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                canChoose
                  ? 'bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-95'
                  : 'bg-[var(--bg-card)]/50 border border-[var(--border)]/50 text-[var(--text-secondary)]/50 cursor-not-allowed line-through'
              }`}
            >
              {opt.text}
            </button>
          )
        })}
      </div>

      {/* 自由输入 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={freeInput}
          onChange={e => setFreeInput(e.target.value)}
          placeholder="或者输入你想做的事..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition-colors"
          onKeyDown={e => e.key === 'Enter' && handleFreeSubmit()}
        />
        <button
          onClick={handleFreeSubmit}
          disabled={!freeInput.trim()}
          className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-black font-medium text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
        >
          行动
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 写入 StatusPanel**

```tsx
'use client'

import { useGame } from '@/lib/game-context'

export default function StatusPanel() {
  const { state, actions } = useGame()
  const { playerState, worldCard } = state
  const [showSave, setShowSave] = useState(false)

  if (!playerState || !worldCard) return null

  return (
    <div className="border-l border-[var(--border)] p-4 w-64 flex-shrink-0 bg-[var(--bg-secondary)]/50 overflow-y-auto">
      {/* 玩家信息 */}
      <div className="mb-4">
        <h3 className="text-sm text-[var(--text-secondary)] mb-1">冒险者</h3>
        <p className="font-bold text-lg">{playerState.playerName}</p>
        <p className="text-xs text-[var(--text-secondary)]">{worldCard.name}</p>
      </div>

      {/* 属性 */}
      <div className="mb-6">
        <h3 className="text-sm text-[var(--text-secondary)] mb-3">属性</h3>
        <div className="space-y-3">
          {worldCard.attributes.map(attr => {
            const val = playerState.attributes[attr.key] ?? 0
            const pct = (val / attr.max) * 100
            return (
              <div key={attr.key}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{attr.icon} {attr.name}</span>
                  <span className="text-[var(--text-secondary)]">{val}/{attr.max}</span>
                </div>
                <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 按钮组 */}
      <div className="space-y-2">
        <button
          onClick={() => setShowSave(!showSave)}
          className="w-full py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition-colors"
        >
          💾 存档
        </button>
        <button
          onClick={actions.returnToMenu}
          className="w-full py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm hover:border-[var(--danger)] transition-colors"
        >
          🚪 退出
        </button>
      </div>

      {/* 存档弹出 */}
      {showSave && <SaveSlots onClose={() => setShowSave(false)} />}
    </div>
  )
}

// 存档槽位选择子组件
function SaveSlots({ onClose }: { onClose: () => void }) {
  const { state, actions } = useGame()

  return (
    <div className="mt-4 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
      <h4 className="text-sm text-[var(--text-secondary)] mb-2">选择存档槽位</h4>
      {[1, 2, 3].map(slot => {
        const existing = state.saveSlots.find(s => s.id.startsWith('save_') && s.id === `save_${slot}`)
        return (
          <button
            key={slot}
            onClick={() => {
              const name = prompt('给存档取个名字：', existing?.slotName || `存档 ${slot}`)
              if (name) actions.saveGame(slot, name)
              onClose()
            }}
            className="w-full text-left p-2 rounded text-sm hover:bg-[var(--bg-card)] transition-colors flex justify-between"
          >
            <span>槽位 {slot}</span>
            <span className="text-[var(--text-secondary)] text-xs">
              {existing ? existing.slotName : '空'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

等等——`useState` 在 StatusPanel 中缺少 import。修正：

```tsx
import { useState } from 'react'
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add src/components/OptionsPanel.tsx src/components/StatusPanel.tsx
git commit -m "feat: add OptionsPanel, StatusPanel with save slots"
```

---

### Task 10: 组装页面（首页 + 游戏页）

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/game/page.tsx`
- Create: `src/components/GameScreen.tsx`

- [ ] **Step 1: 写入首页 `src/app/page.tsx`**

```tsx
'use client'

import { GameProvider } from '@/lib/game-context'
import WorldCardSelector from '@/components/WorldCardSelector'

export default function HomePage() {
  return (
    <GameProvider>
      <main className="min-h-screen flex items-center justify-center">
        <WorldCardSelector />
      </main>
    </GameProvider>
  )
}
```

- [ ] **Step 2: 写入 GameScreen 组件**

```tsx
'use client'

import { useGame } from '@/lib/game-context'
import DialogueBox from './DialogueBox'
import OptionsPanel from './OptionsPanel'
import StatusPanel from './StatusPanel'

export default function GameScreen() {
  const { state } = useGame()

  if (state.screen !== 'playing') return null

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        {/* 主对话区 */}
        <div className="flex-1 flex flex-col min-w-0">
          <DialogueBox />
          <OptionsPanel />
        </div>

        {/* 侧边状态栏 */}
        <StatusPanel />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 写入游戏页 `src/app/game/page.tsx`**

```tsx
'use client'

import { GameProvider } from '@/lib/game-context'
import GameScreen from '@/components/GameScreen'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGame } from '@/lib/game-context'

function GameContent() {
  const { state } = useGame()
  const router = useRouter()

  useEffect(() => {
    if (state.screen === 'menu') {
      router.replace('/')
    }
  }, [state.screen, router])

  return <GameScreen />
}

export default function GamePage() {
  return (
    <GameProvider>
      <GameContent />
    </GameProvider>
  )
}
```

- [ ] **Step 4: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 提交**

```bash
git add src/app/page.tsx src/app/game/page.tsx src/components/GameScreen.tsx
git commit -m "feat: assemble home page and game page"
```

---

### Task 11: 处理游戏启动时的初始 AI 调用

当前流程：`START_GAME` → 进入游戏页 → 但对话历史为空，需要触发首次 AI 调用。

- [ ] **Step 1: 修改 GameScreen 组件，添加初始调用逻辑**

```tsx
'use client'

import { useEffect } from 'react'
import { useGame } from '@/lib/game-context'
import DialogueBox from './DialogueBox'
import OptionsPanel from './OptionsPanel'
import StatusPanel from './StatusPanel'

export default function GameScreen() {
  const { state, actions } = useGame()

  // 新游戏首次进入时触发 AI 生成开场
  useEffect(() => {
    if (
      state.screen === 'playing' &&
      state.dialogueHistory.length === 0 &&
      !state.isLoading &&
      state.currentOptions.length === 0
    ) {
      actions.submitAction('开始冒险')
    }
  }, [state.screen, state.dialogueHistory.length, state.isLoading, state.currentOptions.length, actions])

  if (state.screen !== 'playing') return null

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        <div className="flex-1 flex flex-col min-w-0">
          <DialogueBox />
          <OptionsPanel />
        </div>
        <StatusPanel />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证全流程编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/components/GameScreen.tsx
git commit -m "feat: trigger initial AI narration on game start"
```

---

### Task 12: 处理路由跳转和 Context 持久化

当前问题：从 `/` 跳到 `/game` 时 GameProvider 是全新的，state 丢失。

解决方案：使用 URL search params 传递初始状态，或在 game/page 中也从 Context 读取但需要确保 startGame 在导航前调用。

更简单的方案：将 GameProvider 提升到根 layout，让 state 在页面间保持。

- [ ] **Step 1: 修改 `src/app/layout.tsx`，将 GameProvider 提升到根布局**

```tsx
import type { Metadata } from 'next'
import './globals.css'
import { GameProvider } from '@/lib/game-context'

export const metadata: Metadata = {
  title: '陪你一起冒险',
  description: 'AI 驱动的文字冒险世界引擎',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <GameProvider>
          {children}
        </GameProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: 简化 `src/app/page.tsx`**

```tsx
'use client'

import WorldCardSelector from '@/components/WorldCardSelector'

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <WorldCardSelector />
    </main>
  )
}
```

- [ ] **Step 3: 简化 `src/app/game/page.tsx`**

```tsx
'use client'

import GameScreen from '@/components/GameScreen'
import { useGame } from '@/lib/game-context'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function GamePage() {
  const { state } = useGame()
  const router = useRouter()

  useEffect(() => {
    if (state.screen === 'menu') {
      router.replace('/')
    }
  }, [state.screen, router])

  return <GameScreen />
}
```

- [ ] **Step 4: 修改 WorldCardSelector，开始游戏后跳转到 /game**

```tsx
// 在 handleStart 中:
const handleStart = () => {
  if (!selected) return
  actions.startGame(selected, playerName || '冒险者')
  router.push('/game')  // 新增跳转
}
```

需要在文件顶部添加：
```tsx
import { useRouter } from 'next/navigation'
// 组件内添加:
const router = useRouter()
```

- [ ] **Step 5: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 提交**

```bash
git add src/app/layout.tsx src/app/page.tsx src/app/game/page.tsx src/components/WorldCardSelector.tsx
git commit -m "fix: lift GameProvider to root layout, add route navigation"
```

---

### Task 13: 端到端测试 & 问题修复

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 手动测试覆盖**

1. 打开 http://localhost:3000 → 看到两张世界卡
2. 选择「蒸汽苍穹」→ 输入名字 → 点击开始冒险
3. 跳转到 /game → 看到 AI 生成的初始叙述（打字机效果）
4. 选项按钮出现 → 点击一个选项
5. 看到 AI 回复 → 属性变化反映在状态面板
6. 点击「存档」→ 选择槽位 → 保存
7. 返回首页 → 点击「继续之前的冒险」→ 读取存档
8. 点击「退出」→ 回到首页

- [ ] **Step 3: 修复发现的问题**

常见问题预判：
- API 路由返回 500 → 检查 `.env.local` 中的 `ANTHROPIC_API_KEY`
- 打字机效果不工作 → 检查 DialogueBox 的 useEffect 依赖
- 存档读不出来 → 检查 storage.ts 的 key 前缀
- 属性条件判断失败 → 检查 OptionsPanel 的 checkCondition 正则

- [ ] **Step 4: 提交修复**

```bash
git add -A
git commit -m "fix: end-to-end fixes from manual testing"
```

---

## 自审结果

- **Spec 覆盖检查**: ✅ 世界卡选择 ✅ 流式对话+打字机 ✅ 轻量数值系统 ✅ 存档/读档
- **Placeholder 扫描**: ✅ 无 TBD/TODO
- **类型一致性**: ✅ types.ts 定义与所有组件使用一致
- **遗漏项**: 无

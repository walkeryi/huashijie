---
name: react-patterns
description: "React 19 and Next.js 16 specific patterns, Strict Mode pitfalls, async cookies, useRef, useOptimistic, RSC boundaries"
---

# React 19 / Next.js 16 模式与陷阱

## useRef 需要初始值

React 19 中 `useRef()` 不接受零参数调用：

```ts
// ❌ 编译报错
const ref = useRef<AbortController>()

// ✅
const ref = useRef<AbortController | null>(null)
```

## 禁止在 useEffect cleanup 中 abort fetch

React 19 Strict Mode 在开发模式下会挂载 → 卸载 → 重新挂载每个组件。`[]` 依赖的 `useEffect` 的 cleanup 会在模拟卸载时执行，杀掉刚发出的请求：

```ts
// ❌ Strict Mode 下必然触发 abort，导致请求被中断
useEffect(() => {
  return () => { abortRef.current?.abort() }
}, [])

// ✅ 在 submitAction 内部管理 abortRef 即可
async function submitAction(...) {
  abortRef.current?.abort()  // 取消上一轮，不取消本轮
  const controller = new AbortController()
  abortRef.current = controller
  // ...
}
```

## Next.js 16 `cookies()` 是异步的

```ts
// ❌ Next 16 中返回 Promise，字符串拼接得到 "[object Promise]"
const theme = getThemeCookie(cookies().toString())

// ✅
const cookieStore = await cookies()
const theme = getThemeCookie(cookieStore.toString())
```

## RSC 不能读 localStorage

RSC（`app/layout.tsx`、`app/page.tsx` 等没有 `'use client'` 的文件）在服务端执行。`localStorage` 不可用。客户端数据读取必须下沉到 `'use client'` 岛屿中。

## `'use client'` 边界

当前项目的客户端岛屿（仅在这些文件中可以直接使用 React hooks、浏览器 API）：

- `src/components/GameScreen.tsx` — SSE 流消费、EventBus、AbortController
- `src/components/DialogueBox.tsx` — RAF 打字机、DOM ref
- `src/components/HomeIsland.tsx` — 菜单交互、存档管理
- `src/components/GameToolbar.tsx` — 工具栏（存档/加载 UI）
- `src/components/StatusPanel.tsx` — 侧边栏（属性/NPC/物品/旗标）
- `src/components/SystemSettings.tsx` — 设置面板
- `src/components/WorldCardSelector.tsx` — 世界卡选择
- `src/components/OptionsPanel.tsx` — 选项按钮 + 自由文本
- `src/components/WorldCreator.tsx` — 世界卡创作台
- `src/components/NPCPanel.tsx` — NPC 关系弹窗
- `src/components/AccountButton.tsx` — 账户登录按钮
- `src/components/GlobalButtons.tsx` — 全局按钮组
- `src/components/FlagPanel.tsx` — 旗标弹窗
- `src/components/InventoryPanel.tsx` — 物品栏弹窗
- `src/lib/*-context.tsx` — 所有 Context Provider

页面文件（`app/**/page.tsx`）和 `layout.tsx` 一般保持 RSC（无 `'use client'`）。`app/creator/page.tsx` 为例外，作为世界卡创作台的客户端岛屿。

## Fast Refresh 会重置 useRef

Turbopack 的 Fast Refresh 在代码变更时不保留 `useRef` 值。如果游戏正在进行中修改代码，`hasTriggeredRef.current` 会重置为 `false`，导致 `submitAction('开始冒险')` 重新触发。

这不是 bug — 不要在游戏进行中修改代码即可。如需修改，改完手动刷新浏览器。

## `useOptimistic` 必须在 transition 内调用

React 19 的 `useOptimistic` 返回的 setter 必须在 `startTransition`（或 `useTransition`）内部调用，否则控制台报错：

> An optimistic state update occurred outside a transition or action.

```tsx
// ❌ 直接调用
const handleSave = async () => {
  addOptimisticInfo({ ... })   // 警告：outside transition
  await saveGame()
}

// ✅ 用 useTransition 包裹
const [isPending, startTransition] = useTransition()

const handleSave = () => {
  startTransition(async () => {
    addOptimisticInfo({ ... })
    await saveGame()
  })
}
```

注意：`startTransition` 回调内的 `await` 之后的代码仍在 transition 上下文内，但闭包捕获的 state 值是调用时的快照，不会因中途 `setState` 而改变。如需在 `await` 后使用"旧" state，提前用局部变量捕获，意图更清晰：

```tsx
const slot = activeSaveSlot   // 闭包捕获当前值
startTransition(async () => {
  addOptimisticSlotInfo({ slot, ... })
  await saveGame(slot)
  setActiveSaveSlot(null)
  // slot 仍是原来的值，不受 setActiveSaveSlot(null) 影响
  const save = await loadSave(slot)
  setSlotInfos(prev => ({ ...prev, [slot]: save }))
})
```

## Zod v4 语法差异

```ts
// Zod v3
z.record(z.string())

// Zod v4 — 需要 keySchema + valueSchema
z.record(z.string(), z.string())
z.record(z.string(), z.number())
```

## Tailwind v4

项目使用 `@tailwindcss/postcss`（Tailwind v4），不再需要 `tailwind.config.js`。配置在 `app/globals.css` 中通过 `@import "tailwindcss"` 引入。

## Turbopack 缓存

遇到"模块找不到"但源码已修改的问题时，删除 `.next/` 目录后重启 `npm run dev`：

```bash
Remove-Item -Recurse -Force .next
npm run dev
```

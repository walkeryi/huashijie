# Code Review 验证：submitAction useCallback deps 不稳定

## 审查发现

> `submitAction` 的 `useCallback` deps 包含 `state`（每次 render 都是新引用），导致 `submitAction` 每帧重建；连锁使依赖 `submitAction` 的 useEffect (214-225) 每帧调度、OptionsPanel 即便 React.memo 也失效。

## 验证结论

| 维度 | 结论 |
|------|------|
| **isReal** | **true** — 真实问题，非误报 |
| **严重性** | 低 — 代码质量/性能问题，非功能性 bug |

## 证据链

### 1. `state` 每帧新引用 — 已确认

`game-context.tsx` 第 18-40 行，`useGame()` 内部直接创建对象字面量，无 `useMemo`：

```tsx
export function useGame() {
  const appConfig = useAppConfig()
  const playerState = usePlayerState()
  const gamePlay = useGamePlay()

  const state = {          // ← 每次调用 useGame() 都新建
    screen: playerState.state.screen,
    worldCard: playerState.state.worldCard,
    // ... 20+ 字段
  }
```

### 2. `actions` 同样每帧新引用 — 已确认

同文件第 120-155 行，`actions` 也是无 memo 的对象字面量：

```tsx
  const actions = {        // ← 每次调用 useGame() 都新建
    setApiKey: appConfig.setApiKey,
    startGame: (worldCard, playerName) => { ... },  // 内联箭头函数
    // ...
  }
```

### 3. `submitAction` 每帧重建 — 已确认

`GameScreen.tsx` 第 198 行：

```tsx
}, [state, actions])  // state 和 actions 每帧新引用 → submitAction 每帧重建
```

### 4. useEffect (214-225) 每帧触发 — 已确认

```tsx
useEffect(() => {
  if (!hasTriggeredRef.current && ...) {
    hasTriggeredRef.current = true
    submitAction('开始冒险')
  }
}, [state.screen, state.dialogueHistory.length, state.isLoading,
    state.currentOptions.length, submitAction])  // ← submitAction 每帧变化
```

**缓解因素**：`hasTriggeredRef.current` 守卫使内部逻辑只执行一次，所以 effect 虽然每帧调度但不会重复执行业务逻辑。性能浪费仅限于 React 的 diff 开销。

### 5. OptionsPanel React.memo 失效 — 理论成立，当前不适用

OptionsPanel **当前未使用 React.memo**（`export default function OptionsPanel`，无 memo 包裹）。但审查者的论断正确：即便加上 `React.memo`，`onSubmit={submitAction}` 每帧变化的引用也会使 memo 的浅比较失效。

## 修复建议

### 方案 A（推荐 — 改 useGame 源头）

在 `game-context.tsx` 中用 `useMemo` 稳定 `state` 和 `actions`：

```tsx
const state = useMemo(() => ({
  screen: playerState.state.screen,
  worldCard: playerState.state.worldCard,
  // ...
}), [playerState.state, gamePlay.state, appConfig.state])

const actions = useMemo(() => ({
  // ...
}), [appConfig.setApiKey, appConfig.setProvider, /* 列出稳定 deps */])
```

### 方案 B（GameScreen 内解构原始值）

```tsx
const worldCard = state.worldCard
const playerStateVal = state.playerState
const dialogueHistory = state.dialogueHistory
// ... 逐个提取

const submitAction = useCallback(async (optionText: string) => {
  // 使用闭包捕获的原始值/稳定引用
}, [worldCard, playerStateVal, dialogueHistory, apiKey, provider, model,
    customBaseURL, advancedParams, npcAffinities, npcRuntime, actions])
```

### 方案 C（ref 桥接 — 对 OptionsPanel 最实用）

```tsx
const submitActionRef = useRef(submitAction)
submitActionRef.current = submitAction

const stableSubmit = useCallback(
  (text: string) => submitActionRef.current(text),
  []  // 空 deps → 永远稳定
)

// 传给 OptionsPanel
<OptionsPanel onSubmit={stableSubmit} />
```

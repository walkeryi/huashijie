# 修复代码审查发现的问题

## 背景

代码审查（11 个文件，+196/-112 行 diff）发现 14 个问题，涵盖严重 bug、安全问题和维护性缺陷。本计划修复其中影响功能正确性的核心问题。

## 修复清单

### 1. 抽取共享 `createModelInstance()` factory（修复 #1 #2 #7 #10）

**文件：** `src/lib/create-model-instance.ts`（新建）

将两个 route 中重复的 4 层嵌套 ternary 提取为共享函数：

```ts
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

export function createModelInstance(opts: {
  provider?: string
  apiKey: string
  model?: string
  customBaseURL?: string
}) {
  const { provider, apiKey, model, customBaseURL } = opts
  if (provider === 'anthropic')
    return createAnthropic({ apiKey })(model || 'claude-sonnet-4-6')
  if (provider === 'deepseek')
    return createOpenAICompatible({ name: 'deepseek', apiKey, baseURL: 'https://api.deepseek.com/v1' })(model || 'deepseek-chat')
  if (provider === 'openai')
    return createOpenAI({ apiKey })(model || 'gpt-4o')
  // custom — 必须提供 baseURL，否则抛错
  if (!customBaseURL)
    throw new Error('自定义 Provider 需要填写 Base URL')
  return createOpenAICompatible({ name: 'custom', apiKey, baseURL: customBaseURL })(model || 'gpt-4o')
}
```

**同时修改：**
- `src/app/api/adventure/route.ts` — 删除 ternary，调用 `createModelInstance()`；`getApiKey` 按 provider 选择 env var
- `src/app/api/test-connection/route.ts` — 同上

**`getApiKey` 修复：** 按 provider 分别读取对应 env var，不再交叉兜底：
```ts
function getApiKey(provider?: string, apiKeyOverride?: string): string {
  if (apiKeyOverride) return apiKeyOverride
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY || ''
  return process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || ''
}
// 如果为空则由调用方处理错误
```

### 2. AbortError 恢复 `setLoading(false)`（修复 #4）

**文件：** `src/components/GameScreen.tsx` 第 180-183 行

```diff
  if (e instanceof DOMException && e.name === 'AbortError') {
    console.log('[GameScreen] 请求被中止 (AbortError)')
+   actions.setLoading(false)
    return
  }
```

### 3. DialogueBox `bufferRef` 回合重置（修复 #5）

**文件：** `src/components/DialogueBox.tsx`

在 `sharedEventBus.on` 回调中，当新回合开始（`isLoading` 从 false→true）时重置 bufferRef 和 charIndexRef：

```diff
  useEffect(() => {
+   // 新回合开始时重置打字机状态
+   if (!isLoading) {
+     bufferRef.current = ''
+     charIndexRef.current = 0
+   }
+ }, [isLoading])
+
+ useEffect(() => {
    const unsub = sharedEventBus.on((chunk) => {
```

### 4. 恢复 abort-on-unmount cleanup（修复 #6）

**文件：** `src/components/GameScreen.tsx`

在重定向 useEffect 之前恢复清理 effect：

```ts
// 组件卸载时取消进行中的请求
useEffect(() => {
  return () => { abortRef.current?.abort() }
}, [])
```

### 5. `readDataStream` signal 生效（修复 #8）

**文件：** `src/components/GameScreen.tsx` 第 14-39 行

在 readDataStream 循环中检查 signal：

```diff
  while (true) {
+   if (signal?.aborted) { reader.releaseLock(); return }
    const { done, value } = await reader.read()
```

### 6. LOAD_SAVE 重置 NPC 状态（修复 #13）

**文件：** `src/lib/player-state-context.tsx` 第 144-151 行

```diff
  case 'LOAD_SAVE':
    return {
      ...state,
      screen: 'playing',
      worldCard: action.worldCard,
      playerState: action.save.playerState,
      currentOptions: [],
+     npcAffinities: {},
+     npcRuntime: {},
    }
```

从 worldCard 重新初始化（同 START_GAME 逻辑）：
```ts
const npcAffinities: Record<string, number> = {}
action.worldCard.npcs.forEach(n => { npcAffinities[n.id] = n.fields.initialAffinity ?? 0 })
const npcRuntime: Record<string, RuntimeNPCState> = {}
action.worldCard.npcs.forEach(n => { npcRuntime[n.id] = { currentSelfPerception: '', currentState: '' } })
```

### 7. attributeDefs 注入到 reducer（修复 #3）

**文件：** `src/components/GameScreen.tsx` 第 123 行

AI tool call 路径缺少 `attributeDefs`，需要在调用 `updateState` 时手动注入：

```diff
  actions.updateState({
    ...(part.input as Record<string, unknown>),
+   attributeDefs: state.worldCard?.attributes ?? [],
  })
```

## 不修（低优先级 / 设计决策）

- **#9 API key 日志** — 调试阶段合理，后续可通过 `NODE_ENV` 守卫批量处理
- **#11 advancedParams reasoning/thinking** — 需要确认 AI SDK 是否支持这些参数，单独处理
- **#12 TS bypass cast** — 服务端 Zod 已保证安全，属类型洁癖
- **#14 DeepSeek URL /v1** — DeepSeek 两个路径都接受，无实际问题

## 验证

```bash
npx tsc --noEmit          # 类型检查
npm run test               # 运行测试
npm run build              # 生产构建
```

手动验证：
- Custom provider 不填 baseURL → 应显示明确错误而非 500
- 游戏中导航离开 → 不应有 console warning
- 多回合对话 → 打字机不应重复旧文本

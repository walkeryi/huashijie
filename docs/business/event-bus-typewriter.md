---
name: event-bus-typewriter
description: sharedEventBus 模块级单例（GameScreen 写入、DialogueBox 读取的契约）、RAF 驱动的逐字打字动画（buffer + charIndex + requestAnimationFrame）、客户端 SSE 解析器（readDataStream 本地实现）、AbortController 生命周期、降级兜底（AI 未调用 tool 时注入默认选项）
---

# 打字机效果与 EventBus

## 架构概览

打字机效果通过 EventBus 单例绕过 React 的 reconciliation 周期，SSE chunk 直接写入 DOM：

```
GameScreen: SSE chunk → sharedEventBus.append(chunk)
DialogueBox: sharedEventBus.on(chunk) → bufferRef += chunk
                                         → RAF 循环
                                         → currentDomRef.textContent = 累积文本
```

## sharedEventBus 单例

`src/lib/event-bus.ts` 导出 `sharedEventBus`（`createEventBus()` 返回的模块级实例）：

```ts
// event-bus.ts
export const sharedEventBus = createEventBus()
```

**GameScreen 和 DialogueBox 必须共用同一个 `sharedEventBus` 实例。** 如果各自调用 `createEventBus()` 会创建两个独立实例，GameScreen 写入的 chunk 永远到不了 DialogueBox。

### EventBus 接口

```ts
interface EventBus {
  on(listener: (chunk: string) => void): () => void  // 订阅，返回取消订阅函数
  append(chunk: string): void                          // 推送文本 chunk
  getFullText(): string                                // 获取累积的完整文本
  reset(): void                                        // 新回合开始时清空
  destroy(): void                                      // 清理所有监听器和缓存
}
```

## 客户端 SSE 解析

`src/components/GameScreen.tsx` 包含本地 SSE 解析器（生成器函数 `readDataStream`），因为 AI SDK v6 不再导出 `readDataStream`。

### readDataStream 实现

```ts
async function* readDataStream(
  body: ReadableStream<Uint8Array>,
  { signal }: { signal?: AbortController['signal'] } = {},
): AsyncGenerator<{ type: string; [key: string]: unknown }> {
  const decoder = new TextDecoder()
  const reader = body.getReader()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n')
      buffer = parts.pop() || ''
      for (const line of parts) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') return      // 终止标记
          try { yield JSON.parse(data) } catch { /* 跳过无效 JSON */ }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
```

关键实现细节：

1. **分帧逐行解析**：`decoder.decode(value, { stream: true })` 按帧累积字节，`split('\n')` 按行分割，未完成的行保留在 buffer 中等待下一帧
2. **`data: ` 前缀匹配**：只有以 `data: ` 开头的行才进入解析流程，其余行（如 `event:`、`:` 注释）全部跳过
3. **`[DONE]` 终止标记**：当遇到 `data: [DONE]` 时立即 `return`，结束生成器循环
4. **无效 JSON 静默跳过**：`try { yield JSON.parse(data) } catch {}` 保证非 JSON 行不中断流
5. **AsyncGenerator 函数签名**：`async function*` 返回 `AsyncGenerator`，调用方使用 `for await (const part of reader)` 消费

### 两次事件消费

`GameScreen` 主循环中两个独立的 `if` 分支按顺序处理事件：

```ts
for await (const part of reader) {
  // 第一次消费: text-delta → 打字机
  if (part.type === 'text-delta') {
    fullNarration += part.delta as string
    sharedEventBus.append(part.delta as string)
  }
  // 第二次消费: tool-input-available → 状态更新
  else if (part.type === 'tool-input-available' && part.toolName === 'update_state') {
    toolCallOccurred = true
    actions.updateState(part.input as Record<string, unknown>)
  }
  else if (part.type && part.type !== 'text-delta') {
    console.log('[GameScreen] SSE 其他事件:', part.type)
  }
}
```

- **`text-delta`**：AI 叙述文本，每次追加到 `fullNarration` 缓存并通过 `sharedEventBus.append()` 推送给打字机
- **`tool-input-available` (update_state)**：AI 工具调用，解析 `part.input` 后调用 `actions.updateState()` 更新 PlayerStateContext（options、属性变化等）
- **流控制事件**（`start` / `start-step` / `reasoning-*` / `text-start` / `text-end` / `finish-step` / `finish`）：仅日志记录，不做业务处理

### 降级兜底

如果 AI 没有调用 `update_state`（`toolCallOccurred === false`），注入三个默认选项：继续前进、仔细观察周围、与附近的人交谈。同时记录 console.warn。

## DialogueBox RAF 打字机

`src/components/DialogueBox.tsx` 通过 `useEffect` 订阅 `sharedEventBus`：

### 订阅逻辑

```ts
useEffect(() => {
  const unsub = sharedEventBus.on((chunk) => {
    bufferRef.current += chunk                    // 累积到 buffer
    if (!rafRef.current) {                        // 如果 RAF 未运行
      charIndexRef.current =                      // 从当前位置继续
        currentDomRef.current?.textContent?.length ?? 0
      startTyping()                                // 启动 RAF
    }
  })
  return () => { unsub() }
}, [startTyping])
```

### RAF 循环

```ts
const tick = () => {
  const full = bufferRef.current
  if (charIndexRef.current >= full.length) {
    rafRef.current = 0   // 暂停，等待下一个 chunk
    return
  }
  // 每帧 2-3 字符，积压 > 20 时加速到 3
  const charsPerFrame = 2 + (full.length - charIndexRef.current > 20 ? 1 : 0)
  charIndexRef.current = Math.min(charIndexRef.current + charsPerFrame, full.length)
  currentDomRef.current.textContent = full.slice(0, charIndexRef.current)
  rafRef.current = requestAnimationFrame(tick)
}
```

### 光标

纯 CSS 实现，与 JS 打字逻辑解耦：

```css
@keyframes blink { 50% { opacity: 0; } }
.animate-blink { animation: blink 1s step-end infinite; }
```

### 长列表优化

对话条目使用 CSS `content-visibility: auto`，屏幕外条目浏览器直接跳过渲染：

```css
.dialogue-entry { content-visibility: auto; contain-intrinsic-size: auto 80px; }
```

## 生命周期管理

### AbortController 生命周期

`GameScreen` 使用 `abortRef`（`useRef<AbortController | null>`) 管理请求生命周期：

```ts
const abortRef = useRef<AbortController | null>(null)

const submitAction = useCallback(async (optionText: string) => {
  // 取消上一轮未完成的流
  abortRef.current?.abort()

  const controller = new AbortController()
  abortRef.current = controller

  // ... fetch('/api/adventure', { signal: controller.signal })
}, [state, actions])
```

关键时序：

1. **用户提交选项 → `abortRef.current?.abort()`**：立即取消上一轮（如果有）仍在进行的 SSE 流，避免两轮流并行导致 dialogueHistory 错乱
2. **新建 AbortController → 赋值 `abortRef.current`**：新请求独占 signal
3. **fetch 传入 `signal: controller.signal`**：当外部调用 `abort()` 时，fetch 抛出的 `AbortError` 在 `catch` 中被捕获并静默处理（`return`，不显示错误 UI）
4. **请求自然结束**：SSE 流解析完毕或出错，controller 不再需要，等待下一轮 `submitAction` 覆盖

### 禁止 useEffect cleanup abort

**不要用 `useEffect(() => { return () => abort() }, [])` 做组件卸载清理。** React 19 Strict Mode 双重挂载会先 mount → unmount → remount，cleanup 中的 `abort()` 会把刚发出的请求杀掉。请求管理仅依赖 `submitAction` 内部的 abort。

### 组件卸载

组件卸载时不再显式调用 `abort()`。浏览器在页面离开时自动回收 TCP 连接，无需手动干预。`abortRef.current?.abort()` 在组件卸载逻辑中已删除。

## 相关文档
→ state-management.md：GameScreen/DialogueBox 通过 useGame() 消费三层 Context 数据
→ game-options-conditions.md：SSE 流结束后 tool-input-available 携带 options，800ms 后 OptionsPanel 显示
→ save-system.md：对话归档后触发防抖自动存档

## 边界
本文件覆盖 EventBus 单例、客户端 SSE 解析器和 RAF 驱动的打字机动画。
不覆盖：AI 如何生成流（见 ai-engine.md）、状态更新和对话归档（见 state-management.md）、存档触发（见 save-system.md）。

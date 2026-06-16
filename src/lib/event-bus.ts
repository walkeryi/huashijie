// src/lib/event-bus.ts

export type EventBusListener = (chunk: string) => void

export interface EventBus {
  /** 订阅文本 chunk 事件，返回取消订阅函数 */
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
  let destroyed = false

  return {
    on(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    append(chunk) {
      if (destroyed) return
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
      destroyed = true
      listeners.clear()
      buffer = ''
    },
  }
}

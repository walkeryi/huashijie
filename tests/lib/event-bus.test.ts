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

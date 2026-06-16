import { describe, it, expect } from 'vitest'
import { PRESET_NPC_FIELDS } from '../types'

// 注意：gameReducer / createInitialState 已随架构重构移除
// 新的三层 Context (AppConfig / PlayerState / GamePlay) 使用 useState setter
// 替代旧的单一 reducer 模式。以下仅保留对静态数据的测试。

describe('PRESET_NPC_FIELDS', () => {
  it('12 个静态预设字段符合 schema', () => {
    const fields = PRESET_NPC_FIELDS
    expect(fields).toHaveLength(12)
    fields.forEach(f => {
      expect(f).toHaveProperty('key')
      expect(f).toHaveProperty('label')
      expect(f).toHaveProperty('desc')
      expect(f).toHaveProperty('type')
      expect(f).toHaveProperty('fixed')
      expect(f).toHaveProperty('runtimeRequired')
      expect(f).toHaveProperty('nullable')
      expect(['string', 'string[]', 'boolean', 'number']).toContain(f.type)
    })
  })

  it('静态预设字段不含运行时字段 currentSelfPerception / currentState', () => {
    const keys = PRESET_NPC_FIELDS.map(f => f.key)
    expect(keys).not.toContain('currentSelfPerception')
    expect(keys).not.toContain('currentState')
  })
})

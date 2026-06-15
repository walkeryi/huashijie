import { describe, it, expect, beforeEach } from 'vitest'
import { listSaves, saveToSlot, autoSave, loadSave, deleteSave, getSaveSummary } from '../storage'
import { PlayerState, DialogueEntry } from '../types'

function makePlayerState(overrides?: Partial<PlayerState>): PlayerState {
  return {
    playerName: '测试者',
    attributes: { courage: 5 },
    flags: {},
    ...overrides,
  }
}

function makeDialogueHistory(): DialogueEntry[] {
  return [
    {
      id: 'n_1',
      role: 'narrator',
      content: '你站在城堡大门前。',
      timestamp: 1000,
    },
    {
      id: 'p_1',
      role: 'player',
      content: '推门进去',
      timestamp: 2000,
    },
  ]
}

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // ---- listSaves ----

  it('lists no saves when localStorage is empty', () => {
    const saves = listSaves()
    expect(saves).toHaveLength(0)
  })

  it('lists saved games sorted by newest first', () => {
    saveToSlot(1, 's1', '存档1', 'world_a', makePlayerState(), makeDialogueHistory())
    saveToSlot(2, 's2', '存档2', 'world_b', makePlayerState(), makeDialogueHistory())

    const saves = listSaves()
    expect(saves).toHaveLength(2)
    // 第二个保存的时间戳更新
    expect(saves[0].slotName).toBe('存档2')
    expect(saves[1].slotName).toBe('存档1')
  })

  // ---- saveToSlot ----

  it('persists a save to a numbered slot', () => {
    saveToSlot(1, 'id_1', '我的存档', 'world_x', makePlayerState(), makeDialogueHistory())

    const raw = localStorage.getItem('adventure_save_1')
    expect(raw).not.toBeNull()

    const parsed = JSON.parse(raw!)
    expect(parsed.slotName).toBe('我的存档')
    expect(parsed.worldCardId).toBe('world_x')
    expect(parsed.playerState.playerName).toBe('测试者')
    expect(parsed.dialogueHistory).toHaveLength(2)
  })

  it('overwrites an existing slot', () => {
    saveToSlot(1, 'id_a', '旧存档', 'world_a', makePlayerState(), [])
    saveToSlot(1, 'id_b', '新存档', 'world_b', makePlayerState(), [])

    const saves = listSaves()
    expect(saves).toHaveLength(1)
    expect(saves[0].slotName).toBe('新存档')
  })

  // ---- autoSave ----

  it('saves to the autosave key', () => {
    autoSave('world_z', makePlayerState(), makeDialogueHistory())

    const raw = localStorage.getItem('adventure_autosave')
    expect(raw).not.toBeNull()

    const parsed = JSON.parse(raw!)
    expect(parsed.slotName).toBe('自动存档')
    expect(parsed.worldCardId).toBe('world_z')
  })

  it('autosave appears in listSaves', () => {
    autoSave('world_x', makePlayerState(), makeDialogueHistory())
    const saves = listSaves()
    expect(saves).toHaveLength(1)
    expect(saves[0].slotName).toBe('自动存档')
  })

  // ---- loadSave ----

  it('loads a save by slot number', () => {
    saveToSlot(2, 'my_id', '测试档', 'world_test', makePlayerState(), makeDialogueHistory())

    const loaded = loadSave(2)
    expect(loaded).not.toBeNull()
    expect(loaded!.slotName).toBe('测试档')
    expect(loaded!.worldCardId).toBe('world_test')
  })

  it('loads the autosave by key', () => {
    autoSave('world_auto', makePlayerState(), makeDialogueHistory())

    const loaded = loadSave('autosave')
    expect(loaded).not.toBeNull()
    expect(loaded!.worldCardId).toBe('world_auto')
  })

  it('returns null for a nonexistent slot', () => {
    const loaded = loadSave(99)
    expect(loaded).toBeNull()
  })

  it('returns null for corrupted data', () => {
    localStorage.setItem('adventure_save_1', 'not valid json')

    const loaded = loadSave(1)
    expect(loaded).toBeNull()
  })

  // ---- deleteSave ----

  it('deletes a save from a slot', () => {
    saveToSlot(3, 'id', '待删除', 'world', makePlayerState(), [])

    expect(listSaves()).toHaveLength(1)

    deleteSave(3)

    expect(listSaves()).toHaveLength(0)
    expect(localStorage.getItem('adventure_save_3')).toBeNull()
  })

  // ---- getSaveSummary ----

  it('returns slot name and last dialogue snippet', () => {
    const save = {
      id: 's',
      slotName: '冒险1',
      timestamp: Date.now(),
      worldCardId: 'w',
      playerState: makePlayerState(),
      dialogueHistory: makeDialogueHistory(),
    }

    const summary = getSaveSummary(save)
    expect(summary).toContain('冒险1')
    // 取最后一条对话（玩家输入）
    expect(summary).toContain('推门进去')
  })

  it('shows "空存档" for empty dialogue history', () => {
    const save = {
      id: 's',
      slotName: '空白档',
      timestamp: Date.now(),
      worldCardId: 'w',
      playerState: makePlayerState(),
      dialogueHistory: [],
    }

    const summary = getSaveSummary(save)
    expect(summary).toContain('空存档')
  })
})

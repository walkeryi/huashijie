import { SaveData, SaveMeta, PlayerState, DialogueEntry } from './types'

const SAVE_PREFIX = 'adventure_save_'
const AUTO_SAVE_KEY = 'adventure_autosave'

/** 列出所有存档 */
export function localListSaves(): SaveData[] {
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
  try {
    const autoRaw = localStorage.getItem(AUTO_SAVE_KEY)
    if (autoRaw) saves.push(JSON.parse(autoRaw))
  } catch { /* ignore */ }
  return saves.sort((a, b) => b.timestamp - a.timestamp)
}

/** 列出存档元数据（轻量，不含 dialogueHistory） */
export function localListSaveMetas(): SaveMeta[] {
  const saves = localListSaves()
  return saves.map(s => {
    let slot = 0
    if (s.id === 'autosave') slot = 0
    else {
      for (let i = 1; i <= 3; i++) {
        const raw = localStorage.getItem(SAVE_PREFIX + i)
        if (raw) {
          try {
            if (JSON.parse(raw).id === s.id) { slot = i; break }
          } catch {}
        }
      }
    }
    return {
      slot,
      id: s.id,
      slotName: s.slotName,
      timestamp: s.timestamp,
      worldCardId: s.worldCardId,
      playerName: s.playerState?.playerName ?? '',
    }
  })
}

/** 保存到指定槽位（1-3） */
export function localSaveToSlot(
  slot: number,
  saveId: string,
  slotName: string,
  worldCardId: string,
  playerState: PlayerState,
  dialogueHistory: DialogueEntry[],
  apiKey: string,
  npcAffinities: Record<string, number>,
  npcRuntime: Record<string, import('./types').RuntimeNPCState>,
): void {
  if (typeof window === 'undefined') return
  const data: SaveData = {
    id: saveId,
    slotName,
    timestamp: Date.now(),
    worldCardId,
    playerState,
    dialogueHistory,
    memoryFacts: [],
    apiKey,
    npcAffinities,
    npcRuntime,
  }
  localStorage.setItem(SAVE_PREFIX + slot, JSON.stringify(data))
}

/** 自动存档 */
export function localAutoSave(
  worldCardId: string,
  playerState: PlayerState,
  dialogueHistory: DialogueEntry[],
  apiKey: string,
  npcAffinities: Record<string, number>,
  npcRuntime: Record<string, import('./types').RuntimeNPCState>,
): void {
  if (typeof window === 'undefined') return
  const data: SaveData = {
    id: 'autosave',
    slotName: '自动存档',
    timestamp: Date.now(),
    worldCardId,
    playerState,
    dialogueHistory,
    memoryFacts: [],
    apiKey,
    npcAffinities,
    npcRuntime,
  }
  localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(data))
}

/** 读取存档 */
export function localLoadSave(slotOrKey: number | string): SaveData | null {
  if (typeof window === 'undefined') return null
  let key: string
  if (typeof slotOrKey === 'number') {
    key = slotOrKey === 0 ? AUTO_SAVE_KEY : SAVE_PREFIX + slotOrKey
  } else {
    key = slotOrKey === 'autosave' ? AUTO_SAVE_KEY : SAVE_PREFIX + slotOrKey
  }
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** 删除存档 */
export function localDeleteSave(slot: number): void {
  if (typeof window === 'undefined') return
  const key = slot === 0 ? AUTO_SAVE_KEY : SAVE_PREFIX + slot
  localStorage.removeItem(key)
}

/** 清除所有存档 */
export function localClearAllSaves(): void {
  if (typeof window === 'undefined') return
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.startsWith(SAVE_PREFIX) || key === AUTO_SAVE_KEY)) {
      localStorage.removeItem(key)
      i--
    }
  }
}

/** 获取存档摘要文本 */
export function localGetSaveSummary(save: SaveData): string {
  const lastEntry = save.dialogueHistory[save.dialogueHistory.length - 1]
  const snippet = lastEntry
    ? lastEntry.content.slice(0, 60) + (lastEntry.content.length > 60 ? '…' : '')
    : '空存档'
  return `${save.slotName} — ${snippet}`
}

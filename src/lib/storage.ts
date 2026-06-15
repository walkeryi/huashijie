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
  apiKey: string,
): void {
  if (typeof window === 'undefined') return
  const data: SaveData = {
    id: saveId,
    slotName,
    timestamp: Date.now(),
    worldCardId,
    playerState,
    dialogueHistory,
    apiKey,
  }
  localStorage.setItem(SAVE_PREFIX + slot, JSON.stringify(data))
}

/** 自动存档 */
export function autoSave(
  worldCardId: string,
  playerState: PlayerState,
  dialogueHistory: DialogueEntry[],
  apiKey: string,
): void {
  if (typeof window === 'undefined') return
  const data: SaveData = {
    id: 'autosave',
    slotName: '自动存档',
    timestamp: Date.now(),
    worldCardId,
    playerState,
    dialogueHistory,
    apiKey,
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

/** 清除所有存档 */
export function clearAllSaves(): void {
  if (typeof window === 'undefined') return
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.startsWith(SAVE_PREFIX) || key === AUTO_SAVE_KEY)) {
      localStorage.removeItem(key)
      i-- // 删除后索引回退
    }
  }
}

/** 获取存档摘要文本 */
export function getSaveSummary(save: SaveData): string {
  const lastEntry = save.dialogueHistory[save.dialogueHistory.length - 1]
  const snippet = lastEntry
    ? lastEntry.content.slice(0, 60) + (lastEntry.content.length > 60 ? '…' : '')
    : '空存档'
  return `${save.slotName} — ${snippet}`
}

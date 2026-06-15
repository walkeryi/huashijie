import { SaveMode, SaveData, SaveMeta } from './types'
import * as local from './local-storage'
import * as online from './online-storage'

function getConfig(): { mode: SaveMode; accountName: string } {
  if (typeof window === 'undefined') return { mode: 'offline', accountName: '' }
  try {
    const raw = localStorage.getItem('adventure_save_config')
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { mode: 'offline', accountName: '' }
}

export function isOnline(): boolean {
  return getConfig().mode === 'online'
}

export function getAccountName(): string {
  return getConfig().accountName
}

/** 列出存档元数据 */
export async function listSaveMetas(): Promise<SaveMeta[]> {
  if (isOnline()) {
    const cfg = getConfig()
    return online.onlineListSaveMetas(cfg.accountName, getPassword())
  }
  return local.localListSaveMetas()
}

/** 保存到槽位 */
export async function saveToSlot(slot: number, data: SaveData): Promise<void> {
  if (isOnline()) {
    const cfg = getConfig()
    await online.onlineSaveToSlot(cfg.accountName, getPassword(), slot, data)
    return
  }
  local.localSaveToSlot(slot, data.id, data.slotName, data.worldCardId,
    data.playerState, data.dialogueHistory, data.apiKey)
}

/** 自动存档（在线失败时静默回退到本地） */
export async function autoSave(data: SaveData): Promise<void> {
  if (isOnline()) {
    try {
      const cfg = getConfig()
      await online.onlineSaveToSlot(cfg.accountName, getPassword(), 0, data)
      return
    } catch {
      console.warn('在线自动存档失败，回退到本地存档')
    }
  }
  local.localAutoSave(data.worldCardId, data.playerState, data.dialogueHistory, data.apiKey)
}

/** 加载完整存档 */
export async function loadSave(slot: number): Promise<SaveData | null> {
  if (isOnline()) {
    const cfg = getConfig()
    return online.onlineLoadSave(cfg.accountName, getPassword(), slot)
  }
  return local.localLoadSave(slot)
}

/** 删除存档 */
export async function deleteSave(slot: number): Promise<void> {
  if (isOnline()) {
    const cfg = getConfig()
    await online.onlineDeleteSave(cfg.accountName, getPassword(), slot)
    return
  }
  local.localDeleteSave(slot)
}

/** 从 localStorage 读取密码（仅用于 API 调用） */
function getPassword(): string {
  try {
    return localStorage.getItem('adventure_online_pwd') || ''
  } catch { return '' }
}

/** 保存密码到 localStorage */
export function savePassword(pwd: string): void {
  localStorage.setItem('adventure_online_pwd', pwd)
}

export function clearPassword(): void {
  localStorage.removeItem('adventure_online_pwd')
}

/** 切换模式 */
export function setMode(mode: SaveMode, accountName: string): void {
  localStorage.setItem('adventure_save_config', JSON.stringify({ mode, accountName }))
}

/** 获取模式配置 */
export function getModeConfig(): { mode: SaveMode; accountName: string } {
  return getConfig()
}

/** 迁移本地存档到在线 */
export async function migrateLocalToOnline(): Promise<{ success: boolean; count: number }> {
  const locals = local.localListSaves()
  if (locals.length === 0) return { success: true, count: 0 }

  const cfg = getConfig()
  const pwd = getPassword()
  const items = locals.map(s => {
    const slot = s.id === 'autosave' ? 0
      : (local.localListSaveMetas().find(m => m.id === s.id)?.slot ?? 1)
    return { slot, data: s }
  })

  try {
    const count = await online.onlineMigrateSaves(cfg.accountName, pwd, items)
    return { success: count > 0 || locals.length === 0, count }
  } catch {
    return { success: false, count: 0 }
  }
}

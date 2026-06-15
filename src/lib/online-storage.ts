import { SaveData, SaveMeta } from './types'

const API_BASE = '/api/saves'

async function apiCall<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || '请求失败')
  return data as T
}

/** 注册 */
export async function onlineRegister(name: string, password: string): Promise<void> {
  await apiCall('/register', { name, password })
}

/** 登录 */
export async function onlineLogin(name: string, password: string): Promise<void> {
  await apiCall('/login', { name, password })
}

/** 列出存档元数据 */
export async function onlineListSaveMetas(name: string, password: string): Promise<SaveMeta[]> {
  const data = await apiCall<{ saves: SaveMeta[] }>('/list', { name, password })
  return data.saves
}

/** 保存到槽位 */
export async function onlineSaveToSlot(
  name: string, password: string, slot: number, save: SaveData
): Promise<void> {
  // apiKey 不上传服务器
  await apiCall('/save', { name, password, slot, save: { ...save, apiKey: '' } })
}

/** 读取完整存档 */
export async function onlineLoadSave(name: string, password: string, slot: number): Promise<SaveData | null> {
  try {
    const data = await apiCall<{ save: SaveData }>('/load', { name, password, slot })
    return data.save
  } catch {
    return null
  }
}

/** 删除存档 */
export async function onlineDeleteSave(name: string, password: string, slot: number): Promise<void> {
  await apiCall('/delete', { name, password, slot })
}

/** 批量迁移本地存档到云端 */
export async function onlineMigrateSaves(
  name: string, password: string, saves: Array<{ slot: number; data: SaveData }>
): Promise<number> {
  let count = 0
  for (const { slot, data } of saves) {
    try {
      await onlineSaveToSlot(name, password, slot, data)
      count++
    } catch {
      // 单个失败继续
    }
  }
  return count
}

/** 检查服务器连通性 */
export async function onlineCheckConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '__ping__', password: '__ping__' }),
    })
    const data = await res.json()
    // 只要能连上服务器就算成功（即使登录失败）
    return true
  } catch {
    return false
  }
}

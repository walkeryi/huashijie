# 在线/离线双模式存档系统 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为话世界添加在线/离线双模式存档系统，支持账户注册登录、云端 JSON 文件存储、本地存档迁移。

**Architecture:** save-service.ts 作为统一外观层，根据模式路由到 local-storage.ts（同步 localStorage）或 online-storage.ts（fetch → /api/saves/*）。服务端用文件系统 JSON 存储，无数据库。

**Tech Stack:** Next.js 16 (App Router), TypeScript, React 19, PM2, Node.js 20

---

### Task 1: 类型定义

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: 新增存档模式相关类型**

在 `src/lib/types.ts` 末尾追加以下类型：

```typescript
// ========== 存档模式 ==========

export type SaveMode = 'offline' | 'online'

/** 存储模式配置，持久化在 localStorage key: 'adventure_save_config' */
export interface SaveModeConfig {
  mode: SaveMode
  accountName: string
}

/** 存档元数据（列表用，不含对话历史和 apiKey） */
export interface SaveMeta {
  slot: number
  id: string
  slotName: string
  timestamp: number
  worldCardId: string
  playerName: string
}
```

- [ ] **Step 2: 在 GameState 末尾追加字段**

在 `GameState` 接口末尾追加：

```typescript
  saveMode: SaveMode
  accountName: string
```

- [ ] **Step 3: 在 GameAction 类型末尾追加 action**

在 `GameAction` 联合类型末尾追加：

```typescript
  | { type: 'SET_SAVE_MODE'; mode: SaveMode; accountName: string }
```

- [ ] **Step 4: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 提交**

```bash
git add src/lib/types.ts
git commit -m "feat: 新增 SaveMode、SaveMeta、在线模式相关类型"
```

---

### Task 2: 离线存储模块

**Files:**
- Create: `src/lib/local-storage.ts`
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: 创建 local-storage.ts**

将 `storage.ts` 的完整内容复制为 `src/lib/local-storage.ts`，修改函数名为 `local` 前缀，并新增 `localListSaveMetas`：

```typescript
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
  const slotMap: Record<string, number> = {
    'adventure_save_1': 1, 'adventure_save_2': 2, 'adventure_save_3': 3,
    'adventure_autosave': 0,
  }
  return saves.map(s => {
    let slot = 0
    if (s.id === 'autosave') slot = 0
    else if (s.id.startsWith('save_')) {
      // id format: save_1234567890, stored in slot determined by key
      // Find which localStorage key holds this save
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
export function localAutoSave(
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
export function localLoadSave(slotOrKey: number | string): SaveData | null {
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
export function localDeleteSave(slot: number): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SAVE_PREFIX + slot)
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
```

- [ ] **Step 2: 修改 storage.ts 为 re-export**

将 `src/lib/storage.ts` 的内容替换为：

```typescript
// 向后兼容：所有函数从 local-storage 重新导出
export {
  localListSaves as listSaves,
  localSaveToSlot as saveToSlot,
  localAutoSave as autoSave,
  localLoadSave as loadSave,
  localDeleteSave as deleteSave,
  localClearAllSaves as clearAllSaves,
  localGetSaveSummary as getSaveSummary,
} from './local-storage'
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add src/lib/local-storage.ts src/lib/storage.ts
git commit -m "refactor: 拆分 local-storage 模块，storage.ts 改为 re-export"
```

---

### Task 3: 服务端存储工具

**Files:**
- Create: `src/lib/server-save-utils.ts`

- [ ] **Step 1: 创建服务端文件操作工具**

创建 `src/lib/server-save-utils.ts`：

```typescript
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const DATA_ROOT = process.env.DATA_ROOT || path.join(process.cwd(), 'data')
const SAVES_DIR = path.join(DATA_ROOT, 'saves')

function hashName(name: string): string {
  return crypto.createHash('md5').update(name).digest('hex')
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

function readJSON<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
  } catch {
    return null
  }
}

function writeJSON(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath)
  ensureDir(dir)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export interface AccountData {
  name: string
  passwordHash: string
  createdAt: number
}

export interface SaveIndex {
  accountName: string
  updatedAt: number
  slots: Array<{
    slot: number
    id: string
    slotName: string
    timestamp: number
    worldCardId: string
    playerName: string
  }>
}

/** 验证账户名密码，返回是否通过 */
export function verifyAccount(name: string, password: string): boolean {
  const dir = path.join(SAVES_DIR, hashName(name))
  const accountFile = path.join(dir, 'account.json')
  const account = readJSON<AccountData>(accountFile)
  if (!account) return false
  const inputHash = crypto.createHash('md5').update(password).digest('hex')
  return account.passwordHash === inputHash
}

/** 注册新账户，已存在则返回 false */
export function registerAccount(name: string, password: string): boolean {
  const dir = path.join(SAVES_DIR, hashName(name))
  const accountFile = path.join(dir, 'account.json')
  if (fs.existsSync(accountFile)) return false
  const account: AccountData = {
    name,
    passwordHash: crypto.createHash('md5').update(password).digest('hex'),
    createdAt: Date.now(),
  }
  writeJSON(accountFile, account)
  return true
}

/** 读取存档索引 */
export function readSaveIndex(name: string): SaveIndex | null {
  const dir = path.join(SAVES_DIR, hashName(name))
  return readJSON<SaveIndex>(path.join(dir, 'index.json'))
}

/** 写入存档索引 */
export function writeSaveIndex(name: string, index: SaveIndex): void {
  const dir = path.join(SAVES_DIR, hashName(name))
  writeJSON(path.join(dir, 'index.json'), index)
}

/** 读取完整存档数据 */
export function readSaveData(name: string, slot: number): unknown | null {
  const dir = path.join(SAVES_DIR, hashName(name))
  return readJSON(path.join(dir, `${slot}.json`))
}

/** 写入存档数据 */
export function writeSaveData(name: string, slot: number, data: unknown): void {
  const dir = path.join(SAVES_DIR, hashName(name))
  ensureDir(dir)
  writeJSON(path.join(dir, `${slot}.json`), data)
}

/** 删除存档数据 */
export function deleteSaveData(name: string, slot: number): void {
  const dir = path.join(SAVES_DIR, hashName(name))
  const file = path.join(dir, `${slot}.json`)
  if (fs.existsSync(file)) fs.unlinkSync(file)
}

/** 获取玩家目录路径 */
export function getPlayerDir(name: string): string {
  return path.join(SAVES_DIR, hashName(name))
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/server-save-utils.ts
git commit -m "feat: 服务端 JSON 文件存取工具"
```

---

### Task 4: API 路由

**Files:**
- Create: `src/app/api/saves/register/route.ts`
- Create: `src/app/api/saves/login/route.ts`
- Create: `src/app/api/saves/list/route.ts`
- Create: `src/app/api/saves/save/route.ts`
- Create: `src/app/api/saves/load/route.ts`
- Create: `src/app/api/saves/delete/route.ts`

- [ ] **Step 1: 注册接口**

创建 `src/app/api/saves/register/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { registerAccount } from '@/lib/server-save-utils'

export async function POST(request: NextRequest) {
  try {
    const { name, password } = await request.json()
    if (!name || !password) {
      return NextResponse.json({ ok: false, error: '账户名和密码不能为空' }, { status: 400 })
    }
    if (name.length > 50 || password.length > 100) {
      return NextResponse.json({ ok: false, error: '账户名或密码过长' }, { status: 400 })
    }
    const ok = registerAccount(name.trim(), password)
    if (!ok) {
      return NextResponse.json({ ok: false, error: '账户已存在' }, { status: 409 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: '服务器错误' }, { status: 500 })
  }
}
```

- [ ] **Step 2: 登录接口**

创建 `src/app/api/saves/login/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyAccount } from '@/lib/server-save-utils'

export async function POST(request: NextRequest) {
  try {
    const { name, password } = await request.json()
    if (!name || !password) {
      return NextResponse.json({ ok: false, error: '账户名和密码不能为空' }, { status: 400 })
    }
    const ok = verifyAccount(name.trim(), password)
    if (!ok) {
      return NextResponse.json({ ok: false, error: '账户不存在或密码错误' }, { status: 401 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: '服务器错误' }, { status: 500 })
  }
}
```

- [ ] **Step 3: 列出存档接口**

创建 `src/app/api/saves/list/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyAccount, readSaveIndex } from '@/lib/server-save-utils'

export async function POST(request: NextRequest) {
  try {
    const { name, password } = await request.json()
    if (!name || !password) {
      return NextResponse.json({ ok: false, error: '账户名和密码不能为空' }, { status: 400 })
    }
    if (!verifyAccount(name, password)) {
      return NextResponse.json({ ok: false, error: '账户不存在或密码错误' }, { status: 401 })
    }
    const index = readSaveIndex(name)
    return NextResponse.json({ ok: true, saves: index?.slots ?? [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: '服务器错误' }, { status: 500 })
  }
}
```

- [ ] **Step 4: 保存接口**

创建 `src/app/api/saves/save/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyAccount, readSaveIndex, writeSaveIndex, writeSaveData, SaveIndex } from '@/lib/server-save-utils'
import { SaveMeta } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const { name, password, slot, save } = await request.json()
    if (!name || !password || slot === undefined || !save) {
      return NextResponse.json({ ok: false, error: '缺少必要字段' }, { status: 400 })
    }
    if (!verifyAccount(name, password)) {
      return NextResponse.json({ ok: false, error: '账户不存在或密码错误' }, { status: 401 })
    }

    // 写入完整存档，但 apiKey 置空
    const safeSave = { ...save, apiKey: '' }
    writeSaveData(name, slot, safeSave)

    // 更新索引
    const index = readSaveIndex(name) || { accountName: name, updatedAt: 0, slots: [] }
    const meta: SaveMeta = {
      slot,
      id: save.id || ('save_' + Date.now()),
      slotName: save.slotName || `存档 ${slot}`,
      timestamp: save.timestamp || Date.now(),
      worldCardId: save.worldCardId || '',
      playerName: save.playerState?.playerName || '',
    }
    index.slots = index.slots.filter(s => s.slot !== slot)
    index.slots.push(meta)
    index.updatedAt = Date.now()
    writeSaveIndex(name, index)

    return NextResponse.json({ ok: true, timestamp: Date.now() })
  } catch (e) {
    return NextResponse.json({ ok: false, error: '服务器错误' }, { status: 500 })
  }
}
```

- [ ] **Step 5: 读取接口**

创建 `src/app/api/saves/load/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyAccount, readSaveData } from '@/lib/server-save-utils'

export async function POST(request: NextRequest) {
  try {
    const { name, password, slot } = await request.json()
    if (!name || !password || slot === undefined) {
      return NextResponse.json({ ok: false, error: '缺少必要字段' }, { status: 400 })
    }
    if (!verifyAccount(name, password)) {
      return NextResponse.json({ ok: false, error: '账户不存在或密码错误' }, { status: 401 })
    }
    const save = readSaveData(name, slot)
    if (!save) {
      return NextResponse.json({ ok: false, error: '存档不存在' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, save })
  } catch (e) {
    return NextResponse.json({ ok: false, error: '服务器错误' }, { status: 500 })
  }
}
```

- [ ] **Step 6: 删除接口**

创建 `src/app/api/saves/delete/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyAccount, readSaveIndex, writeSaveIndex, deleteSaveData } from '@/lib/server-save-utils'

export async function POST(request: NextRequest) {
  try {
    const { name, password, slot } = await request.json()
    if (!name || !password || slot === undefined) {
      return NextResponse.json({ ok: false, error: '缺少必要字段' }, { status: 400 })
    }
    if (!verifyAccount(name, password)) {
      return NextResponse.json({ ok: false, error: '账户不存在或密码错误' }, { status: 401 })
    }
    deleteSaveData(name, slot)
    const index = readSaveIndex(name)
    if (index) {
      index.slots = index.slots.filter(s => s.slot !== slot)
      index.updatedAt = Date.now()
      writeSaveIndex(name, index)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: '服务器错误' }, { status: 500 })
  }
}
```

- [ ] **Step 7: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: 提交**

```bash
git add src/app/api/saves/
git commit -m "feat: 在线存档 API 路由（register/login/list/save/load/delete）"
```

---

### Task 5: 在线存储客户端

**Files:**
- Create: `src/lib/online-storage.ts`

- [ ] **Step 1: 创建在线存储模块**

创建 `src/lib/online-storage.ts`：

```typescript
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
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/online-storage.ts
git commit -m "feat: 在线存档客户端 fetch 封装"
```

---

### Task 6: 统一存档服务

**Files:**
- Create: `src/lib/save-service.ts`

- [ ] **Step 1: 创建统一外观层**

创建 `src/lib/save-service.ts`：

```typescript
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

/** 从 localStorage 读取密码（仅用于 API 调用，不持久化明文到其他存储） */
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
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/save-service.ts
git commit -m "feat: 统一存档服务外观层，路由离线/在线模式"
```

---

### Task 7: 游戏上下文适配

**Files:**
- Modify: `src/lib/game-context.tsx`

- [ ] **Step 1: 修改 import**

将 `game-context.tsx` 顶部的 import 部分替换：

```typescript
'use client'

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  GameState, GameAction, WorldCard, AIResponse, SaveData, DialogueEntry, PlayerState, AttributeDef,
} from './types'
import * as saveService from './save-service'
```

- [ ] **Step 2: 修改 createInitialState**

```typescript
function loadSaveModeConfig(): { saveMode: GameState['saveMode']; accountName: string } {
  const cfg = saveService.getModeConfig()
  return { saveMode: cfg.mode, accountName: cfg.accountName }
}

export function createInitialState(): GameState {
  const saved = loadApiConfig()
  const saveCfg = loadSaveModeConfig()
  return {
    screen: 'menu',
    worldCard: null,
    playerState: null,
    dialogueHistory: [],
    currentOptions: [],
    currentNarration: '',
    isLoading: false,
    error: null,
    saveSlots: [],
    apiKey: saved.apiKey,
    provider: saved.provider,
    model: saved.model,
    customBaseURL: saved.customBaseURL,
    npcAffinities: {},
    saveMode: saveCfg.saveMode,
    accountName: saveCfg.accountName,
  }
}
```

- [ ] **Step 3: 在 reducer 中添加 SET_SAVE_MODE case**

在 `RETURN_TO_MENU` case 之前添加：

```typescript
    case 'SET_SAVE_MODE':
      return { ...state, saveMode: action.mode, accountName: action.accountName }
```

- [ ] **Step 4: 修改 refreshSaves 为异步**

将原来的同步 `refreshSaves` 替换为：

```typescript
  const refreshSaves = useCallback(async () => {
    try {
      const metas = await saveService.listSaveMetas()
      const saves: SaveData[] = metas.map(m => ({
        id: m.id,
        slotName: m.slotName,
        timestamp: m.timestamp,
        worldCardId: m.worldCardId,
        playerState: { playerName: m.playerName, attributes: {}, flags: {}, inventory: [] },
        dialogueHistory: [],
        apiKey: '',
      }))
      dispatch({ type: 'REFRESH_SAVES', saves })
    } catch {
      // 列存档失败，保持现有列表
    }
  }, [])
```

- [ ] **Step 5: 修改 saveGame 为异步**

```typescript
  const saveGame = useCallback(async (slot: number, name: string) => {
    const current = stateRef.current
    if (!current.worldCard || !current.playerState) return
    const data: SaveData = {
      id: 'save_' + Date.now(),
      slotName: name,
      timestamp: Date.now(),
      worldCardId: current.worldCard.id,
      playerState: current.playerState,
      dialogueHistory: current.dialogueHistory,
      apiKey: current.apiKey,
    }
    try {
      await saveService.saveToSlot(slot, data)
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: '存档失败，请检查网络连接' })
    }
    await refreshSaves()
  }, [refreshSaves])
```

- [ ] **Step 6: 修改 deleteGame 为异步**

```typescript
  const deleteGame = useCallback(async (slot: number) => {
    try {
      await saveService.deleteSave(slot)
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: '删除失败，请检查网络连接' })
    }
    await refreshSaves()
  }, [refreshSaves])
```

- [ ] **Step 7: 修改 submitAction 中的 autoSave**

将 `submitAction` 中底部的 autoSave 调用：

```typescript
  autoSave(current.worldCard.id, updatedPlayer, fullHistory, current.apiKey)
```

替换为：

```typescript
  const saveData: SaveData = {
    id: 'autosave',
    slotName: '自动存档',
    timestamp: Date.now(),
    worldCardId: current.worldCard.id,
    playerState: updatedPlayer,
    dialogueHistory: fullHistory,
    apiKey: current.apiKey,
  }
  saveService.autoSave(saveData).catch(() => {})
```

- [ ] **Step 8: 添加 saveMode 相关 actions**

在 `actions` 对象中新增：

```typescript
    setSaveMode: (mode: 'offline' | 'online', accountName: string) => {
      dispatch({ type: 'SET_SAVE_MODE', mode, accountName })
    },
```

- [ ] **Step 9: 更新 useMemo 依赖和接口**

在 `useMemo` 依赖数组中追加相关的 state 字段，并在 `GameContextValue` 的 `actions` 类型中添加 `setSaveMode`。

- [ ] **Step 10: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 11: 提交**

```bash
git add src/lib/game-context.tsx
git commit -m "feat: game-context 适配异步存档和在线/离线模式"
```

---

### Task 8: 设置面板 UI（"存储"标签页）

**Files:**
- Modify: `src/components/SystemSettings.tsx`

- [ ] **Step 1: 重构 SystemSettings 为标签页模式**

将 SystemSettings.tsx 完整替换。核心改动：
- 添加 [API] [存储] 标签切换
- "存储"标签包含：模式选择（离线/在线）、账户名输入、密码输入、注册/登录按钮、登录状态、迁移按钮

```typescript
'use client'

import { useState } from 'react'
import { useGame } from '@/lib/game-context'
import * as saveService from '@/lib/save-service'
import { onlineRegister, onlineLogin } from '@/lib/online-storage'
import { localListSaves } from '@/lib/local-storage'

type TabType = 'api' | 'storage'

export default function SystemSettings() {
  const { state, actions } = useGame()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabType>('api')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState('')

  // 存储标签状态
  const [accountName, setAccountName] = useState(saveService.getModeConfig().accountName)
  const [password, setPassword] = useState('')
  const [storageStatus, setStorageStatus] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(
    saveService.isOnline() && !!saveService.getAccountName()
  )
  const [migrating, setMigrating] = useState(false)
  const [localSaveCount, setLocalSaveCount] = useState(0)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-lg"
        title="系统设置"
      >
        ⚙️
      </button>
    )
  }

  // ... API 标签的 test connection 逻辑（保持不变）...

  const handleRegister = async () => {
    if (!accountName.trim() || !password) {
      setStorageStatus('请填写账户名和密码')
      return
    }
    setStorageStatus('注册中...')
    try {
      await onlineRegister(accountName.trim(), password)
      saveService.savePassword(password)
      saveService.setMode('online', accountName.trim())
      actions.setSaveMode('online', accountName.trim())
      setIsLoggedIn(true)
      setStorageStatus('✅ 注册成功，已登录')
      // 检查本地存档
      const count = localListSaves().length
      setLocalSaveCount(count)
    } catch (e: any) {
      setStorageStatus('❌ ' + (e.message || '注册失败'))
    }
  }

  const handleLogin = async () => {
    if (!accountName.trim() || !password) {
      setStorageStatus('请填写账户名和密码')
      return
    }
    setStorageStatus('登录中...')
    try {
      await onlineLogin(accountName.trim(), password)
      saveService.savePassword(password)
      saveService.setMode('online', accountName.trim())
      actions.setSaveMode('online', accountName.trim())
      setIsLoggedIn(true)
      setStorageStatus('✅ 登录成功')
      const count = localListSaves().length
      setLocalSaveCount(count)
    } catch (e: any) {
      setStorageStatus('❌ ' + (e.message || '登录失败'))
    }
  }

  const handleLogout = () => {
    saveService.setMode('offline', '')
    saveService.clearPassword()
    actions.setSaveMode('offline', '')
    setIsLoggedIn(false)
    setAccountName('')
    setPassword('')
    setStorageStatus('已退出登录')
    setLocalSaveCount(0)
  }

  const handleMigrate = async () => {
    setMigrating(true)
    setStorageStatus('迁移中...')
    try {
      const result = await saveService.migrateLocalToOnline()
      if (result.success) {
        setStorageStatus(`✅ 已迁移 ${result.count} 个存档`)
        setLocalSaveCount(0)
      } else {
        setStorageStatus('❌ 迁移失败，请重试')
      }
    } catch {
      setStorageStatus('❌ 迁移失败')
    } finally {
      setMigrating(false)
    }
  }

  const handleSwitchOffline = () => {
    saveService.setMode('offline', '')
    saveService.clearPassword()
    actions.setSaveMode('offline', '')
    setIsLoggedIn(false)
    setStorageStatus('')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('api')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                tab === 'api' ? 'bg-[var(--accent)] text-[var(--bg-primary)]' : 'text-[var(--text-secondary)]'
              }`}
            >API</button>
            <button
              onClick={() => { setTab('storage'); setLocalSaveCount(localListSaves().length) }}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                tab === 'storage' ? 'bg-[var(--accent)] text-[var(--bg-primary)]' : 'text-[var(--text-secondary)]'
              }`}
            >存储</button>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >✕</button>
        </div>

        {tab === 'api' && (
          <>
            {/* 原有 API Key、提供商、模型、测试连接 UI — 保持不变 */}
            <div className="mb-3">
              <label className="block text-sm text-[var(--text-secondary)] mb-1">API Key</label>
              <input
                type="password"
                value={state.apiKey}
                onChange={e => actions.setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
              />
            </div>
            <div className="mb-3 flex gap-2">
              <div className="flex-1">
                <label className="block text-sm text-[var(--text-secondary)] mb-1">提供商</label>
                <select
                  value={state.provider}
                  onChange={e => {
                    const p = e.target.value as 'anthropic' | 'openai' | 'deepseek' | 'custom'
                    actions.setProvider(p)
                    const defaults: Record<string, string> = { anthropic: 'claude-sonnet-4-6', openai: 'gpt-4o', deepseek: 'deepseek-chat', custom: '' }
                    actions.setModel(defaults[p])
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)]"
                >
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div className="flex-[2]">
                <label className="block text-sm text-[var(--text-secondary)] mb-1">模型名</label>
                <input
                  type="text"
                  value={state.model}
                  onChange={e => actions.setModel(e.target.value)}
                  placeholder="模型名"
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
                />
              </div>
            </div>
            {state.provider === 'custom' && (
              <div className="mb-3">
                <label className="block text-sm text-[var(--text-secondary)] mb-1">API 地址</label>
                <input
                  type="text"
                  value={state.customBaseURL}
                  onChange={e => actions.setCustomBaseURL(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
                />
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={handleTest}
                disabled={testStatus === 'testing'}
                className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50"
              >
                {testStatus === 'testing' ? '⏳ 测试中...' : '🧪 测试连接'}
              </button>
              {testMessage && (
                <span className={`text-sm ${testStatus === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{testMessage}</span>
              )}
            </div>
          </>
        )}

        {tab === 'storage' && (
          <>
            {/* 模式选择 */}
            <div className="mb-4">
              <label className="block text-sm text-[var(--text-secondary)] mb-2">存档模式</label>
              <div className="flex gap-2">
                <button
                  onClick={handleSwitchOffline}
                  className={`flex-1 py-2 rounded-xl text-sm border transition-colors ${
                    !isLoggedIn
                      ? 'border-[var(--accent)] bg-[var(--bg-card)] text-[var(--text-primary)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)]'
                  }`}
                >
                  💾 离线模式
                </button>
                <button
                  className={`flex-1 py-2 rounded-xl text-sm border transition-colors ${
                    isLoggedIn
                      ? 'border-[var(--accent)] bg-[var(--bg-card)] text-[var(--text-primary)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)]'
                  }`}
                >
                  ☁️ 在线模式
                </button>
              </div>
            </div>

            {/* 在线模式登录区域 */}
            {!isLoggedIn ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">账户名</label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={e => setAccountName(e.target.value)}
                    placeholder="输入账户名"
                    maxLength={50}
                    className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">密码</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="输入密码"
                    maxLength={100}
                    className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRegister}
                    className="flex-1 py-2 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
                  >注册</button>
                  <button
                    onClick={handleLogin}
                    className="flex-1 py-2 rounded-xl border border-[var(--accent)] text-[var(--accent)] text-sm font-medium hover:bg-[var(--bg-card)] transition-colors"
                  >登录</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-400">✅</span>
                  <span className="text-[var(--text-primary)]">已登录: {state.accountName}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full py-2 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-sm hover:border-red-800 hover:text-red-400 transition-colors"
                >退出登录</button>

                {localSaveCount > 0 && (
                  <div className="pt-2 border-t border-[var(--border)]">
                    <p className="text-sm text-[var(--text-secondary)] mb-2">
                      检测到 {localSaveCount} 个本地存档
                    </p>
                    <button
                      onClick={handleMigrate}
                      disabled={migrating}
                      className="w-full py-2 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                    >
                      {migrating ? '迁移中...' : '☁️ 迁移到云端'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {storageStatus && (
              <p className="mt-3 text-sm text-[var(--text-secondary)]">{storageStatus}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/components/SystemSettings.tsx
git commit -m "feat: 设置面板新增"存储"标签，支持在线模式注册/登录/迁移"
```

---

### Task 9: 状态面板 UI 适配

**Files:**
- Modify: `src/components/StatusPanel.tsx`

- [ ] **Step 1: 修改 import**

将：

```typescript
import { loadSave } from '@/lib/storage'
```

替换为：

```typescript
import * as saveService from '@/lib/save-service'
```

- [ ] **Step 2: 槽位信息改为异步加载**

在组件中添加 state：

```typescript
  const [slotInfos, setSlotInfos] = useState<Record<number, { slotName: string; timestamp: number } | null>>({})
  const [loadingSlots, setLoadingSlots] = useState(false)
```

添加异步加载 effect：

```typescript
  useEffect(() => {
    if (showSaveUI) {
      setLoadingSlots(true)
      const loadSlots = async () => {
        const infos: Record<number, { slotName: string; timestamp: number } | null> = {}
        for (const slot of [1, 2, 3]) {
          const save = await saveService.loadSave(slot)
          infos[slot] = save ? { slotName: save.slotName, timestamp: save.timestamp } : null
        }
        setSlotInfos(infos)
        setLoadingSlots(false)
      }
      loadSlots()
    }
  }, [showSaveUI])
```

- [ ] **Step 3: 修改保存按钮的模式图标**

将存档按钮文字：

```typescript
>💾 存档</button>
```

替换为（根据模式显示不同图标）：

```typescript
>{saveService.isOnline() ? '☁️' : '💾'} 存档</button>
```

- [ ] **Step 4: 修改槽位渲染，使用异步数据**

将 `loadSave(slot)` 替换为 `slotInfos[slot]`：

```typescript
{[1, 2, 3].map((slot) => {
  const slotInfo = slotInfos[slot]
  // ... 其余逻辑不变
})}
```

添加加载状态：

```typescript
{loadingSlots && <p className="text-xs text-[var(--text-secondary)]">加载中...</p>}
```

- [ ] **Step 5: 修改保存确认回调为异步**

```typescript
  const handleSaveConfirm = async () => {
    if (activeSaveSlot === null) return
    const name = saveNameInput.trim() || `存档 ${activeSaveSlot}`
    await actions.saveGame(activeSaveSlot, name)
    setActiveSaveSlot(null)
    setSaveNameInput('')
    // 刷新槽位信息
    const save = await saveService.loadSave(activeSaveSlot)
    setSlotInfos(prev => ({ ...prev, [activeSaveSlot]: save ? { slotName: save.slotName, timestamp: save.timestamp } : null }))
  }
```

- [ ] **Step 6: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: 提交**

```bash
git add src/components/StatusPanel.tsx
git commit -m "feat: StatusPanel 适配异步存档，显示在线/离线模式图标"
```

---

### Task 10: 首页读档面板适配 + 删除存档改为调用 saveService

**Files:**
- Modify: `src/components/WorldCardSelector.tsx`

- [ ] **Step 1: 修改 import**

将：

```typescript
import { listSaves } from '@/lib/storage'
```

替换为：

```typescript
import * as saveService from '@/lib/save-service'
```

- [ ] **Step 2: 修改删除按钮，使用 saveService.deleteSave**

将 delete 按钮中的 localStorage 直接操作：

```typescript
const keys = ['adventure_save_1', 'adventure_save_2', 'adventure_save_3', 'adventure_autosave']
for (const key of keys) {
  try {
    const raw = localStorage.getItem(key)
    if (raw && JSON.parse(raw).id === save.id) {
      localStorage.removeItem(key)
      break
    }
  } catch {}
}
actions.refreshSaves()
```

替换为：

```typescript
// 根据 save.id 找到 slot 编号
const metas = saveSlots
const idx = saveSlots.findIndex(s => s.id === save.id)
// slot 从 saveSlots 中推断：根据 position 映射
// 简化：遍历 0-3 加 loadSave 判断
;(async () => {
  for (let s = 0; s <= 3; s++) {
    const loaded = await saveService.loadSave(s)
    if (loaded && loaded.id === save.id) {
      await saveService.deleteSave(s)
      break
    }
  }
  actions.refreshSaves()
})()
```

- [ ] **Step 3: 修改 refreshSaves 调用**

`actions.refreshSaves()` 在 useEffect 中已经是异步兼容的了（game-context 的 refreshSaves 现在是 async），不需要修改。

- [ ] **Step 4: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 提交**

```bash
git add src/components/WorldCardSelector.tsx
git commit -m "feat: WorldCardSelector 适配 saveService 删除存档"
```

---

### Task 11: 测试与本地验证

- [ ] **Step 1: 运行现有测试**

```bash
npm test
```

确保现有 storage 和 game-reducer 测试通过。

- [ ] **Step 2: 启动开发服务器测试离线模式**

```bash
npm run dev
```

打开 http://localhost:3000 → 默认离线模式 → 开始游戏 → 保存存档 → 刷新页面 → 存档仍在

- [ ] **Step 3: 测试在线模式**

1. 打开设置 → "存储"标签
2. 填写账户名 `test1` 密码 `123456` → 注册
3. 开始游戏 → 保存存档 → 确认显示 ☁️ 图标
4. 切换到另一个浏览器 → 登录 `test1` / `123456` → 存档列表显示

- [ ] **Step 4: 测试迁移**

1. 离线模式创建存档
2. 注册在线账户 → 点击"迁移到云端"
3. 验证迁移后的存档可读

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "test: 本地验证双模式存档功能正常"
```

---

### Task 12: 服务器部署

- [ ] **Step 1: 推送代码到 GitHub**

```bash
git push origin master
```

- [ ] **Step 2: 在服务器上拉取更新**

SSH 登录服务器后：

```bash
cd /www/wwwroot/huashijie
git pull
npm install
npm run build
```

- [ ] **Step 3: 创建 data 目录**

```bash
mkdir -p /www/wwwroot/huashijie/data/saves
```

- [ ] **Step 4: 重启服务**

```bash
pm2 restart huashijie
```

- [ ] **Step 5: 验证部署**

打开 http://8.138.248.158:3000 → 设置 → 在线模式 → 注册 → 保存存档

- [ ] **Step 6: 提交（如有部署相关小修复）**

```bash
git add -A && git commit -m "chore: 部署配置" && git push
```

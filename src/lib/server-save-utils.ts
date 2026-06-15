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

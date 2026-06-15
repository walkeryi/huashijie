import { NextRequest, NextResponse } from 'next/server'
import { verifyAccount, readSaveIndex, writeSaveIndex, writeSaveData } from '@/lib/server-save-utils'
import { SaveMeta } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const { name, password, slot, save } = await request.json()
    if (!name || !password || !save) {
      return NextResponse.json({ ok: false, error: '缺少必要字段' }, { status: 400 })
    }
    if (typeof slot !== 'number' || slot < 0 || slot > 3) {
      return NextResponse.json({ ok: false, error: '无效的存档槽位' }, { status: 400 })
    }
    if (!verifyAccount(name.trim(), password)) {
      return NextResponse.json({ ok: false, error: '账户不存在或密码错误' }, { status: 401 })
    }

    const accountName = name.trim()

    // 写入完整存档，但 apiKey 置空
    const safeSave = { ...save, apiKey: '' }
    writeSaveData(accountName, slot, safeSave)

    // 更新索引
    const index = readSaveIndex(accountName) || { accountName, updatedAt: 0, slots: [] }
    const meta: SaveMeta = {
      slot,
      id: save.id || ('save_' + Date.now()),
      slotName: save.slotName || `存档 ${slot}`,
      timestamp: typeof save.timestamp === 'number' && save.timestamp > 0 ? save.timestamp : Date.now(),
      worldCardId: save.worldCardId || '',
      playerName: save.playerState?.playerName || '',
    }
    index.slots = index.slots.filter(s => s.slot !== slot)
    index.slots.push(meta)
    index.updatedAt = Date.now()
    writeSaveIndex(accountName, index)

    return NextResponse.json({ ok: true, timestamp: Date.now() })
  } catch {
    return NextResponse.json({ ok: false, error: '服务器错误' }, { status: 500 })
  }
}

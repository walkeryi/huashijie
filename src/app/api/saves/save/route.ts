import { NextRequest, NextResponse } from 'next/server'
import { verifyAccount, readSaveIndex, writeSaveIndex, writeSaveData } from '@/lib/server-save-utils'
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
  } catch {
    return NextResponse.json({ ok: false, error: '服务器错误' }, { status: 500 })
  }
}

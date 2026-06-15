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
  } catch {
    return NextResponse.json({ ok: false, error: '服务器错误' }, { status: 500 })
  }
}

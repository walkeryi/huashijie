import { NextRequest, NextResponse } from 'next/server'
import { verifyAccount, readSaveIndex, writeSaveIndex, deleteSaveData } from '@/lib/server-save-utils'

export async function POST(request: NextRequest) {
  try {
    const { name, password, slot } = await request.json()
    if (!name || !password) {
      return NextResponse.json({ ok: false, error: '账户名和密码不能为空' }, { status: 400 })
    }
    if (typeof slot !== 'number' || slot < 0 || slot > 3) {
      return NextResponse.json({ ok: false, error: '无效的存档槽位' }, { status: 400 })
    }
    if (!verifyAccount(name.trim(), password)) {
      return NextResponse.json({ ok: false, error: '账户不存在或密码错误' }, { status: 401 })
    }
    const accountName = name.trim()
    deleteSaveData(accountName, slot)
    const index = readSaveIndex(accountName)
    if (index) {
      index.slots = index.slots.filter(s => s.slot !== slot)
      index.updatedAt = Date.now()
      writeSaveIndex(accountName, index)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: '服务器错误' }, { status: 500 })
  }
}

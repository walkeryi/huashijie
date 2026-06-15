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
  } catch {
    return NextResponse.json({ ok: false, error: '服务器错误' }, { status: 500 })
  }
}

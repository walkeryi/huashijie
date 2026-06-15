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
  } catch {
    return NextResponse.json({ ok: false, error: '服务器错误' }, { status: 500 })
  }
}

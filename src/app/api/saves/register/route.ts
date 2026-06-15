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
  } catch {
    return NextResponse.json({ ok: false, error: '服务器错误' }, { status: 500 })
  }
}

// src/app/api/saves/route.ts — 统一存档路由（6合1，根据 body.action 分发）
import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAccount, registerAccount,
  readSaveIndex, writeSaveIndex,
  readSaveData, writeSaveData, deleteSaveData,
} from '@/lib/server-save-utils'
import { SaveMeta } from '@/lib/types'

export async function POST(request: NextRequest) {
  const action = '' // 在 try 内解析

  try {
    const body = await request.json()
    const { action, name, password, slot, save } = body as {
      action?: string
      name?: string
      password?: string
      slot?: number
      save?: Record<string, unknown>
    }

    if (!action) {
      return NextResponse.json({ ok: false, error: '缺少 action 字段' }, { status: 400 })
    }

    switch (action) {
      // ===== register =====
      case 'register': {
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
      }

      // ===== login =====
      case 'login': {
        if (!name || !password) {
          return NextResponse.json({ ok: false, error: '账户名和密码不能为空' }, { status: 400 })
        }
        const ok = verifyAccount(name.trim(), password)
        if (!ok) {
          return NextResponse.json({ ok: false, error: '账户不存在或密码错误' }, { status: 401 })
        }
        return NextResponse.json({ ok: true })
      }

      // ===== list =====
      case 'list': {
        if (!name || !password) {
          return NextResponse.json({ ok: false, error: '账户名和密码不能为空' }, { status: 400 })
        }
        if (!verifyAccount(name.trim(), password)) {
          return NextResponse.json({ ok: false, error: '账户不存在或密码错误' }, { status: 401 })
        }
        const index = readSaveIndex(name.trim())
        return NextResponse.json({ ok: true, saves: index?.slots ?? [] })
      }

      // ===== save =====
      case 'save': {
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
        const safeSave = { ...save, apiKey: '' }
        writeSaveData(accountName, slot, safeSave)

        const idx = readSaveIndex(accountName) || { accountName, updatedAt: 0, slots: [] }
        const meta: SaveMeta = {
          slot,
          id: (save as Record<string, unknown>).id as string || ('save_' + Date.now()),
          slotName: (save as Record<string, unknown>).slotName as string || `存档 ${slot}`,
          timestamp: typeof (save as Record<string, unknown>).timestamp === 'number' && (save as Record<string, unknown>).timestamp as number > 0
            ? (save as Record<string, unknown>).timestamp as number : Date.now(),
          worldCardId: (save as Record<string, unknown>).worldCardId as string || '',
          playerName: ((save as Record<string, unknown>).playerState as { playerName?: string })?.playerName || '',
        }
        idx.slots = idx.slots.filter(s => s.slot !== slot)
        idx.slots.push(meta)
        idx.updatedAt = Date.now()
        writeSaveIndex(accountName, idx)

        return NextResponse.json({ ok: true, timestamp: Date.now() })
      }

      // ===== load =====
      case 'load': {
        if (!name || !password) {
          return NextResponse.json({ ok: false, error: '账户名和密码不能为空' }, { status: 400 })
        }
        if (typeof slot !== 'number' || slot < 0 || slot > 3) {
          return NextResponse.json({ ok: false, error: '无效的存档槽位' }, { status: 400 })
        }
        if (!verifyAccount(name.trim(), password)) {
          return NextResponse.json({ ok: false, error: '账户不存在或密码错误' }, { status: 401 })
        }
        const saveData = readSaveData(name.trim(), slot)
        if (!saveData) {
          return NextResponse.json({ ok: false, error: '存档不存在' }, { status: 404 })
        }
        return NextResponse.json({ ok: true, save: saveData })
      }

      // ===== delete =====
      case 'delete': {
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
        const idx = readSaveIndex(accountName)
        if (idx) {
          idx.slots = idx.slots.filter(s => s.slot !== slot)
          idx.updatedAt = Date.now()
          writeSaveIndex(accountName, idx)
        }
        return NextResponse.json({ ok: true })
      }

      default:
        return NextResponse.json({ ok: false, error: '未知操作: ' + action }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ ok: false, error: '服务器错误' }, { status: 500 })
  }
}

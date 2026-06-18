import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createModelInstance } from '@/lib/create-model-instance'

type Provider = 'anthropic' | 'openai' | 'deepseek' | 'custom'

export async function POST(request: NextRequest) {
  const start = Date.now()

  try {
    const body = await request.json()
    const { apiKey, provider, model, customBaseURL } = body as {
      apiKey?: string
      provider?: Provider
      model?: string
      customBaseURL?: string
    }

    if (!apiKey) {
      return NextResponse.json({ ok: false, error: '缺少 API Key' }, { status: 400 })
    }
    if (!provider) {
      return NextResponse.json({ ok: false, error: '缺少提供商' }, { status: 400 })
    }

    const modelInstance = createModelInstance({ provider, apiKey, model, customBaseURL })

    await generateText({
      model: modelInstance,
      system: 'Reply with just "ok".',
      prompt: 'hi',
    })

    const latency = Date.now() - start
    return NextResponse.json({ ok: true, latency })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    const latency = Date.now() - start
    console.error('[test-connection] ❌ 失败:', message)
    if (stack) console.error('[test-connection] 堆栈:', stack)
    return NextResponse.json({ ok: false, error: message, latency })
  }
}

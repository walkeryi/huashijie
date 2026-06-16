import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createModelInstance } from '@/lib/create-model-instance'

type Provider = 'anthropic' | 'openai' | 'deepseek' | 'custom'

export async function POST(request: NextRequest) {
  const start = Date.now()
  console.log('[test-connection] POST 请求到达')

  try {
    const body = await request.json()
    const { apiKey, provider, model, customBaseURL } = body as {
      apiKey?: string
      provider?: Provider
      model?: string
      customBaseURL?: string
    }

    console.log('[test-connection] 解析参数:', {
      provider,
      model,
      customBaseURL: customBaseURL || '(无)',
      apiKeyLen: apiKey?.length ?? 0,
      apiKeyPrefix: apiKey?.slice(0, 10) ?? '(空)',
    })

    if (!apiKey) {
      console.log('[test-connection] ❌ 缺少 API Key')
      return NextResponse.json({ ok: false, error: '缺少 API Key' }, { status: 400 })
    }
    if (!provider) {
      console.log('[test-connection] ❌ 缺少提供商')
      return NextResponse.json({ ok: false, error: '缺少提供商' }, { status: 400 })
    }

    const modelInstance = createModelInstance({ provider, apiKey, model, customBaseURL })

    console.log('[test-connection] 模型实例已创建，调用 generateText...')

    await generateText({
      model: modelInstance,
      system: 'Reply with just "ok".',
      prompt: 'hi',
    })

    const latency = Date.now() - start
    console.log('[test-connection] ✅ 连接成功, 延迟:', latency, 'ms')
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

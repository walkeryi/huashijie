import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

type Provider = 'anthropic' | 'openai' | 'deepseek' | 'custom'

export async function POST(request: NextRequest) {
  const start = Date.now()

  try {
    const { apiKey, provider, model, customBaseURL } = (await request.json()) as {
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

    if (provider === 'anthropic') {
      const client = new Anthropic({ apiKey })
      await client.messages.create({
        model: model || 'claude-sonnet-4-6',
        max_tokens: 10,
        system: 'Reply with just "ok".',
        messages: [{ role: 'user', content: 'hi' }],
      })
    } else {
      const baseURL = provider === 'deepseek' ? 'https://api.deepseek.com' : customBaseURL || undefined
      const client = new OpenAI({ apiKey, baseURL })
      await client.chat.completions.create({
        model: model || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o'),
        max_tokens: 10,
        messages: [
          { role: 'system', content: 'Reply with just "ok".' },
          { role: 'user', content: 'hi' },
        ],
      })
    }

    const latency = Date.now() - start
    return NextResponse.json({ ok: true, latency })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const latency = Date.now() - start
    return NextResponse.json({ ok: false, error: message, latency })
  }
}

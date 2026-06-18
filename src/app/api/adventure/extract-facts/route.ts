// src/app/api/adventure/extract-facts/route.ts
// 结构化记忆槽 — 事实提取端点
// 每轮游戏旁白输出后，客户端同步调用此端点，用 generateText 提取 ≤15 字关键事实

import { NextRequest } from 'next/server'
import { generateText } from 'ai'
import { createModelInstance, resolveApiKey } from '@/lib/create-model-instance'

export async function POST(request: NextRequest) {
  const start = Date.now()

  try {
    const body = await request.json()
    const {
      narration,
      existingFacts,
      apiKey: requestApiKey,
      provider,
      model,
      customBaseURL,
    } = body as {
      narration: string
      existingFacts?: string[]
      apiKey?: string
      provider?: string
      model?: string
      customBaseURL?: string
    }

    if (!narration) {
      return new Response(JSON.stringify({ error: '缺少 narration' }), { status: 400 })
    }

    const apiKey = resolveApiKey(provider, requestApiKey)
    if (!apiKey) {
      return new Response(JSON.stringify({ error: '缺少 API Key' }), { status: 400 })
    }

    const modelInstance = createModelInstance({ provider, apiKey, model, customBaseURL })

    const factsListText = (existingFacts ?? [])
      .map((f, i) => `${i + 1}. ${f}`)
      .join('\n')

    const result = await generateText({
      model: modelInstance,
      system: `你是一个事实提取器。从游戏叙述中提取关键事实，返回 JSON。每条事实不超过15字。
只提取对后续剧情有影响的关键信息：地点、人物、物品、线索、重要事件。
忽略描写性内容、情感描述、过渡性叙述。`,
      messages: [
        {
          role: 'user',
          content: `已有事实（序号用于替换时引用）：
${factsListText || '(空)'}

叙述：
${narration}

规则：
- 提取新出现的关键事实，每条不超过15字
- 若新事实与已有事实矛盾，在 replaceFacts 中填入旧事实的完整原文，并在 facts 中给出正确版本
- 无新事实或无变化时返回空数组

返回严格 JSON（不要用 markdown 代码块包裹）：
{"facts": [...], "replaceFacts": [...]}`,
        },
      ],
      temperature: 0.1, // 低温度提高提取稳定性
    })

    // 解析 AI 返回的 JSON
    const text = result.text.trim()
    try {
      // 兼容 AI 可能包裹 markdown 代码块的情况
      const jsonStr = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
      const parsed = JSON.parse(jsonStr) as { facts?: string[]; replaceFacts?: string[] }
      const facts = (parsed.facts ?? []).map(f => f.trim().slice(0, 15))
      const replaceFacts = (parsed.replaceFacts ?? []).map(f => f.trim())
      return new Response(
        JSON.stringify({ facts, replaceFacts }),
        { status: 200 },
      )
    } catch {
      console.error('[extract-facts] ❌ JSON 解析失败 | 原始文本:', text.slice(0, 200))
      return new Response(JSON.stringify({ facts: [], replaceFacts: [] }), { status: 200 })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const latency = Date.now() - start
    console.error('[extract-facts] ❌ 失败 (耗时', latency, 'ms):', message)
    return new Response(JSON.stringify({ error: '内部服务器错误' }), { status: 500 })
  }
}

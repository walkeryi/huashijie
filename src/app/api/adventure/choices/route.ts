// src/app/api/adventure/choices/route.ts
// Stage 3: Choices Maker — 基于叙事内容生成下一步选项（generateText + Output.json() v6 API）

import { NextRequest } from 'next/server'
import { generateText, Output } from 'ai'
import { WorldCard, PlayerState } from '@/lib/types'
import { choicesSchema } from '@/lib/tool-schema'
import { createModelInstance, resolveApiKey } from '@/lib/create-model-instance'

function buildChoicesSystemPrompt(
  worldCard: WorldCard,
  playerState: PlayerState,
): string {
  const attrText = Object.entries(playerState.attributes ?? {})
    .map(([key, val]) => {
      const def = worldCard.attributes.find(a => a.key === key)
      return def ? `${def.icon} ${def.name}: ${val}/${def.max}` : `${key}: ${val}`
    })
    .join('\n')

  const inventoryText = playerState.inventory && playerState.inventory.length > 0
    ? playerState.inventory.map(item => `- ${item}`).join('\n')
    : '空'

  const flagsText = playerState.flags
    ? Object.entries(playerState.flags).filter(([, val]) => val).map(([key]) => `- ${key}`).join('\n')
    : ''
  const flagsDisplay = flagsText || '无'

  return `你是一个文字冒险游戏的选项生成器。基于世界设定、玩家状态和当前叙述，生成 2-4 个后续选项。

## 世界设定
${worldCard.description}

## 玩家状态
${attrText}

## 物品栏
${inventoryText}

## 已解锁旗标
${flagsDisplay}

## 输出要求
生成 2-4 个选项，每个选项包含：
- text: 选项文本（具体、有画面感，15-30 字）
- attributeChecks（可选）：属性要求，如 {"courage": ">= 3"}
- npcAffinityChecks（可选）：好感度要求，如 {"blacksmith": ">= 40"}
- flagChecks（可选）：需要的旗标
- flagNot（可选）：不应有的旗标
- itemChecks（可选）：需要的物品
- itemNot（可选）：不应有的物品

注意：只输出 JSON，不要包含任何其他文本或 markdown 代码块。`
}

function buildChoicesMessages(narration: string, playerAction?: string) {
  return [
    {
      role: 'user' as const,
      content: `## 本轮玩家行动
${playerAction || '开始冒险'}

## 当前叙述
${narration}

请根据以上叙述，生成 2-4 个合理的后续选项（JSON 格式）。`,
    },
  ]
}

function parseChoicesJSON(text: string): { options: Record<string, unknown>[] } {
  const trimmed = text.trim()
  const jsonStr = trimmed.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  try {
    const parsed = JSON.parse(jsonStr)
    // Zod 校验
    const validated = choicesSchema.safeParse(parsed)
    if (validated.success) return { options: validated.data.options }
    // schema 不通过但 parsed.options 存在则直接使用
    if (Array.isArray(parsed.options) && parsed.options.length > 0) {
      return { options: parsed.options.slice(0, 4) }
    }
    throw new Error('options 为空')
  } catch {
    const firstBrace = jsonStr.indexOf('{')
    const lastBrace = jsonStr.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const parsed = JSON.parse(jsonStr.slice(firstBrace, lastBrace + 1))
        if (Array.isArray(parsed.options) && parsed.options.length > 0) {
          return { options: parsed.options.slice(0, 4) }
        }
      } catch { /* fall through */ }
    }
    throw new Error('JSON 解析失败')
  }
}

export async function POST(request: NextRequest) {
  const start = Date.now()

  try {
    const body = await request.json()
    const {
      narration, playerAction, worldCard, playerState,
      apiKey: requestApiKey, provider, model, customBaseURL,
    } = body as {
      narration: string
      playerAction?: string
      worldCard: WorldCard
      playerState: PlayerState
      apiKey?: string
      provider?: string
      model?: string
      customBaseURL?: string
    }

    if (!narration || !worldCard || !playerState) {
      return new Response(JSON.stringify({ error: '请求体不完整' }), { status: 400 })
    }

    const apiKey = resolveApiKey(provider, requestApiKey)
    if (!apiKey) {
      return new Response(JSON.stringify({ error: '缺少 API Key' }), { status: 400 })
    }

    const modelInstance = createModelInstance({ provider, apiKey, model, customBaseURL })
    const systemPrompt = buildChoicesSystemPrompt(worldCard, playerState)
    const messages = buildChoicesMessages(narration, playerAction)

    const result = await generateText({
      model: modelInstance,
      system: systemPrompt,
      messages,
      output: Output.json(),
      temperature: 0.5,
    })

    // result.output 在 Output.json() 成功时已是解析好的对象
    const output = result.output
    console.error('[adventure-choices] 🔍 result.output typeof:', typeof output)
    console.error('[adventure-choices] 🔍 result.output isArray:', Array.isArray(output))
    if (typeof output === 'object' && output !== null && !Array.isArray(output)) {
      const obj = output as Record<string, unknown>
      console.error('[adventure-choices] 🔍 result.output keys:', Object.keys(obj))
      console.error('[adventure-choices] 🔍 result.output.options type:', typeof obj.options, 'isArray:', Array.isArray(obj.options), 'len:', Array.isArray(obj.options) ? (obj.options as unknown[]).length : 'N/A')
    }
    console.error('[adventure-choices] 🔍 result.output value:', JSON.stringify(output).slice(0, 500))
    let options: Record<string, unknown>[]

    if (Array.isArray(output)) {
      // DeepSeek 可能直接返回选项数组 [...]
      options = output.slice(0, 4) as Record<string, unknown>[]
    } else if (typeof output === 'object' && output !== null) {
      const obj = output as { options?: Record<string, unknown>[] }
      if (Array.isArray(obj.options) && obj.options.length > 0) {
        options = obj.options.slice(0, 4)
      } else {
        throw new Error('options 为空')
      }
    } else {
      const parsed = parseChoicesJSON(String(output))
      options = parsed.options
    }

    return new Response(JSON.stringify({ options }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const latency = Date.now() - start
    console.error('[adventure-choices] ❌ 失败 (耗时', latency, 'ms):', message)
    const errorWithText = error as { text?: string } | undefined
    if (typeof errorWithText?.text === 'string') {
      console.error('[adventure-choices] AI 原始输出:', errorWithText.text.slice(0, 300))
    }
    // 降级：注入默认选项
    const defaultOptions = [
      { text: '继续前进' },
      { text: '仔细观察周围' },
      { text: '与附近的人交谈' },
    ]
    return new Response(JSON.stringify({ options: defaultOptions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

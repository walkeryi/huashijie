import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { WorldCard, PlayerState, DialogueEntry, AIResponse } from '@/lib/types'

const API_TIMEOUT_MS = 30000

type Provider = 'anthropic' | 'openai'

function detectProvider(apiKey: string): Provider {
  if (apiKey.startsWith('sk-ant-')) return 'anthropic'
  return 'openai'
}

function getApiKey(apiKeyOverride?: string): string {
  const key = apiKeyOverride || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error('缺少 API Key：请在页面输入或设置环境变量')
  }
  return key
}

function sanitizePlayerName(name: string): string {
  return name.replace(/[\n\r\\]/g, '').slice(0, 50)
}

export function buildSystemPrompt(worldCard: WorldCard, playerState: PlayerState): string {
  const attrText = Object.entries(playerState.attributes ?? {})
    .map(([key, val]) => {
      const def = worldCard.attributes.find(a => a.key === key)
      return def ? `${def.icon} ${def.name}: ${val}/${def.max}` : `${key}: ${val}`
    })
    .join('\n')

  const exampleAttr = worldCard.attributes[0]?.name ?? '属性'

  return `你是一个文字冒险游戏的叙事引擎。你必须严格遵循以下设定来运行游戏。

## 世界设定
${worldCard.description}

## 玩家当前状态
- 姓名：${sanitizePlayerName(playerState.playerName)}
${attrText}

## 你的职责
1. 根据玩家的选择推进故事
2. 描述场景、NPC 反应和事件发展
3. 故事的走向应该受玩家属性影响——属性高的可以发现更多线索、说服NPC、克服困难
4. 每次回复结束给出 2-4 个选项供玩家选择
5. 选项可以需要属性条件（比如 ${exampleAttr} >= 5 才能选的选项）

## 输出格式
你必须严格按照以下 JSON 格式输出（不要包含 markdown 代码块标记，只输出纯 JSON）：

{
  "narration": "场景叙述文字，使用文学化的中文，沉浸感强，2-5段",
  "options": [
    {"text": "选项文本"},
    {"text": "需要属性条件的选项文本", "attributeChecks": {"courage": ">= 5"}}
  ],
  "attributeChanges": {"courage": 2, "health": -1}
}

## 重要规则
- narration 使用中文，语言优美有画面感，但不要过于冗长（控制在 200-400 字）
- options 提供 2-4 个有意义的选择，不要让玩家感觉"选什么都一样"
- attributeChanges 是选择后的属性增减，只在合理时使用，大多数情况可以设为 {}
- 保持世界的内部一致性——记住之前发生的事
- 不要代替玩家做选择
- 不要输出"未完待续"这类元叙述`
}

function parseAIResponse(text: string): AIResponse {
  try {
    return JSON.parse(text.trim()) as AIResponse
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim()) as AIResponse
    }
  }

  return {
    narration: text.trim(),
    options: [
      { text: '继续前进' },
      { text: '仔细观察周围' },
      { text: '与附近的人交谈' },
    ],
    attributeChanges: {},
  }
}

function validateAIResponse(response: AIResponse, fallbackText: string): AIResponse {
  if (!response.narration) response.narration = fallbackText.trim()
  if (!response.options || response.options.length === 0) response.options = [{ text: '继续...' }]
  if (!response.attributeChanges) response.attributeChanges = {}
  return response
}

// ====== Anthropic ======

function buildAnthropicMessages(dialogueHistory: DialogueEntry[], worldCard: WorldCard): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = []

  for (const entry of dialogueHistory.slice(-12)) {
    if (entry.role === 'narrator') {
      messages.push({ role: 'assistant', content: entry.content })
    } else if (entry.role === 'player') {
      messages.push({ role: 'user', content: `[玩家选择]: ${entry.content}` })
    }
  }

  if (messages.length === 0) {
    messages.push({
      role: 'user',
      content: `[游戏开始]\n初始场景：${worldCard.initialScene}\n\n请根据以上场景开始叙述，并给出玩家的选项。`,
    })
  }

  return messages
}

async function callAnthropic(apiKey: string, systemPrompt: string, messages: Anthropic.MessageParam[]): Promise<string> {
  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })

  const firstBlock = response.content[0]
  if (!firstBlock || firstBlock.type !== 'text') {
    throw new Error('AI 返回了非预期的响应格式')
  }
  return firstBlock.text
}

// ====== OpenAI ======

function buildOpenAIMessages(dialogueHistory: DialogueEntry[], worldCard: WorldCard, systemPrompt: string): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ]

  for (const entry of dialogueHistory.slice(-12)) {
    if (entry.role === 'narrator') {
      messages.push({ role: 'assistant', content: entry.content })
    } else if (entry.role === 'player') {
      messages.push({ role: 'user', content: `[玩家选择]: ${entry.content}` })
    }
  }

  if (messages.length === 1) {
    messages.push({
      role: 'user',
      content: `[游戏开始]\n初始场景：${worldCard.initialScene}\n\n请根据以上场景开始叙述，并给出玩家的选项。`,
    })
  }

  return messages
}

async function callOpenAI(apiKey: string, messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): Promise<string> {
  const client = new OpenAI({ apiKey })
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    messages,
  })

  return response.choices[0]?.message?.content ?? ''
}

// ====== Route Handler ======

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { worldCard, playerState, dialogueHistory, apiKey: requestApiKey } = body as {
      worldCard: WorldCard
      playerState: PlayerState
      dialogueHistory: DialogueEntry[]
      apiKey?: string
    }

    if (!worldCard || !playerState || !dialogueHistory) {
      return NextResponse.json({ error: '请求体不完整' }, { status: 400 })
    }

    const apiKey = getApiKey(requestApiKey)
    const provider = detectProvider(apiKey)
    const systemPrompt = buildSystemPrompt(worldCard, playerState)

    // 带超时的 API 调用
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    let text: string
    try {
      if (provider === 'anthropic') {
        const messages = buildAnthropicMessages(dialogueHistory, worldCard)
        text = await callAnthropic(apiKey, systemPrompt, messages)
      } else {
        const messages = buildOpenAIMessages(dialogueHistory, worldCard, systemPrompt)
        text = await callOpenAI(apiKey, messages)
      }
    } finally {
      clearTimeout(timeoutId)
    }

    const aiResponse = parseAIResponse(text)
    validateAIResponse(aiResponse, text)

    return NextResponse.json(aiResponse)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('API Error:', message)

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'AI 响应超时，请重试' }, { status: 504 })
    }

    return NextResponse.json({ error: '内部服务器错误' }, { status: 500 })
  }
}

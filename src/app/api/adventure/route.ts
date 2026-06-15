import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { WorldCard, PlayerState, DialogueEntry, AIResponse } from '@/lib/types'

const API_TIMEOUT_MS = 30000

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('服务器配置错误：缺少 ANTHROPIC_API_KEY')
  }
  return new Anthropic({ apiKey })
}

function sanitizePlayerName(name: string): string {
  // 防止提示注入：限制长度，过滤换行和特殊标记
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

function extractTextFromResponse(response: Anthropic.Message): string {
  const firstBlock = response.content[0]
  if (!firstBlock || firstBlock.type !== 'text') {
    throw new Error('AI 返回了非预期的响应格式')
  }
  return firstBlock.text
}

function parseAIResponse(text: string): AIResponse {
  // 尝试直接解析 JSON
  try {
    return JSON.parse(text.trim()) as AIResponse
  } catch {
    // 尝试从 markdown 代码块中提取
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim()) as AIResponse
    }
  }

  // 降级：当作纯文本，生成默认选项
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
  if (!response.narration) {
    response.narration = fallbackText.trim()
  }
  if (!response.options || response.options.length === 0) {
    response.options = [{ text: '继续...' }]
  }
  if (!response.attributeChanges) {
    response.attributeChanges = {}
  }
  return response
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { worldCard, playerState, dialogueHistory } = body as {
      worldCard: WorldCard
      playerState: PlayerState
      dialogueHistory: DialogueEntry[]
    }

    // 输入验证
    if (!worldCard || !playerState || !dialogueHistory) {
      return NextResponse.json({ error: '请求体不完整' }, { status: 400 })
    }

    // 构建消息历史
    const messages: Anthropic.MessageParam[] = []

    for (const entry of dialogueHistory.slice(-12)) {
      if (entry.role === 'narrator') {
        messages.push({ role: 'assistant', content: entry.content })
      } else if (entry.role === 'player') {
        messages.push({ role: 'user', content: `[玩家选择]: ${entry.content}` })
      }
    }

    // 如果是新游戏（无历史），发送一个初始消息
    if (messages.length === 0) {
      messages.push({
        role: 'user',
        content: `[游戏开始]\n初始场景：${worldCard.initialScene}\n\n请根据以上场景开始叙述，并给出玩家的选项。`,
      })
    }

    const systemPrompt = buildSystemPrompt(worldCard, playerState)
    const anthropic = getAnthropicClient()

    // 带超时的 API 调用
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    let response: Anthropic.Message
    try {
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    // 解析并验证 AI 响应
    const text = extractTextFromResponse(response)
    const aiResponse = parseAIResponse(text)
    validateAIResponse(aiResponse, text)

    return NextResponse.json(aiResponse)
  } catch (error: unknown) {
    // 只记录日志，不向客户端泄漏内部错误详情
    const message = error instanceof Error ? error.message : String(error)
    console.error('API Error:', message)

    // 区分超时错误
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'AI 响应超时，请重试' }, { status: 504 })
    }

    return NextResponse.json({ error: '内部服务器错误' }, { status: 500 })
  }
}

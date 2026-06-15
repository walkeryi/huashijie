import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { WorldCard, PlayerState, DialogueEntry, AIResponse } from '@/lib/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

function buildSystemPrompt(worldCard: WorldCard, playerState: PlayerState): string {
  const attrText = Object.entries(playerState.attributes)
    .map(([key, val]) => {
      const def = worldCard.attributes.find(a => a.key === key)
      return def ? `${def.icon} ${def.name}: ${val}/${def.max}` : `${key}: ${val}`
    })
    .join('\n')

  return `你是一个文字冒险游戏的叙事引擎。你必须严格遵循以下设定来运行游戏。

## 世界设定
${worldCard.description}

## 玩家当前状态
- 姓名：${playerState.playerName}
${attrText}

## 你的职责
1. 根据玩家的选择推进故事
2. 描述场景、NPC 反应和事件发展
3. 故事的走向应该受玩家属性影响——属性高的可以发现更多线索、说服NPC、克服困难
4. 每次回复结束给出 2-4 个选项供玩家选择
5. 选项可以需要属性条件（比如 ${worldCard.attributes[0]?.name ?? '属性'} >= 5 才能选的选项）

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { worldCard, playerState, dialogueHistory } = body as {
      worldCard: WorldCard
      playerState: PlayerState
      dialogueHistory: DialogueEntry[]
    }

    // 构建消息历史
    const messages: Anthropic.MessageParam[] = []

    // 将对话历史转为 messages
    for (const entry of dialogueHistory.slice(-12)) {
      if (entry.role === 'narrator') {
        messages.push({ role: 'assistant', content: entry.content })
      } else {
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

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    // 解析 AI 响应
    const text = (response.content[0] as { type: 'text'; text: string }).text
    let aiResponse: AIResponse

    try {
      // 尝试直接解析 JSON
      aiResponse = JSON.parse(text.trim())
    } catch {
      // 尝试从 markdown 代码块中提取
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[1].trim())
      } else {
        // 降级：当作纯文本，生成默认选项
        aiResponse = {
          narration: text.trim(),
          options: [
            { text: '继续前进' },
            { text: '仔细观察周围' },
            { text: '与附近的人交谈' },
          ],
          attributeChanges: {},
        }
      }
    }

    // 验证字段
    if (!aiResponse.narration) {
      aiResponse.narration = text.trim()
    }
    if (!aiResponse.options || aiResponse.options.length === 0) {
      aiResponse.options = [{ text: '继续...' }]
    }
    if (!aiResponse.attributeChanges) {
      aiResponse.attributeChanges = {}
    }

    return NextResponse.json(aiResponse)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('API Error:', message)
    return NextResponse.json(
      { error: message || '内部错误' },
      { status: 500 }
    )
  }
}

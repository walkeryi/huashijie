import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { WorldCard, PlayerState, DialogueEntry, AIResponse, AdvancedParams } from '@/lib/types'

const API_TIMEOUT_MS = 30000

type Provider = 'anthropic' | 'openai' | 'deepseek' | 'custom'

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

export function buildSystemPrompt(
  worldCard: WorldCard,
  playerState: PlayerState,
  npcAffinities: Record<string, number> = {},
  npcRuntime: Record<string, { currentSelfPerception: string; currentState: string }> = {},
): string {
  const attrText = Object.entries(playerState.attributes ?? {})
    .map(([key, val]) => {
      const def = worldCard.attributes.find(a => a.key === key)
      return def ? `${def.icon} ${def.name}: ${val}/${def.max}` : `${key}: ${val}`
    })
    .join('\n')

  // NPC 关系
  const npcText = worldCard.npcs.length > 0
    ? worldCard.npcs.map(npc => {
        const f = npc.fields
        const affinity = npcAffinities[npc.id] ?? f.initialAffinity ?? 0
        let text = `👤 ${f.name || npc.id} | 好感: ${affinity}/100`
        if (f.gender) text += ` | 性别: ${f.gender}`
        if (f.origin) text += ` | 来历: ${f.origin}`
        if (f.dialogueTone) text += ` | 性格: ${f.dialogueTone}`
        if (f.personalityTags?.length) text += ` | 标签: ${f.personalityTags.join('、')}`
        if (f.appearance) text += ` | 外貌: ${f.appearance}`
        if (f.currentAttire) text += ` | 衣着: ${f.currentAttire}`
        if (f.dialogueExamples) text += `\n说话风格参考（勿照搬）: ${f.dialogueExamples}`
        return text
      }).join('\n\n')
    : '无'

  // 物品栏
  const inventoryText = playerState.inventory && playerState.inventory.length > 0
    ? playerState.inventory.map(item => `- ${item}`).join('\n')
    : '空'

  // 已解锁旗标
  const flagsText = playerState.flags
    ? Object.entries(playerState.flags)
        .filter(([, val]) => val === true)
        .map(([key]) => `- ${key}`)
        .join('\n')
    : ''
  const flagsDisplay = flagsText || '无'

  // 故事节拍进度
  const beats = worldCard.storyBeats ?? []
  const completedBeats = beats.filter(b => playerState.flags?.[b.id]).map(b => b.name)
  const availableBeats = beats.filter(b => {
    if (playerState.flags?.[b.id]) return false // 已完成
    // 至少一个前置节拍已完成，或者这个节拍不需要前置（intro）
    const anyUnlockerComplete = b.id === 'intro' || beats.some(
      ub => ub.unlocks.includes(b.id) && playerState.flags?.[ub.id]
    )
    if (!anyUnlockerComplete) return false
    // 检查前置条件
    if (b.preconditions?.flagChecks) {
      for (const f of b.preconditions.flagChecks) {
        if (!playerState.flags?.[f]) return false
      }
    }
    return true
  }).map(b => b.name)
  const lockedBeats = beats.filter(b => !completedBeats.includes(b.name) && !availableBeats.includes(b.name)).map(b => b.name)

  const beatProgress = [
    completedBeats.length > 0 ? `✅ 已完成: ${completedBeats.join('、')}` : '',
    availableBeats.length > 0 ? `🔓 可解锁: ${availableBeats.join('、')}` : '',
    lockedBeats.length > 0 ? `🔒 未解锁: ${lockedBeats.join('、')}` : '',
  ].filter(Boolean).join('\n') || '无节拍数据'

  const exampleAttr = worldCard.attributes[0]?.name ?? '属性'

  return `你是一个文字冒险游戏的叙事引擎。你必须严格遵循以下设定来运行游戏。

## 世界设定
${worldCard.description}

## 玩家当前状态
- 姓名：${sanitizePlayerName(playerState.playerName)}
${attrText}

## NPC 关系
${npcText}

## 物品栏
${inventoryText}

## 已解锁旗标
${flagsDisplay}

## 故事进度
${beatProgress}

## 你的职责
1. 根据玩家的选择推进故事
2. 描述场景、NPC 反应和事件发展
3. 故事的走向应该受玩家属性影响——属性高的可以发现更多线索、说服NPC、克服困难
4. 每次回复结束给出 2-4 个选项供玩家选择
5. 选项可以需要属性条件（比如 ${exampleAttr} >= 5 才能选的选项）
6. **故事节拍规则：** 玩家的行动应朝向解锁🔓可用的节拍。当玩家完成了某个可用节拍（参考其 description），在 newFlags 中加入该节拍 id，并应用对应 effects。**不要**在对话中提及未解锁节拍的内容或 NPC。

## 输出格式
你必须严格按照以下 JSON 格式输出（不要包含 markdown 代码块标记，只输出纯 JSON）：

{
  "narration": "场景叙述文字，使用文学化的中文，沉浸感强，2-5段",
  "options": [
    {"text": "选项文本"},
    {"text": "需要属性条件的选项文本", "attributeChecks": {"courage": ">= 5"}}
  ],
  "attributeChanges": {"courage": 2},
  "npcAffinityChanges": {"blacksmith": 5, "mage": -3},
  "newFlags": ["found_allies"],
  "lostFlags": [],
  "itemsGained": ["rusty_key"],
  "itemsLost": ["broken_sword"]
}

## 重要规则
- narration 使用中文，语言优美有画面感，但不要过于冗长（控制在 200-400 字）
- options 提供 2-4 个有意义的选择，不要让玩家感觉"选什么都一样"
- attributeChanges 是选择后的属性增减，只在合理时使用，大多数情况可以设为 {}
- NPC 好感度随玩家行为变化，友善行为增加、冒犯行为减少，范围 0-100
- 好感度高的 NPC 主动提供帮助、透露信息；好感度低的 NPC 拒绝交流或成为障碍
- 物品在合理时消耗（itemsLost）或获得（itemsGained），影响后续可用选项
- 旗标代表不可逆的世界变化，newFlags 添加、lostFlags 移除
- npcAffinityChanges 只包含本次对话中有变化的 NPC，没有变化就设为 {}
- 保持世界的内部一致性——记住之前发生的事
- 不要代替玩家做选择
- 不要输出"未完待续"这类元叙述
- **NPC 对话约束：** 你为 NPC 编写的对话必须严格遵循该 NPC 的"性格"和"说话风格参考"中给的示例。你可以模仿风格但不能照搬原句。NPC 之间的说话方式必须有区别。请不要代替 NPC 说长段独白——NPC 的回应应当简洁自然，像真实对话。`
}

function extractJsonFromText(text: string): string | null {
  const firstBrace = text.indexOf('{')
  if (firstBrace === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = firstBrace; i < text.length; i++) {
    const ch = text[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (ch === '\\' && inString) {
      escaped = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        return text.substring(firstBrace, i + 1)
      }
    }
  }

  return null
}

function parseAIResponse(text: string): AIResponse {
  const trimmed = text.trim()

  // 1. 直接解析纯 JSON
  try {
    return JSON.parse(trimmed) as AIResponse
  } catch {}

  // 2. 从 markdown 代码块提取
  try {
    const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim()) as AIResponse
    }
  } catch {}

  // 3. 从混合文本中提取 JSON 对象（处理 AI 在 JSON 前后附加文字的情况）
  const extracted = extractJsonFromText(trimmed)
  if (extracted) {
    try {
      return JSON.parse(extracted) as AIResponse
    } catch {}
  }

  // 4. 兜底：整段文本作为 narration
  return {
    narration: trimmed,
    options: [
      { text: '继续前进' },
      { text: '仔细观察周围' },
      { text: '与附近的人交谈' },
    ],
    attributeChanges: {},
    npcAffinityChanges: {},
    newFlags: [],
    lostFlags: [],
    itemsGained: [],
    itemsLost: [],
  }
}

function validateAIResponse(response: AIResponse, fallbackText: string): AIResponse {
  if (!response.narration) response.narration = fallbackText.trim()
  if (!response.options || response.options.length === 0) response.options = [{ text: '继续...' }]
  if (!response.attributeChanges) response.attributeChanges = {}
  if (!response.npcAffinityChanges) response.npcAffinityChanges = {}
  if (!response.newFlags) response.newFlags = []
  if (!response.lostFlags) response.lostFlags = []
  if (!response.itemsGained) response.itemsGained = []
  if (!response.itemsLost) response.itemsLost = []
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

async function callAnthropic(apiKey: string, systemPrompt: string, messages: Anthropic.MessageParam[], model?: string, advancedParams?: AdvancedParams): Promise<string> {
  const client = new Anthropic({ apiKey })
  const createParams: Record<string, any> = {
    model: model || 'claude-sonnet-4-6',
    max_tokens: advancedParams?.max_tokens ?? 1024,
    system: systemPrompt,
    messages,
  }
  if (advancedParams?.temperature !== undefined) createParams.temperature = advancedParams.temperature
  if (advancedParams?.top_p !== undefined) createParams.top_p = advancedParams.top_p
  if (advancedParams?.top_k !== undefined) createParams.top_k = advancedParams.top_k

  const response = await client.messages.create(createParams)
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

async function callOpenAI(
  apiKey: string,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  baseURL?: string,
  model?: string,
  advancedParams?: AdvancedParams,
): Promise<string> {
  const client = new OpenAI({ apiKey, baseURL })
  const createParams: Record<string, any> = {
    model: model || 'gpt-4o',
    max_tokens: advancedParams?.max_tokens ?? 1024,
    messages,
  }
  if (advancedParams?.temperature !== undefined) createParams.temperature = advancedParams.temperature
  if (advancedParams?.top_p !== undefined) createParams.top_p = advancedParams.top_p
  if (advancedParams?.stream !== undefined) createParams.stream = advancedParams.stream

  const response = await client.chat.completions.create(createParams)
  return response.choices[0]?.message?.content ?? ''
}

// ====== Route Handler ======

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { worldCard, playerState, dialogueHistory, npcAffinities, apiKey: requestApiKey, provider: requestProvider, model: requestModel, customBaseURL, advancedParams } = body as {
      worldCard: WorldCard
      playerState: PlayerState
      dialogueHistory: DialogueEntry[]
      npcAffinities?: Record<string, number>
      npcRuntime?: Record<string, { currentSelfPerception: string; currentState: string }>
      apiKey?: string
      provider?: Provider
      model?: string
      customBaseURL?: string
      advancedParams?: AdvancedParams
    }

    if (!worldCard || !playerState || !dialogueHistory) {
      return NextResponse.json({ error: '请求体不完整' }, { status: 400 })
    }

    const apiKey = getApiKey(requestApiKey)
    const provider = requestProvider || detectProvider(apiKey)
    const systemPrompt = buildSystemPrompt(worldCard, playerState, npcAffinities ?? {}, body.npcRuntime ?? {})

    // 带超时的 API 调用
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    let text: string
    try {
      const model = requestModel || (provider === 'anthropic' ? 'claude-sonnet-4-6' : provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o')

      if (provider === 'anthropic') {
        const messages = buildAnthropicMessages(dialogueHistory, worldCard)
        text = await callAnthropic(apiKey, systemPrompt, messages, model, advancedParams)
      } else {
        const baseURL = provider === 'deepseek' ? 'https://api.deepseek.com'
          : provider === 'custom' ? customBaseURL
          : undefined
        const messages = buildOpenAIMessages(dialogueHistory, worldCard, systemPrompt)
        text = await callOpenAI(apiKey, messages, baseURL || undefined, model, advancedParams)
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

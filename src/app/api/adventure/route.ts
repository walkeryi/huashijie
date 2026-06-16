// src/app/api/adventure/route.ts
import { NextRequest } from 'next/server'
import { streamText, tool, zodSchema, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai, createOpenAI } from '@ai-sdk/openai'
import { WorldCard, PlayerState, DialogueEntry } from '@/lib/types'
import { updateStateSchema } from '@/lib/tool-schema'

function getApiKey(apiKeyOverride?: string): string {
  const key = apiKeyOverride || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
  if (!key) throw new Error('缺少 API Key：请在页面输入或设置环境变量')
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

  const inventoryText = playerState.inventory && playerState.inventory.length > 0
    ? playerState.inventory.map(item => `- ${item}`).join('\n')
    : '空'

  const flagsText = playerState.flags
    ? Object.entries(playerState.flags).filter(([, val]) => val).map(([key]) => `- ${key}`).join('\n')
    : ''
  const flagsDisplay = flagsText || '无'

  const beats = worldCard.storyBeats ?? []
  const completedBeats = beats.filter(b => playerState.flags?.[b.id]).map(b => b.name)
  const availableBeats = beats.filter(b => {
    if (playerState.flags?.[b.id]) return false
    const anyUnlockerComplete = b.id === 'intro' || beats.some(
      ub => ub.unlocks.includes(b.id) && playerState.flags?.[ub.id]
    )
    if (!anyUnlockerComplete) return false
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
3. 故事的走向应该受玩家属性影响
4. 每次回复首先输出叙述文本（200-400字），然后调用 update_state 工具输出游戏数据
5. 故事节拍规则：玩家的行动应朝向解锁🔓可用的节拍

## 重要规则
- 先用纯中文写叙述（200-400字），语言优美有画面感
- 叙述结束后，**必须**调用 update_state 工具输出选项/属性变化/物品变化/旗标变化
- **当你调用 update_state 工具后，本回合即告结束，请勿在工具调用后继续输出任何文本。**
- 好感度高的 NPC 主动提供帮助；好感度低的 NPC 拒绝交流或成为障碍
- NPC 对话约束：你为 NPC 编写的对话必须严格遵循该 NPC 的性格和说话风格参考`
}

function buildMessages(
  dialogueHistory: DialogueEntry[],
  worldCard: WorldCard,
) {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

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
      content: `[游戏开始]\n初始场景：${worldCard.initialScene}\n\n请根据以上场景开始叙述，并调用 update_state 工具。`,
    })
  }

  return messages
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      worldCard, playerState, dialogueHistory, npcAffinities, npcRuntime,
      apiKey: requestApiKey, provider, model, customBaseURL, advancedParams,
    } = body as {
      worldCard: WorldCard
      playerState: PlayerState
      dialogueHistory: DialogueEntry[]
      npcAffinities?: Record<string, number>
      npcRuntime?: Record<string, { currentSelfPerception: string; currentState: string }>
      apiKey?: string
      provider?: string
      model?: string
      customBaseURL?: string
      advancedParams?: Record<string, any>
    }

    if (!worldCard || !playerState || !dialogueHistory) {
      return new Response(JSON.stringify({ error: '请求体不完整' }), { status: 400 })
    }

    const apiKey = getApiKey(requestApiKey)
    const systemPrompt = buildSystemPrompt(worldCard, playerState, npcAffinities ?? {}, npcRuntime ?? {})
    const messages = buildMessages(dialogueHistory, worldCard)

    const modelInstance = provider === 'anthropic'
      ? anthropic(model || 'claude-sonnet-4-6')
      : customBaseURL
        ? createOpenAI({ baseURL: customBaseURL })(model || 'gpt-4o')
        : openai(model || 'gpt-4o')

    const result = streamText({
      model: modelInstance,
      system: systemPrompt,
      messages,
      tools: {
        update_state: tool({
          description: '更新游戏状态、选项、属性和物品。调用后本回合即告结束。',
          inputSchema: zodSchema(updateStateSchema),
        }),
      },
      stopWhen: stepCountIs(2),
      ...(advancedParams?.temperature !== undefined && { temperature: advancedParams.temperature }),
      ...(advancedParams?.max_tokens !== undefined && { maxTokens: advancedParams.max_tokens }),
      ...(advancedParams?.top_p !== undefined && { topP: advancedParams.top_p }),
    })

    return result.toUIMessageStreamResponse()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('API Error:', message)
    return new Response(JSON.stringify({ error: '内部服务器错误' }), { status: 500 })
  }
}

// src/app/api/adventure/narrate/route.ts
// Stage 2: Story Writer — 把变更结果 + 玩家行动写成沉浸式叙述（SSE 流）

import { NextRequest } from 'next/server'
import { streamText } from 'ai'
import { WorldCard, PlayerState, DialogueEntry } from '@/lib/types'
import { createModelInstance, resolveApiKey } from '@/lib/create-model-instance'

function sanitizePlayerName(name: string): string {
  return name.replace(/[\n\r\\]/g, '').slice(0, 50)
}

function buildNarratorSystemPrompt(
  worldCard: WorldCard,
  playerState: PlayerState,
): string {
  const attrText = Object.entries(playerState.attributes ?? {})
    .map(([key, val]) => {
      const def = worldCard.attributes.find(a => a.key === key)
      return def ? `${def.icon} ${def.name}: ${val}/${def.max}` : `${key}: ${val}`
    })
    .join('\n')

  return `你是一个文字冒险游戏的叙事引擎。你的职责是：基于当前世界设定和本轮发生的状态变化，写一段沉浸式的叙述。

## 世界设定
${worldCard.description}

## 玩家当前状态
- 姓名：${sanitizePlayerName(playerState.playerName)}
${attrText}

## 写作要求
1. 写一段 200-400 字的中文叙述，描述场景和 NPC 反应
2. 语言有画面感，沉浸式，让玩家身临其境
3. 根据本轮发生的状态变化展开故事
4. 不要输出任何结构化内容（如 JSON、列表、工具调用）
5. 纯文本叙述即可，不要生成选项

注意：只写叙述，不要提供选项，不要调用任何工具。`
}

function buildNarratorMessages(
  dialogueHistory: DialogueEntry[],
  worldCard: WorldCard,
  playerAction: string,
  stateChanges: Record<string, unknown>,
  memoryFacts?: string[],
) {
  const factsPrefix = memoryFacts && memoryFacts.length > 0
    ? `[已知线索]\n${memoryFacts.map(f => `• ${f}`).join('\n')}\n\n`
    : ''

  // 最近对话历史
  const recentHistory = dialogueHistory.slice(-8)
  const historyText = recentHistory.map(entry =>
    entry.role === 'player' ? `玩家：${entry.content}`
      : `旁白：${entry.content}`
  ).join('\n')

  // 生成状态变更摘要
  const changes: string[] = []
  const attrChanges = stateChanges.attributeChanges as Record<string, number> | undefined
  const affChanges = stateChanges.npcAffinityChanges as Record<string, number> | undefined
  const newFlags = stateChanges.newFlags as string[] | undefined
  const lostFlags = stateChanges.lostFlags as string[] | undefined
  const itemsGained = stateChanges.itemsGained as string[] | undefined
  const itemsLost = stateChanges.itemsLost as string[] | undefined

  if (attrChanges && Object.keys(attrChanges).length > 0) {
    changes.push(`属性变化：${Object.entries(attrChanges).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join('、')}`)
  }
  if (affChanges && Object.keys(affChanges).length > 0) {
    changes.push(`好感度变化：${Object.entries(affChanges).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join('、')}`)
  }
  if (newFlags && newFlags.length > 0) changes.push(`新旗标：${newFlags.join('、')}`)
  if (lostFlags && lostFlags.length > 0) changes.push(`旗标移除：${lostFlags.join('、')}`)
  if (itemsGained && itemsGained.length > 0) changes.push(`获得物品：${itemsGained.join('、')}`)
  if (itemsLost && itemsLost.length > 0) changes.push(`失去物品：${itemsLost.join('、')}`)

  const changeSummary = changes.length > 0
    ? `\n\n本轮已发生的状态变化（据此展开叙述）：\n${changes.join('\n')}`
    : ''

  return [
    {
      role: 'user' as const,
      content: `${factsPrefix}## 对话历史（最近）
${historyText || '(新游戏)'}

## 本轮玩家行动
${playerAction}${changeSummary}

请根据以上信息，写一段 200-400 字的中文叙述。只输出叙述文本。`,
    },
  ]
}

export async function POST(request: NextRequest) {
  const start = Date.now()

  try {
    const body = await request.json()
    const {
      worldCard, playerState, playerAction, stateChanges, dialogueHistory, memoryFacts,
      apiKey: requestApiKey, provider, model, customBaseURL, advancedParams,
    } = body as {
      worldCard: WorldCard
      playerState: PlayerState
      playerAction?: string
      stateChanges?: Record<string, unknown>
      dialogueHistory: DialogueEntry[]
      memoryFacts?: string[]
      apiKey?: string
      provider?: string
      model?: string
      customBaseURL?: string
      advancedParams?: Record<string, unknown>
    }

    if (!worldCard || !playerState) {
      return new Response(JSON.stringify({ error: '请求体不完整' }), { status: 400 })
    }

    const apiKey = resolveApiKey(provider, requestApiKey)
    if (!apiKey) {
      return new Response(JSON.stringify({ error: '缺少 API Key' }), { status: 400 })
    }

    // 清理非标准参数
    const cleanParams: Record<string, unknown> = {}
    if (advancedParams?.temperature !== undefined) cleanParams.temperature = advancedParams.temperature
    if (advancedParams?.max_tokens !== undefined) cleanParams.max_tokens = advancedParams.max_tokens
    if (advancedParams?.top_p !== undefined) cleanParams.top_p = advancedParams.top_p

    const modelInstance = createModelInstance({ provider, apiKey, model, customBaseURL })

    // 应用状态变更后的玩家状态用于叙述
    const stateChangesObj = stateChanges ?? {}
    const applyResult = applyStateChangesToPlayer(playerState, stateChangesObj, worldCard)
    const updatedPlayerState = applyResult.playerState

    const systemPrompt = buildNarratorSystemPrompt(worldCard, updatedPlayerState)
    const messages = buildNarratorMessages(
      dialogueHistory, worldCard,
      playerAction || '开始冒险',
      stateChangesObj,
      memoryFacts,
    )

    const result = streamText({
      model: modelInstance,
      system: systemPrompt,
      messages,
      temperature: 0.7, // 创意任务用较高温度
      ...(typeof cleanParams.temperature === 'number' && { temperature: cleanParams.temperature }),
      ...(typeof cleanParams.max_tokens === 'number' && { maxTokens: cleanParams.max_tokens }),
      ...(typeof cleanParams.top_p === 'number' && { topP: cleanParams.top_p }),
    })

    return result.toUIMessageStreamResponse()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const latency = Date.now() - start
    console.error('[adventure-narrate] ❌ 失败 (耗时', latency, 'ms):', message)
    return new Response(JSON.stringify({ error: '内部服务器错误' }), { status: 500 })
  }
}

/** 在服务端临时应用状态变更，用于叙述生成的上下文 */
function applyStateChangesToPlayer(
  playerState: PlayerState,
  changes: Record<string, unknown>,
  worldCard: WorldCard,
) {
  const newAttrs = { ...playerState.attributes }
  const attrChanges = changes.attributeChanges as Record<string, number> | undefined
  if (attrChanges) {
    for (const [key, delta] of Object.entries(attrChanges)) {
      if (key in newAttrs) {
        const def = worldCard.attributes.find(a => a.key === key)
        const maxVal = def?.max ?? 10
        newAttrs[key] = Math.max(0, Math.min(newAttrs[key] + delta, maxVal))
      }
    }
  }

  let newInventory = [...(playerState.inventory ?? [])]
  const itemsGained = changes.itemsGained as string[] | undefined
  const itemsLost = changes.itemsLost as string[] | undefined
  if (itemsGained) {
    for (const item of itemsGained) {
      if (!newInventory.includes(item)) newInventory.push(item)
    }
  }
  if (itemsLost) {
    newInventory = newInventory.filter(item => !itemsLost.includes(item))
  }

  const newFlags = { ...playerState.flags }
  const newFlagsArr = changes.newFlags as string[] | undefined
  const lostFlags = changes.lostFlags as string[] | undefined
  if (newFlagsArr) for (const flag of newFlagsArr) newFlags[flag] = true
  if (lostFlags) for (const flag of lostFlags) newFlags[flag] = false

  return {
    playerState: {
      ...playerState,
      attributes: newAttrs,
      inventory: newInventory,
      flags: newFlags,
    },
  }
}

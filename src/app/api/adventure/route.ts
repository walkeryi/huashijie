// src/app/api/adventure/route.ts
import { NextRequest } from 'next/server'
import { streamText, tool, zodSchema, stepCountIs } from 'ai'
import { WorldCard, PlayerState, DialogueEntry } from '@/lib/types'
import { updateStateSchema } from '@/lib/tool-schema'
import { createModelInstance, resolveApiKey } from '@/lib/create-model-instance'

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

## 回复格式（严格遵守）
1. **第一步**：写一段中文叙述（200-400字），描述场景和 NPC 反应，语言有画面感
2. **第二步**：叙述写完后，调用 update_state 工具结束本回合

⚠️ 禁止跳过第一步直接调用工具！没有叙述的回复是无效的。

## 属性变化规则
根据玩家行为调整属性，使用以下幅度约束：
| 行为类型 | 变化幅度 | 示例 |
|----------|---------|------|
| 轻微尝试（观察、询问） | ±0~1 | 智慧 +1 |
| 明确行动（战斗、说服） | ±1~2 | 勇气 +2 |
| 重大转折（舍命救人、背叛） | ±2~3 | 勇气 +3，生命 -2 |
| 受伤/失败 | -1~2 | 生命 -2 |

- 属性变化必须体现在 update_state 的 attributeChanges 字段中
- 同一行为在不同情境下可产生不同幅度，但要保持逻辑一致
- TODO: 约束表应基于世界卡的属性定义动态生成，而非硬编码属性名

## 好感度变化规则
根据与 NPC 的互动调整好感度，使用以下幅度约束：
| 互动类型 | 变化幅度 | 示例 |
|----------|---------|------|
| 礼貌问候、普通对话 | ±0~5 | 守卫队长 +5 |
| 帮助/支持 NPC | +5~10 | 法师 +10 |
| 救命之恩、重大牺牲 | +15~25 | 国王 +20 |
| 冒犯/轻视 NPC | -5~10 | 守卫 -8 |
| 欺骗/背叛 NPC | -15~25 | 法师 -20 |

- 好感度变化必须体现在 update_state 的 npcAffinityChanges 字段中
- TODO: 极值（±20以上）应触发好感度等级突破事件，当前版本仅记录数值

## 工具调用规则
- 叙述写完后必须调用 update_state，提供 2-4 个后续选项
- 如本回合有属性或好感度变化，必须填入 attributeChanges 和 npcAffinityChanges
- 调用后立即停止，不追加任何文本

[模型适配] 当前提示词针对 DeepSeek Chat 验证通过（3轮 100% 调用率）。
切换至 GPT-4 或 Claude 时，需重新验证工具调用率，可能需要 toolChoice: 'required' 参数。`
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
  const start = Date.now()
  console.log('[adventure] POST 请求到达')

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

    console.log('[adventure] 解析参数:', {
      provider,
      model,
      customBaseURL: customBaseURL || '(无)',
      apiKeyLen: requestApiKey?.length ?? 0,
      apiKeyPrefix: requestApiKey?.slice(0, 10) ?? '(空)',
      worldCardId: worldCard?.id ?? '(空)',
      dialogueHistoryLen: dialogueHistory?.length ?? 0,
    })

    if (!worldCard || !playerState || !dialogueHistory) {
      console.log('[adventure] ❌ 请求体不完整')
      return new Response(JSON.stringify({ error: '请求体不完整' }), { status: 400 })
    }

    const apiKey = resolveApiKey(provider, requestApiKey)
    if (!apiKey) {
      return new Response(JSON.stringify({ error: '缺少 API Key：请在页面输入或设置环境变量' }), { status: 400 })
    }
    const systemPrompt = buildSystemPrompt(worldCard, playerState, npcAffinities ?? {}, npcRuntime ?? {})
    const messages = buildMessages(dialogueHistory, worldCard)

    console.log('[adventure] 构建消息数:', messages.length, 'systemPrompt 长度:', systemPrompt.length)

    const modelInstance = createModelInstance({ provider, apiKey, model, customBaseURL })

    console.log('[adventure] 模型实例已创建，调用 streamText...')

    const result = streamText({
      model: modelInstance,
      system: systemPrompt,
      messages,
      tools: {
        update_state: tool({
          description:
            '【每次回复必须调用】更新游戏状态并结束本回合。' +
            '提供 2-4 个后续选项、属性变化（attributeChanges）、' +
            'NPC 好感度变化（npcAffinityChanges）、物品得失、旗标变化。' +
            '调用后立即停止输出，不要再追加任何文本。',
          inputSchema: zodSchema(updateStateSchema),
        }),
      },
      stopWhen: stepCountIs(2),
      ...(advancedParams?.temperature !== undefined && { temperature: advancedParams.temperature }),
      ...(advancedParams?.max_tokens !== undefined && { maxTokens: advancedParams.max_tokens }),
      ...(advancedParams?.top_p !== undefined && { topP: advancedParams.top_p }),
    })

    console.log('[adventure] streamText 已创建，返回流响应, 总耗时:', Date.now() - start, 'ms')
    return result.toUIMessageStreamResponse()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    const latency = Date.now() - start
    console.error('[adventure] ❌ 失败 (耗时', latency, 'ms):', message)
    if (stack) console.error('[adventure] 堆栈:', stack)
    return new Response(JSON.stringify({ error: '内部服务器错误' }), { status: 500 })
  }
}

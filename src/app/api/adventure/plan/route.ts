// src/app/api/adventure/plan/route.ts
// Stage 1: Turn Planner — 理解玩家意图，决定本轮状态变更
// 使用 generateText + Output.json()（v6 API），兼容不支持 structuredOutputs 的 Provider

import { NextRequest } from 'next/server'
import { generateText, Output } from 'ai'
import { WorldCard, PlayerState, DialogueEntry } from '@/lib/types'
import { createModelInstance, resolveApiKey } from '@/lib/create-model-instance'

function sanitizePlayerName(name: string): string {
  return name.replace(/[\n\r\\]/g, '').slice(0, 50)
}

export function buildPlannerSystemPrompt(
  worldCard: WorldCard,
  playerState: PlayerState,
  npcAffinities: Record<string, number> = {},
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

  return `你是一个文字冒险游戏的状态变更引擎。你的职责是：基于玩家的行动和当前游戏状态，决定本轮需要发生的状态变化。

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

## 你的任务
只输出本轮状态变更，不写叙述，不生成选项。输出 JSON 格式的状态变更。

## 属性变化规则
根据玩家行为调整属性，使用以下幅度约束：
| 行为类型 | 变化幅度 | 示例 |
|----------|---------|------|
| 轻微尝试（观察、询问） | ±0~1 | 智慧 +1 |
| 明确行动（战斗、说服） | ±1~2 | 勇气 +2 |
| 重大转折（舍命救人、背叛） | ±2~3 | 勇气 +3，生命 -2 |
| 受伤/失败 | -1~2 | 生命 -2 |

## 好感度变化规则
根据与 NPC 的互动调整好感度，使用以下幅度约束：
| 互动类型 | 变化幅度 | 示例 |
|----------|---------|------|
| 礼貌问候、普通对话 | ±0~5 | 守卫队长 +5 |
| 帮助/支持 NPC | +5~10 | 法师 +10 |
| 救命之恩、重大牺牲 | +15~25 | 国王 +20 |
| 冒犯/轻视 NPC | -5~10 | 守卫 -8 |
| 欺骗/背叛 NPC | -15~25 | 法师 -20 |

注意：只输出 JSON 对象，不要包含任何其他文本或 markdown 代码块。`
}

function buildPlannerMessages(
  dialogueHistory: DialogueEntry[],
  worldCard: WorldCard,
  memoryFacts?: string[],
  playerAction?: string,
) {
  const factsPrefix = memoryFacts && memoryFacts.length > 0
    ? `[已知线索]\n${memoryFacts.map(f => `• ${f}`).join('\n')}\n\n`
    : ''

  // 最近对话摘要
  const recentHistory = dialogueHistory.slice(-6)
  const historyText = recentHistory.map(entry =>
    entry.role === 'player' ? `玩家：${entry.content}`
      : `旁白：${entry.content.slice(0, 150)}`
  ).join('\n')

  const action = playerAction || '开始冒险'

  return [
    {
      role: 'user' as const,
      content: `${factsPrefix}## 对话历史（最近）
${historyText || '(新游戏)'}

## 本轮玩家行动
${action}

请根据以上信息，输出本轮应发生的状态变化（JSON 格式）。如果没有需要的变化，输出空对象 {}。`,
    },
  ]
}

function parsePlanJSON(text: string): Record<string, unknown> {
  const trimmed = text.trim()
  // 去掉可能的 markdown 代码块包裹
  const jsonStr = trimmed.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  try {
    return JSON.parse(jsonStr) as Record<string, unknown>
  } catch {
    // 尝试提取第一个 { 到最后一个 } 之间的内容
    const firstBrace = jsonStr.indexOf('{')
    const lastBrace = jsonStr.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(jsonStr.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>
      } catch { /* fall through */ }
    }
    return {}
  }
}

/** 把 DeepSeek 各种 JSON 产出归一化为标准 Plan 格式 */
function normalizePlanOutput(raw: Record<string, unknown>): Record<string, unknown> {
  if (!raw || Object.keys(raw).length === 0) return raw

  // 已经是标准格式
  const STD_KEYS = ['attributeChanges', 'npcAffinityChanges', 'newFlags', 'lostFlags', 'itemsGained', 'itemsLost']
  if (STD_KEYS.some(k => k in raw)) return raw

  // 归一化单个对象（可递归）
  function normalize(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}

    for (const [key, val] of Object.entries(obj)) {
      // === 旗标类：key 含 "flag" 或中文"旗标" ===
      if (/flag|旗标/i.test(key)) {
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          // { flag: { "xxx": true, "yyy": false } } 或 { flags: { set: [...], lost: [...] } }
          const v = val as Record<string, unknown>
          if (Array.isArray(v.set)) out.newFlags = [...(out.newFlags as string[] || []), ...v.set as string[]]
          if (Array.isArray(v.added)) out.newFlags = [...(out.newFlags as string[] || []), ...v.added as string[]]
          if (Array.isArray(v.添加)) out.newFlags = [...(out.newFlags as string[] || []), ...v.添加 as string[]]
          if (Array.isArray(v.lost)) out.lostFlags = [...(out.lostFlags as string[] || []), ...v.lost as string[]]
          if (Array.isArray(v.删除)) out.lostFlags = [...(out.lostFlags as string[] || []), ...v.删除 as string[]]
          if (Array.isArray(v.移除)) out.lostFlags = [...(out.lostFlags as string[] || []), ...v.移除 as string[]]
          // 直接 key-value 布尔
          for (const [fk, fv] of Object.entries(v)) {
            if (/^(set|added|lost|添加|删除|移除)$/.test(fk)) continue
            if (fv === true) out.newFlags = [...(out.newFlags as string[] || []), fk]
            if (fv === false) out.lostFlags = [...(out.lostFlags as string[] || []), fk]
          }
        } else if (Array.isArray(val)) {
          out.newFlags = [...(out.newFlags as string[] || []), ...val as string[]]
        }
        continue
      }

      // === 物品类：key 含 "item"、"inventory" 或中文"物品" ===
      if (/item|inventory|物品/i.test(key)) {
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          const v = val as Record<string, unknown>
          if (Array.isArray(v.added)) out.itemsGained = v.added
          if (Array.isArray(v.gained)) out.itemsGained = v.gained
          if (Array.isArray(v.lost)) out.itemsLost = v.lost
        } else if (Array.isArray(val)) {
          out.itemsGained = val
        }
        continue
      }

      // === 好感度类（必须在属性之前，因"好感度变化"也含"变化"） ===
      if (/npc|affinity|好感/i.test(key)) {
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          const v = val as Record<string, unknown>
          if (!out.npcAffinityChanges) out.npcAffinityChanges = {}
          for (const [nk, nv] of Object.entries(v)) {
            if (typeof nv === 'number') (out.npcAffinityChanges as Record<string, number>)[nk] = nv
          }
        }
        continue
      }

      // === 属性类：key 含 "attr" 或 "属性"（不含"变化"，太泛） ===
      if (/attr|^属性$|属性/.test(key) && !/好感|旗标/i.test(key)) {
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          const v = val as Record<string, unknown>
          if (!out.attributeChanges) out.attributeChanges = {}
          for (const [ak, av] of Object.entries(v)) {
            if (typeof av === 'number') (out.attributeChanges as Record<string, number>)[ak] = av
          }
        }
        continue
      }

      // === 值本身是嵌套对象 → 可能是包装层（如 { "玩家": {...} }），递归 ===
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        const inner = normalize(val as Record<string, unknown>)
        // 合并递归结果
        for (const [ik, iv] of Object.entries(inner)) {
          if (ik === 'attributeChanges' || ik === 'npcAffinityChanges') {
            if (!out[ik]) out[ik] = {}
            Object.assign(out[ik] as Record<string, unknown>, iv as Record<string, unknown>)
          } else if (ik === 'newFlags' || ik === 'lostFlags' || ik === 'itemsGained' || ik === 'itemsLost') {
            out[ik] = [...(out[ik] as string[] || []), ...iv as string[]]
          }
        }
        continue
      }

      // === 值直接是数字 → 当作属性变化 ===
      if (typeof val === 'number') {
        if (!out.attributeChanges) out.attributeChanges = {}
        ;(out.attributeChanges as Record<string, number>)[key] = val
        continue
      }

      // === 值直接是字符串数组 → 可能是 flag 或 item ===
      if (Array.isArray(val) && val.every(v => typeof v === 'string')) {
        // 默认当新旗标
        out.newFlags = [...(out.newFlags as string[] || []), ...val as string[]]
        continue
      }
    }

    return out
  }

  const result = normalize(raw)
  if (Object.keys(result).length === 0) return raw
  return result
}

export async function POST(request: NextRequest) {
  const start = Date.now()

  try {
    const body = await request.json()
    const {
      worldCard, playerState, playerAction, dialogueHistory, memoryFacts,
      npcAffinities,
      apiKey: requestApiKey, provider, model, customBaseURL,
    } = body as {
      worldCard: WorldCard
      playerState: PlayerState
      playerAction?: string
      dialogueHistory: DialogueEntry[]
      memoryFacts?: string[]
      npcAffinities?: Record<string, number>
      apiKey?: string
      provider?: string
      model?: string
      customBaseURL?: string
    }

    if (!worldCard || !playerState) {
      return new Response(JSON.stringify({ error: '请求体不完整' }), { status: 400 })
    }

    const apiKey = resolveApiKey(provider, requestApiKey)
    if (!apiKey) {
      return new Response(JSON.stringify({ error: '缺少 API Key' }), { status: 400 })
    }

    const modelInstance = createModelInstance({ provider, apiKey, model, customBaseURL })
    const systemPrompt = buildPlannerSystemPrompt(worldCard, playerState, npcAffinities ?? {})
    const messages = buildPlannerMessages(dialogueHistory, worldCard, memoryFacts, playerAction)

    const result = await generateText({
      model: modelInstance,
      system: systemPrompt,
      messages,
      output: Output.json(),
      temperature: 0.3,
    })

    // result.output 在 Output.json() 成功时已是解析好的对象，失败回退时是字符串
    const output = result.output
    console.error('[adventure-plan] 🔍 result.output typeof:', typeof output)
    console.error('[adventure-plan] 🔍 result.output isArray:', Array.isArray(output))
    console.error('[adventure-plan] 🔍 result.output keys:', typeof output === 'object' && output !== null && !Array.isArray(output) ? Object.keys(output as object) : 'N/A')
    console.error('[adventure-plan] 🔍 result.output value:', JSON.stringify(output).slice(0, 500))

    let rawPlan: Record<string, unknown> =
      typeof output === 'object' && output !== null
        ? (output as Record<string, unknown>)
        : parsePlanJSON(String(output))

    // 容错：把 DeepSeek 的任意 JSON 格式归一化为 { attributeChanges?, npcAffinityChanges?, ... }
    rawPlan = normalizePlanOutput(rawPlan)

    console.error('[adventure-plan] 🔍 最终 plan keys:', Object.keys(rawPlan))

    return new Response(JSON.stringify(rawPlan), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const latency = Date.now() - start
    console.error('[adventure-plan] ❌ 失败 (耗时', latency, 'ms):', message)
    // 从 NoObjectGeneratedError 中提取 AI 原始文本
    const errorWithText = error as { text?: string } | undefined
    if (typeof errorWithText?.text === 'string') {
      console.error('[adventure-plan] AI 原始输出:', errorWithText.text.slice(0, 300))
    }
    // 失败降级：返回空对象（本轮无状态变化）
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

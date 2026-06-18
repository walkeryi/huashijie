'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useGame } from '@/lib/game-context'
import { sharedEventBus } from '@/lib/event-bus'
import { debouncedAutoSave } from '@/lib/save-service'
import { deduplicateFacts } from '@/lib/fact-dedup'
import type { PlayerState } from '@/lib/types'
import { type PlanArgs } from '@/lib/tool-schema'
import DialogueBox from './DialogueBox'
import OptionsPanel from './OptionsPanel'
import StatusPanel from './StatusPanel'
import GameToolbar from './GameToolbar'

// 本地 SSE 解析器 — 解析 AI SDK v6 UIMessageStream 格式
async function* readDataStream(
  body: ReadableStream<Uint8Array>,
  { signal }: { signal?: AbortController['signal'] } = {},
): AsyncGenerator<{ type: string; [key: string]: unknown }> {
  const decoder = new TextDecoder()
  const reader = body.getReader()
  let buffer = ''
  try {
    while (true) {
      if (signal?.aborted) { reader.releaseLock(); return }
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n')
      buffer = parts.pop() || ''
      for (const line of parts) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') return
          try { yield JSON.parse(data) } catch { /* 跳过无效 JSON */ }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/** 在客户端临时应用状态变更，供后续阶段构造请求体 */
function computeUpdatedPlayerState(
  current: PlayerState,
  stateChanges: PlanArgs,
  worldCardAttrs: { key: string; max: number }[],
): PlayerState {
  const newAttrs = { ...current.attributes }
  const attrChanges = stateChanges.attributeChanges as Record<string, number> | undefined
  if (attrChanges) {
    for (const [key, delta] of Object.entries(attrChanges)) {
      if (key in newAttrs) {
        const def = worldCardAttrs.find(a => a.key === key)
        const maxVal = def?.max ?? 10
        newAttrs[key] = Math.max(0, Math.min(newAttrs[key] + delta, maxVal))
      }
    }
  }

  let newInventory = [...(current.inventory ?? [])]
  const itemsGained = stateChanges.itemsGained as string[] | undefined
  const itemsLost = stateChanges.itemsLost as string[] | undefined
  if (itemsGained) {
    for (const item of itemsGained) {
      if (!newInventory.includes(item)) newInventory.push(item)
    }
  }
  if (itemsLost) {
    newInventory = newInventory.filter(item => !itemsLost.includes(item))
  }

  const newFlags = { ...current.flags }
  const newFlagsArr = stateChanges.newFlags as string[] | undefined
  const lostFlags = stateChanges.lostFlags as string[] | undefined
  if (newFlagsArr) for (const flag of newFlagsArr) newFlags[flag] = true
  if (lostFlags) for (const flag of lostFlags) newFlags[flag] = false

  return {
    ...current,
    attributes: newAttrs,
    inventory: newInventory,
    flags: newFlags,
  }
}

export default function GameScreen() {
  const { state, actions } = useGame()
  const router = useRouter()
  const hasTriggeredRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  // 追踪最新 playerState/npcAffinities，避免自动存档闭包捕获过期值
  const latestStateRef = useRef({
    playerState: state.playerState,
    npcAffinities: state.npcAffinities,
    npcRuntime: state.npcRuntime,
  })
  useEffect(() => {
    latestStateRef.current = {
      playerState: state.playerState,
      npcAffinities: state.npcAffinities,
      npcRuntime: state.npcRuntime,
    }
  }, [state.playerState, state.npcAffinities, state.npcRuntime])

  // 构建通用 fetch payload 基础字段
  const basePayload = useCallback(() => ({
    apiKey: state.apiKey,
    provider: state.provider,
    model: state.model,
    customBaseURL: state.customBaseURL,
    advancedParams: state.advancedParams,
  }), [state.apiKey, state.provider, state.model, state.customBaseURL, state.advancedParams])

  // 核心交互 — 三阶段管线
  const submitAction = useCallback(async (optionText: string) => {
    // 取消上一轮未完成的流
    abortRef.current?.abort()

    const controller = new AbortController()
    abortRef.current = controller

    if (!state.worldCard || !state.playerState) {
      console.warn('[GameScreen] submitAction 跳过: 缺少 worldCard 或 playerState')
      return
    }

    console.log('[GameScreen] 提交选项:', optionText.slice(0, 50), '| provider:', state.provider, '| model:', state.model)

    const playerEntry = {
      id: 'player_' + Date.now(),
      role: 'player' as const,
      content: optionText,
      timestamp: Date.now(),
    }

    // 立即显示玩家气泡（不阻塞后续管线）
    actions.appendToDialogue(playerEntry)
    actions.setLoading(true)
    sharedEventBus.reset()

    const base = basePayload()

    try {
      // ==================== Stage 1: Plan ====================
      console.log('[GameScreen] Stage 1: Plan — 请求状态变更')
      const planPayload = {
        worldCard: state.worldCard,
        playerState: state.playerState,
        playerAction: optionText,
        dialogueHistory: [...state.dialogueHistory, playerEntry],
        memoryFacts: state.memoryFacts,
        npcAffinities: state.npcAffinities,
        npcRuntime: state.npcRuntime,
        ...base,
      }

      const planRes = await fetch('/api/adventure/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planPayload),
        signal: controller.signal,
      })

      const stateChanges: PlanArgs = planRes.ok ? await planRes.json() : {}
      console.log('[GameScreen] Stage 1 完成 | 变更:', JSON.stringify(stateChanges).slice(0, 200))

      // 计算更新后的玩家状态（用于后续阶段）
      const updatedPlayerState = computeUpdatedPlayerState(
        state.playerState,
        stateChanges,
        state.worldCard.attributes,
      )
      // 异步 dispatch 状态变更到 React（不阻塞后续流水线）
      actions.applyStateChanges({
        ...stateChanges,
        attributeDefs: state.worldCard.attributes,
      })

      // 计算更新后的好感度
      const updatedNpcAffinities = { ...state.npcAffinities }
      const affChanges = stateChanges.npcAffinityChanges as Record<string, number> | undefined
      if (affChanges) {
        for (const [key, delta] of Object.entries(affChanges)) {
          if (key in updatedNpcAffinities) {
            updatedNpcAffinities[key] = Math.max(0, Math.min(updatedNpcAffinities[key] + delta, 100))
          }
        }
      }

      // ==================== Stage 2: Narrate (SSE 流) ====================
      console.log('[GameScreen] Stage 2: Narrate — 请求叙述流')
      const narratePayload = {
        worldCard: state.worldCard,
        playerState: updatedPlayerState,
        playerAction: optionText,
        stateChanges,
        dialogueHistory: [...state.dialogueHistory, playerEntry],
        memoryFacts: state.memoryFacts,
        ...base,
      }

      const narrateRes = await fetch('/api/adventure/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(narratePayload),
        signal: controller.signal,
      })

      if (!narrateRes.ok) {
        const errText = await narrateRes.text().catch(() => '')
        throw new Error(errText || '叙述请求失败')
      }

      if (!narrateRes.body) {
        throw new Error('叙述响应体为空')
      }

      // 消费 SSE 流
      console.log('[GameScreen] 开始消费叙述 SSE 流...')
      const reader = readDataStream(narrateRes.body, { signal: controller.signal })
      let fullNarration = ''
      let chunkCount = 0

      for await (const part of reader) {
        if (part.type === 'text-delta') {
          chunkCount++
          fullNarration += part.delta as string
          sharedEventBus.append(part.delta as string)
        }
      }

      console.log('[GameScreen] Stage 2 完成 | 文本块数:', chunkCount, '| 旁白长度:', fullNarration.length)

      if (!fullNarration) {
        console.error('[GameScreen] ❌ AI 未返回叙述')
        actions.setError('AI 未返回有效响应，请重试')
        return
      }

      // ==================== Stage 3: Choices + extract-facts (并行) ====================
      console.log('[GameScreen] Stage 3: Choices + extract-facts — 并行请求')

      const [choicesRes, factsRes] = await Promise.all([
        fetch('/api/adventure/choices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            narration: fullNarration,
            playerAction: optionText,
            worldCard: state.worldCard,
            playerState: updatedPlayerState,
            ...base,
          }),
          signal: controller.signal,
        }),
        fetch('/api/adventure/extract-facts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            narration: fullNarration,
            existingFacts: state.memoryFacts,
            ...base,
          }),
          signal: controller.signal,
        }),
      ])

      // 处理选项
      if (choicesRes.ok) {
        const data = await choicesRes.json()
        const options = data.options ?? []
        console.log('[GameScreen] ✅ Choices 成功 | 选项数:', options.length)
        actions.setOptions(options)
      } else {
        console.warn('[GameScreen] ⚠️ Choices 失败，使用默认选项')
        actions.setOptions([
          { text: '继续前进' },
          { text: '仔细观察周围' },
          { text: '与附近的人交谈' },
        ])
      }

      // 处理记忆
      if (factsRes.ok) {
        const { facts, replaceFacts } = await factsRes.json()
        const updated = state.memoryFacts
          .filter((f: string) => !(replaceFacts ?? []).includes(f))
          .concat(facts ?? [])
        actions.updateMemoryFacts(deduplicateFacts(updated))
        console.log('[GameScreen] 🧠 记忆槽更新 | 新增:', (facts ?? []).length, '| 替换:', (replaceFacts ?? []).length)
      }

      // ==================== 归档 + 存档 ====================
      const narratorEntry = {
        id: 'narrator_' + Date.now(),
        role: 'narrator' as const,
        content: fullNarration,
        timestamp: Date.now(),
        model: state.model,
      }
      // 追加旁白气泡并结束 loading（玩家气泡已在提交时立即显示）
      actions.appendToDialogue(narratorEntry)
      actions.setLoading(false)
      const newHistory = [...state.dialogueHistory, playerEntry, narratorEntry]

      // 后台自动存档（2s 防抖）
      const latest = latestStateRef.current
      const saveData = {
        id: 'autosave',
        slotName: '自动存档',
        timestamp: Date.now(),
        worldCardId: state.worldCard!.id,
        playerState: latest.playerState!,
        dialogueHistory: newHistory,
        memoryFacts: state.memoryFacts,
        apiKey: state.apiKey,
        npcAffinities: latest.npcAffinities,
        npcRuntime: latest.npcRuntime,
      }
      debouncedAutoSave(saveData).catch(err => console.warn('[GameScreen] 自动存档失败:', err))

    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        console.log('[GameScreen] 请求被中止 (AbortError)')
        actions.setLoading(false)
        return
      }
      const message = e instanceof Error ? e.message : String(e)
      console.error('[GameScreen] ❌ catch 异常:', message)
      actions.setError(message || '未知错误')
    }
  }, [
    state.worldCard, state.playerState, state.dialogueHistory,
    state.apiKey, state.provider, state.model,
    state.npcAffinities, state.npcRuntime,
    state.memoryFacts,
    actions, basePayload,
  ])

  // 如果不在游戏中则重定向到首页
  useEffect(() => {
    console.log('[GameScreen] screen 变化:', state.screen, '| dialogueHistory 长度:', state.dialogueHistory.length, '| options 长度:', state.currentOptions.length)
    if (state.screen === 'menu') {
      router.replace('/')
    }
  }, [state.screen, router, state.dialogueHistory.length, state.currentOptions.length])

  // 新游戏首次触发 AI 开场
  useEffect(() => {
    if (
      !hasTriggeredRef.current &&
      state.screen === 'playing' &&
      state.dialogueHistory.length === 0 &&
      !state.isLoading &&
      state.currentOptions.length === 0
    ) {
      hasTriggeredRef.current = true
      submitAction('开始冒险')
    }
  }, [state.screen, state.dialogueHistory.length, state.isLoading, state.currentOptions.length, submitAction])

  if (state.screen !== 'playing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <p className="text-[var(--text-secondary)]">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <GameToolbar />
      <div className="flex flex-1">
        <div className="flex-1 flex flex-col min-w-0">
          <DialogueBox />
          {state.error && (
            <div className="mx-6 mb-3 p-3 rounded-xl bg-red-900/30 border border-red-800 text-red-300 text-sm">
              {state.error}
              <button onClick={() => submitAction('开始冒险')} className="ml-3 underline hover:text-red-200">重试</button>
            </div>
          )}
          <OptionsPanel onSubmit={submitAction} />
        </div>
        <StatusPanel />
      </div>
    </div>
  )
}

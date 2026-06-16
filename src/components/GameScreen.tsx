'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
// 本地 SSE 解析器 — AI SDK v6 不再导出 readDataStream
import { useGame } from '@/lib/game-context'
import { sharedEventBus } from '@/lib/event-bus'
import { debouncedAutoSave } from '@/lib/save-service'
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

export default function GameScreen() {
  const { state, actions } = useGame()
  const router = useRouter()
  const hasTriggeredRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  // 追踪最新 playerState/npcAffinities，避免自动存档闭包捕获过期值
  const latestStateRef = useRef({ playerState: state.playerState, npcAffinities: state.npcAffinities, npcRuntime: state.npcRuntime })
  latestStateRef.current = { playerState: state.playerState, npcAffinities: state.npcAffinities, npcRuntime: state.npcRuntime }

  // 核心交互 — readDataStream 消费 SSE 流
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

    actions.setLoading(true)
    sharedEventBus.reset()

    const playerEntry = {
      id: 'player_' + Date.now(),
      role: 'player' as const,
      content: optionText,
      timestamp: Date.now(),
    }

    try {
      const payload = {
        worldCard: state.worldCard,
        playerState: state.playerState,
        dialogueHistory: [...state.dialogueHistory, playerEntry],
        apiKey: state.apiKey,
        provider: state.provider,
        model: state.model,
        customBaseURL: state.customBaseURL,
        advancedParams: state.advancedParams,
        npcAffinities: state.npcAffinities,
        npcRuntime: state.npcRuntime,
      }
      console.log('[GameScreen] 发送 fetch 到 /api/adventure, 历史消息数:', payload.dialogueHistory.length)

      const response = await fetch('/api/adventure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      console.log('[GameScreen] 响应状态:', response.status, response.statusText, '| ok:', response.ok)

      if (!response.ok) {
        const errText = await response.text()
        console.error('[GameScreen] ❌ 响应非 200:', errText.slice(0, 200))
        throw new Error(errText || 'API 请求失败')
      }

      if (!response.body) {
        console.error('[GameScreen] ❌ 响应体为空')
        throw new Error('响应体为空')
      }

      console.log('[GameScreen] 开始解析 SSE 流...')
      const reader = readDataStream(response.body, { signal: controller.signal })

      let fullNarration = ''
      let toolCallOccurred = false
      let chunkCount = 0
      let otherEventCount = 0

      for await (const part of reader) {
        if (part.type === 'text-delta') {
          chunkCount++
          fullNarration += part.delta as string
          sharedEventBus.append(part.delta as string)
        }
        else if (part.type === 'tool-input-available' && part.toolName === 'update_state') {
          toolCallOccurred = true
          console.log('[GameScreen] 收到 tool-input-available (update_state), options 数:', (part.input as any)?.options?.length ?? 0)
          actions.updateState({
            ...(part.input as Record<string, unknown>),
            attributeDefs: state.worldCard?.attributes ?? [],
          })
        }
        else if (part.type && part.type !== 'text-delta') {
          otherEventCount++
          if (otherEventCount <= 5) {
            console.log('[GameScreen] SSE 其他事件:', part.type)
          }
        }
      }

      console.log('[GameScreen] SSE 流结束 | 文本块数:', chunkCount, '| 旁白长度:', fullNarration.length, '| toolCall:', toolCallOccurred, '| 其他事件:', otherEventCount, '条')

      // 降级兜底: 模型没调用 Tool
      if (!toolCallOccurred) {
        if (!fullNarration) {
          console.error('[GameScreen] ❌ AI 未返回有效响应')
          actions.setError('AI 未返回有效响应，请重试')
          return
        }
        console.warn('[GameScreen] ⚠️ 降级: AI 未调用 update_state，注入默认选项')
        actions.updateState({
          attributeChanges: {},
          npcAffinityChanges: {},
          itemsGained: [],
          itemsLost: [],
          newFlags: [],
          lostFlags: [],
          options: [
            { text: '继续前进' },
            { text: '仔细观察周围' },
            { text: '与附近的人交谈' },
          ],
          attributeDefs: state.worldCard?.attributes ?? [],
        })
      }

      // 归档完整对话
      const narratorEntry = {
        id: 'narrator_' + Date.now(),
        role: 'narrator' as const,
        content: fullNarration,
        timestamp: Date.now(),
        model: state.model,
      }
      const newHistory = [...state.dialogueHistory, playerEntry, narratorEntry]
      actions.archiveDialogue(newHistory)

      // 后台自动存档（2s 防抖）— 从 ref 读取最新状态，避免闭包过期
      const latest = latestStateRef.current
      const saveData = {
        id: 'autosave',
        slotName: '自动存档',
        timestamp: Date.now(),
        worldCardId: state.worldCard!.id,
        playerState: latest.playerState!,
        dialogueHistory: newHistory,
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
    state.apiKey, state.provider, state.model, state.customBaseURL,
    state.advancedParams, state.npcAffinities, state.npcRuntime,
    actions,
  ])

  // abort 管理：在 submitAction 内部负责取消上一轮请求，组件卸载时不自动 abort

  // 如果不在游戏中则重定向到首页（从 game/page.tsx 移入，适配 RSC）
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

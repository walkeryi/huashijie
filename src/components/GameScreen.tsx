'use client'

import { useEffect, useRef, useCallback } from 'react'
import { readDataStream } from 'ai'
import { useGame } from '@/lib/game-context'
import { createEventBus } from '@/lib/event-bus'
import DialogueBox from './DialogueBox'
import OptionsPanel from './OptionsPanel'
import StatusPanel from './StatusPanel'

// 模块级 EventBus 单例 — 与 DialogueBox 共享
const eventBus = createEventBus()

export default function GameScreen() {
  const { state, actions } = useGame()
  const hasTriggeredRef = useRef(false)
  const abortRef = useRef<AbortController>()

  // 核心交互 — readDataStream 消费 SSE 流
  const submitAction = useCallback(async (optionText: string) => {
    // 取消上一轮未完成的流
    abortRef.current?.abort()

    const controller = new AbortController()
    abortRef.current = controller

    if (!state.worldCard || !state.playerState) return

    actions.setLoading(true)
    eventBus.reset()

    const playerEntry = {
      id: 'player_' + Date.now(),
      role: 'player' as const,
      content: optionText,
      timestamp: Date.now(),
    }

    try {
      const response = await fetch('/api/adventure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(errText || 'API 请求失败')
      }

      if (!response.body) {
        throw new Error('响应体为空')
      }

      const reader = readDataStream(response.body, { signal: controller.signal })

      let fullNarration = ''
      let toolCallOccurred = false

      for await (const part of reader) {
        if (part.type === 'text-delta') {
          fullNarration += part.textDelta
          eventBus.append(part.textDelta)
        }
        else if (part.type === 'tool-call' && part.toolName === 'update_state') {
          toolCallOccurred = true
          actions.updateState(part.args)
        }
      }

      // 降级兜底: 模型没调用 Tool
      if (!toolCallOccurred) {
        if (!fullNarration) {
          actions.setError('AI 未返回有效响应，请重试')
          return
        }
        console.warn('[降级] AI 未调用 update_state，注入默认选项')
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

    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      const message = e instanceof Error ? e.message : String(e)
      actions.setError(message || '未知错误')
    }
  }, [state, actions])

  // 组件卸载时取消进行中的请求
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

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

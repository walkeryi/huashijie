'use client'

import { useEffect, useRef } from 'react'
import { useGame } from '@/lib/game-context'
import DialogueBox from './DialogueBox'
import OptionsPanel from './OptionsPanel'
import StatusPanel from './StatusPanel'

export default function GameScreen() {
  const { state, actions } = useGame()
  const hasTriggeredRef = useRef(false)

  // 新游戏首次进入时触发 AI 生成开场（仅一次）
  useEffect(() => {
    if (
      !hasTriggeredRef.current &&
      state.screen === 'playing' &&
      state.dialogueHistory.length === 0 &&
      !state.isLoading &&
      state.currentOptions.length === 0
    ) {
      hasTriggeredRef.current = true
      actions.submitAction('开始冒险')
    }
  }, [state.screen, state.dialogueHistory.length, state.isLoading, state.currentOptions.length, actions])

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
        {/* 主对话区 */}
        <div className="flex-1 flex flex-col min-w-0">
          <DialogueBox />
          <OptionsPanel />
        </div>

        {/* 侧边状态栏 */}
        <StatusPanel />
      </div>
    </div>
  )
}

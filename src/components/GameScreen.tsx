'use client'

import { useGame } from '@/lib/game-context'
import DialogueBox from './DialogueBox'
import OptionsPanel from './OptionsPanel'
import StatusPanel from './StatusPanel'

export default function GameScreen() {
  const { state } = useGame()

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

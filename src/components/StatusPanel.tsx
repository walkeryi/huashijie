'use client'

import { useState } from 'react'
import { useGame } from '@/lib/game-context'
import type { AttributeDef } from '@/lib/types'
import NPCPanel from './NPCPanel'
import InventoryPanel from './InventoryPanel'
import FlagPanel from './FlagPanel'

export default function StatusPanel() {
  const { state, actions } = useGame()
  const { playerState, worldCard } = state

  const [showNPC, setShowNPC] = useState(false)
  const [showInv, setShowInv] = useState(false)
  const [showFlag, setShowFlag] = useState(false)

  if (!playerState || !worldCard) return null

  const worldAttributes = worldCard.attributes
  const playerAttrs = playerState.attributes

  return (
    <div className="w-64 border-l border-[var(--border)] p-4 flex flex-col gap-4 bg-[var(--bg-primary)]">
      {/* Player Info */}
      <div>
        <h3 className="text-lg font-bold text-[var(--text-primary)]">
          {playerState.playerName}
        </h3>
        <p className="text-sm text-[var(--text-secondary)]">
          {worldCard.coverEmoji} {worldCard.name}
        </p>
      </div>

      <div className="border-t border-[var(--border)]" />

      {/* Attributes */}
      <div className="space-y-3">
        {worldAttributes.map((attr: AttributeDef) => {
          const currentValue = playerAttrs[attr.key] ?? attr.initial
          const maxValue = attr.max
          const percentage = Math.max(0, Math.min(100, (currentValue / maxValue) * 100))

          return (
            <div key={attr.key}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-1.5">
                  <span>{attr.icon}</span>
                  <span className="text-[var(--text-primary)]">{attr.name}</span>
                </span>
                <span className="text-[var(--text-secondary)] tabular-nums">
                  {currentValue}/{maxValue}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: 'var(--accent)',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex-1" />

      {/* Exit Button */}
      <button
        onClick={() => {
          console.log('[StatusPanel] 退出 → returnToMenu, 当前dialogueHistory长度:', state.dialogueHistory.length)
          actions.returnToMenu()
        }}
        className="w-full py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-sm hover:text-[var(--danger)] hover:border-[var(--danger)] transition-colors cursor-pointer"
      >
        🚪 退出
      </button>

      {/* Popup Buttons */}
      <div className="flex gap-2 border-t border-[var(--border)] pt-3">
        <button onClick={() => setShowNPC(true)} className="flex-1 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-sm" title="NPC 关系">
          👤
        </button>
        <button onClick={() => setShowInv(true)} className="flex-1 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-sm" title="物品栏">
          🎒
        </button>
        <button onClick={() => setShowFlag(true)} className="flex-1 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-sm" title="旗标">
          🏳️
        </button>
      </div>

      {/* Popups */}
      <NPCPanel open={showNPC} onClose={() => setShowNPC(false)} npcs={worldCard?.npcs ?? []} affinities={state.npcAffinities} />
      <InventoryPanel open={showInv} onClose={() => setShowInv(false)} inventory={playerState?.inventory ?? []} />
      <FlagPanel open={showFlag} onClose={() => setShowFlag(false)} flags={playerState?.flags ?? {}} />
    </div>
  )
}

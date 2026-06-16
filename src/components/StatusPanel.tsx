'use client'

import { useState, useRef, useEffect, useOptimistic } from 'react'
import { useGame } from '@/lib/game-context'
import * as saveService from '@/lib/save-service'
import type { AttributeDef } from '@/lib/types'
import NPCPanel from './NPCPanel'
import InventoryPanel from './InventoryPanel'
import FlagPanel from './FlagPanel'

export default function StatusPanel() {
  const { state, actions } = useGame()
  const { playerState, worldCard } = state

  const [showSaveUI, setShowSaveUI] = useState(false)
  const [saveNameInput, setSaveNameInput] = useState('')
  const [activeSaveSlot, setActiveSaveSlot] = useState<number | null>(null)
  const saveInputRef = useRef<HTMLInputElement>(null)
  const [showNPC, setShowNPC] = useState(false)
  const [showInv, setShowInv] = useState(false)
  const [showFlag, setShowFlag] = useState(false)
  const [slotInfos, setSlotInfos] = useState<Record<number, { slotName: string; timestamp: number } | null>>({})
  const [optimisticSlotInfos, addOptimisticSlotInfo] = useOptimistic(
    slotInfos,
    (state, newInfo: { slot: number; slotName: string; timestamp: number }) => ({
      ...state,
      [newInfo.slot]: { slotName: newInfo.slotName, timestamp: newInfo.timestamp },
    })
  )
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Focus save name input when active
  useEffect(() => {
    if (activeSaveSlot !== null && saveInputRef.current) {
      saveInputRef.current.focus()
    }
  }, [activeSaveSlot])

  // Load save slot info when save UI is shown
  useEffect(() => {
    if (showSaveUI) {
      setLoadingSlots(true)
      const loadSlots = async () => {
        const infos: Record<number, { slotName: string; timestamp: number } | null> = {}
        for (const slot of [1, 2, 3]) {
          const save = await saveService.loadSave(slot)
          infos[slot] = save ? { slotName: save.slotName, timestamp: save.timestamp } : null
        }
        setSlotInfos(infos)
        setLoadingSlots(false)
      }
      loadSlots()
    }
  }, [showSaveUI])

  if (!playerState || !worldCard) return null

  const handleSaveClick = async (slot: number) => {
    setActiveSaveSlot(slot)
    const save = await saveService.loadSave(slot)
    setSaveNameInput(save?.slotName || `存档 ${slot}`)
  }

  const handleSaveConfirm = async () => {
    if (activeSaveSlot === null) return
    const name = saveNameInput.trim() || `存档 ${activeSaveSlot}`
    // 乐观更新 — UI 瞬间响应
    addOptimisticSlotInfo({ slot: activeSaveSlot, slotName: name, timestamp: Date.now() })
    await actions.saveGame(activeSaveSlot, name)
    setActiveSaveSlot(null)
    setSaveNameInput('')
    // 刷新槽位信息
    const save = await saveService.loadSave(activeSaveSlot)
    setSlotInfos(prev => ({ ...prev, [activeSaveSlot]: save ? { slotName: save.slotName, timestamp: save.timestamp } : null }))
  }

  const handleSaveKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveConfirm()
    }
  }

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

      <div className="border-t border-[var(--border)]" />

      {/* Save Button */}
      <div>
        <button
          onClick={() => setShowSaveUI(!showSaveUI)}
          className="w-full py-2 rounded-lg border border-[var(--border)] text-[var(--text-primary)] text-sm hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
        >
          {saveService.isOnline() ? '☁️' : '💾'} 存档
        </button>

        {/* Save Slots */}
        {showSaveUI && (
          <div className="mt-3 space-y-2 animate-fadeIn">
            {loadingSlots && <p className="text-xs text-[var(--text-secondary)]">加载中...</p>}
            {[1, 2, 3].map((slot) => {
              const slotInfo = optimisticSlotInfos[slot]
              const isActive = activeSaveSlot === slot

              return (
                <div key={slot}>
                  <button
                    onClick={() => handleSaveClick(slot)}
                    className={`w-full text-left p-2.5 rounded-lg border text-sm transition-colors cursor-pointer ${
                      isActive
                        ? 'border-[var(--accent)] bg-[var(--bg-card)]'
                        : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    {slotInfo ? (
                      <>
                        <div className="font-medium text-[var(--text-primary)]">
                          {slotInfo.slotName}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                          {new Date(slotInfo.timestamp).toLocaleString('zh-CN')}
                        </div>
                      </>
                    ) : (
                      <span className="text-[var(--text-secondary)]">
                        槽位 {slot} — 空
                      </span>
                    )}
                  </button>

                  {/* Save name input when slot is active */}
                  {isActive && (
                    <div className="mt-2 flex gap-1">
                      <input
                        ref={saveInputRef}
                        type="text"
                        value={saveNameInput}
                        onChange={(e) => setSaveNameInput(e.target.value)}
                        onKeyDown={handleSaveKeyDown}
                        placeholder="存档名称"
                        className="flex-1 px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                        maxLength={30}
                      />
                      <button
                        onClick={handleSaveConfirm}
                        className="px-2.5 py-1.5 rounded bg-[var(--accent)] text-[var(--bg-primary)] text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                      >
                        保存
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Exit Button */}
      <button
        onClick={() => actions.returnToMenu()}
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

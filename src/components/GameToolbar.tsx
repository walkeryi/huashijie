'use client'

import { useState, useRef, useEffect, useOptimistic, useTransition } from 'react'
import { useGame } from '@/lib/game-context'
import * as saveService from '@/lib/save-service'
import { presetWorldCards } from '@/data/world-cards'
import { listCustomCards } from '@/lib/custom-cards'
import type { WorldCard } from '@/lib/types'

export default function GameToolbar() {
  const { state, actions } = useGame()
  const { playerState, worldCard } = state

  // ---- 存档 UI ----
  const [showSaveUI, setShowSaveUI] = useState(false)
  const [saveNameInput, setSaveNameInput] = useState('')
  const [activeSaveSlot, setActiveSaveSlot] = useState<number | null>(null)
  const saveInputRef = useRef<HTMLInputElement>(null)
  const [slotInfos, setSlotInfos] = useState<Record<number, { slotName: string; timestamp: number } | null>>({})
  const [optimisticSlotInfos, addOptimisticSlotInfo] = useOptimistic(
    slotInfos,
    (prev, newInfo: { slot: number; slotName: string; timestamp: number }) => ({
      ...prev,
      [newInfo.slot]: { slotName: newInfo.slotName, timestamp: newInfo.timestamp },
    })
  )
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [, startSaveTransition] = useTransition()

  // ---- 加载 UI ----
  const [showLoadUI, setShowLoadUI] = useState(false)

  // 展开时加载槽位信息
  useEffect(() => {
    if (showSaveUI || showLoadUI) {
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
  }, [showSaveUI, showLoadUI])

  // 选中存档槽位时聚焦输入框
  useEffect(() => {
    if (activeSaveSlot !== null && saveInputRef.current) {
      saveInputRef.current.focus()
    }
  }, [activeSaveSlot])

  if (!playerState || !worldCard) return null

  // ---- 存档逻辑 ----
  const handleSaveClick = async (slot: number) => {
    setActiveSaveSlot(slot)
    const save = await saveService.loadSave(slot)
    setSaveNameInput(save?.slotName || `存档 ${slot}`)
  }

  const handleSaveConfirm = () => {
    if (activeSaveSlot === null) return
    const name = saveNameInput.trim() || `存档 ${activeSaveSlot}`
    const slot = activeSaveSlot          // 闭包捕获，避免 setState 后置 null
    startSaveTransition(async () => {
      addOptimisticSlotInfo({ slot, slotName: name, timestamp: Date.now() })
      await actions.saveGame(slot, name)
      setActiveSaveSlot(null)
      setSaveNameInput('')
      const save = await saveService.loadSave(slot)
      setSlotInfos(prev => ({
        ...prev,
        [slot]: save ? { slotName: save.slotName, timestamp: save.timestamp } : null,
      }))
    })
  }

  const handleSaveKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveConfirm()
  }

  // ---- 加载逻辑 ----
  const handleLoadClick = async (slot: number) => {
    const save = await saveService.loadSave(slot)
    if (!save) return
    const allCards: WorldCard[] = [...presetWorldCards, ...listCustomCards()]
    const card = allCards.find(c => c.id === save.worldCardId)
    if (!card) return
    actions.loadGame(save, card)
    setShowLoadUI(false)
  }

  const saveIcon = saveService.isOnline() ? '☁️' : '💾'

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2 flex items-center gap-3 relative">
      {/* 存档按钮 */}
      <button
        onClick={() => { const opening = !showSaveUI; setShowSaveUI(opening); setShowLoadUI(false); if (opening) setLoadingSlots(true) }}
        className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-primary)] text-sm hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
      >
        {saveIcon} 存档
      </button>

      {/* 加载按钮 */}
      <button
        onClick={() => { const opening = !showLoadUI; setShowLoadUI(opening); setShowSaveUI(false); if (opening) setLoadingSlots(true) }}
        className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-primary)] text-sm hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
      >
        📂 加载
      </button>

      {/* 存档下拉面板 */}
      {showSaveUI && (
        <div className="absolute top-full left-4 mt-1 w-64 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-3 space-y-2 shadow-lg z-50 animate-fadeIn">
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
                      <div className="font-medium text-[var(--text-primary)]">{slotInfo.slotName}</div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {new Date(slotInfo.timestamp).toLocaleString('zh-CN')}
                      </div>
                    </>
                  ) : (
                    <span className="text-[var(--text-secondary)]">槽位 {slot} — 空</span>
                  )}
                </button>
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

      {/* 加载下拉面板 */}
      {showLoadUI && (
        <div className="absolute top-full left-[7.5rem] mt-1 w-64 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-3 space-y-2 shadow-lg z-50 animate-fadeIn">
          {loadingSlots && <p className="text-xs text-[var(--text-secondary)]">加载中...</p>}
          {[1, 2, 3].map((slot) => {
            const slotInfo = slotInfos[slot]
            return (
              <button
                key={slot}
                onClick={() => handleLoadClick(slot)}
                disabled={!slotInfo}
                className={`w-full text-left p-2.5 rounded-lg border text-sm transition-colors ${
                  slotInfo
                    ? 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)] cursor-pointer'
                    : 'border-[var(--border)] bg-[var(--bg-secondary)] opacity-50 cursor-not-allowed'
                }`}
              >
                {slotInfo ? (
                  <>
                    <div className="font-medium text-[var(--text-primary)]">{slotInfo.slotName}</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {new Date(slotInfo.timestamp).toLocaleString('zh-CN')}
                    </div>
                  </>
                ) : (
                  <span className="text-[var(--text-secondary)]">槽位 {slot} — 空</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

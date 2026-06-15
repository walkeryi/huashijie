'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGame } from '@/lib/game-context'
import { presetWorldCards } from '@/data/world-cards'
import * as saveService from '@/lib/save-service'
import { listCustomCards, deleteCustomCard } from '@/lib/custom-cards'
import { WorldCard, SaveData } from '@/lib/types'

export default function WorldCardSelector() {
  const router = useRouter()
  const { state, actions } = useGame()
  const { saveSlots } = state

  const [selectedCard, setSelectedCard] = useState<WorldCard | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [showLoadPanel, setShowLoadPanel] = useState(false)
  const [customCards, setCustomCards] = useState<WorldCard[]>([])
  const allCards = [...presetWorldCards, ...customCards]

  const nameInputRef = useRef<HTMLInputElement>(null)

  // Load saves when showLoadPanel becomes true
  useEffect(() => {
    if (showLoadPanel) { actions.refreshSaves() }
  }, [showLoadPanel, actions])

  // Focus name input when card is selected
  useEffect(() => { setCustomCards(listCustomCards()) }, [])
  useEffect(() => {
    if (selectedCard && nameInputRef.current) {
      nameInputRef.current.focus()
    }
  }, [selectedCard])

  const handleCardSelect = (card: WorldCard) => {
    setSelectedCard(card)
    setPlayerName('')
  }

  const handleStart = () => {
    if (!selectedCard) return
    const name = playerName.trim() || '冒险者'
    actions.startGame(selectedCard, name)
    router.push('/game')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleStart()
    }
  }

  const handleLoadSave = (save: SaveData) => {
    const card = allCards.find(c => c.id === save.worldCardId)
    if (!card) return
    actions.loadGame(save, card)
    router.push('/game')
  }

  // Build a map from worldCardId to WorldCard name for display
  const worldCardNameMap: Record<string, string> = {}
  presetWorldCards.forEach(c => {
    worldCardNameMap[c.id] = c.name
  })

  // Load panel
  if (showLoadPanel) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6 text-center">📂 继续冒险</h2>

          {saveSlots.length === 0 ? (
            <p className="text-center text-[var(--text-secondary)] mb-6">
              没有找到存档
            </p>
          ) : (
            <div className="space-y-3 mb-6">
              {saveSlots.map((save) => (
                <div key={save.id} className="flex gap-2">
                  <button
                    onClick={() => handleLoadSave(save)}
                    className="flex-1 text-left p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)] transition-colors cursor-pointer"
                  >
                    <div className="font-medium text-[var(--text-primary)]">
                      {save.slotName}
                    </div>
                    <div className="text-sm text-[var(--text-secondary)] mt-1">
                      {worldCardNameMap[save.worldCardId] || save.worldCardId}
                      {' — '}
                      {save.playerState?.playerName || '未知'}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {new Date(save.timestamp).toLocaleString('zh-CN')}
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!confirm(`删除「${save.slotName}」？`)) return
                      ;(async () => {
                        for (let s = 0; s <= 3; s++) {
                          const loaded = await saveService.loadSave(s)
                          if (loaded && loaded.id === save.id) {
                            await saveService.deleteSave(s)
                            break
                          }
                        }
                        actions.refreshSaves()
                      })()
                    }}
                    className="flex-shrink-0 w-10 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:border-red-800 hover:text-red-400 transition-colors cursor-pointer text-lg"
                    title="删除存档"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowLoadPanel(false)}
            className="w-full py-3 rounded-lg border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
          >
            ← 返回
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-2">🗣️ 话世界</h1>
          <p className="text-lg text-[var(--text-secondary)]">
            选择你的世界，开始一段全新的旅程
          </p>
        </div>

        {/* World Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {allCards.map((card) => {
            const isSelected = selectedCard?.id === card.id
            const isCustom = card.id.startsWith('custom_')
            return (
              <div key={card.id} className="relative">
                <button
                  onClick={() => handleCardSelect(card)}
                  className={`w-full text-left p-6 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--bg-card)] shadow-lg shadow-[var(--accent)]/10'
                      : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]/50 hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  <div className="text-4xl mb-3">{card.coverEmoji}</div>
                  <h3 className="text-xl font-bold mb-1">{card.name}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {card.subtitle}
                  </p>
                </button>
                {isCustom && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`删除「${card.name}」？`)) {
                        deleteCustomCard(card.id)
                        setCustomCards(listCustomCards())
                        if (isSelected) setSelectedCard(null)
                      }
                    }}
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-red-400 hover:border-red-800"
                    title="删除"
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Creator entry */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/creator')}
            className="w-full p-4 rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] bg-[var(--bg-card)]/50 hover:bg-[var(--bg-card)] transition-all text-center cursor-pointer"
          >
            <div className="text-2xl mb-1">✨</div>
            <div className="text-sm text-[var(--text-secondary)]">创建一个新世界</div>
          </button>
        </div>

        {/* Player Name Input - shown when a card is selected */}
        {selectedCard && (
          <div className="animate-fadeIn max-w-md mx-auto space-y-4">
            <input
              ref={nameInputRef}
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的名字（默认：冒险者）"
              className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              maxLength={20}
            />
            <button
              onClick={handleStart}
              className="w-full py-3 rounded-lg bg-[var(--accent)] text-[var(--bg-primary)] font-bold text-lg hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
            >
              开始冒险 ⚔️
            </button>
          </div>
        )}

        {/* Load Save Link */}
        <div className="text-center mt-8">
          <button
            onClick={() => setShowLoadPanel(true)}
            className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors text-sm cursor-pointer"
          >
            📂 继续之前的冒险
          </button>
        </div>
      </div>
    </div>
  )
}

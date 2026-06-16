'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGame } from '@/lib/game-context'
import { presetWorldCards } from '@/data/world-cards'
import { listCustomCards, deleteCustomCard } from '@/lib/custom-cards'
import { WorldCard, SaveData } from '@/lib/types'
import * as saveService from '@/lib/save-service'

type Screen = 'menu' | 'worlds' | 'loads'

export default function HomeIsland() {
  const router = useRouter()
  const { state, actions } = useGame()

  const [mounted, setMounted] = useState(false)
  const [screen, setScreen] = useState<Screen>('menu')
  const [selectedCard, setSelectedCard] = useState<WorldCard | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [customCards, setCustomCards] = useState<WorldCard[]>([])
  const saveSlots = state.saveSlots

  useEffect(() => { setMounted(true) }, [])
  const nameInputRef = useRef<HTMLInputElement>(null)

  const allCards = [...presetWorldCards, ...customCards]
  const worldCardNameMap: Record<string, string> = {}
  allCards.forEach(c => { worldCardNameMap[c.id] = c.name })

  useEffect(() => { setCustomCards(listCustomCards()) }, [screen])

  // 进入读档画面时刷新存档
  useEffect(() => {
    if (screen === 'loads') {
      actions.refreshSaves()
    }
  }, [screen])

  // 选中卡片时聚焦名字输入
  useEffect(() => {
    if (selectedCard && nameInputRef.current) nameInputRef.current.focus()
  }, [selectedCard])

  // ====== 世界选择 ======
  const handleCardSelect = (card: WorldCard) => {
    setSelectedCard(card)
    setPlayerName('')
  }

  const handleStart = () => {
    if (!selectedCard) return
    const name = playerName.trim() || '冒险者'
    console.log('[HomeIsland] handleStart → card:', selectedCard.id, '| name:', name, '| 当前dialogueHistory长度:', state.dialogueHistory.length)
    actions.startGame(selectedCard, name)
    router.push('/game')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart()
  }

  // ====== 读档 ======
  const handleLoadSave = async (save: SaveData) => {
    const card = allCards.find(c => c.id === save.worldCardId)
    if (!card) return

    let fullSave = save
    if (saveService.isOnline() && !save.dialogueHistory?.length) {
      // 在线模式需要加载完整数据
      for (let s = 0; s <= 3; s++) {
        const loaded = await saveService.loadSave(s)
        if (loaded?.id === save.id) { fullSave = loaded; break }
      }
    }
    actions.loadGame(fullSave, card)
    router.push('/game')
  }

  const handleDeleteSave = async (save: SaveData) => {
    if (!confirm(`删除「${save.slotName}」？`)) return
    try {
      for (let s = 0; s <= 3; s++) {
        const loaded = await saveService.loadSave(s)
        if (loaded?.id === save.id) { await saveService.deleteSave(s); break }
      }
      actions.refreshSaves()
    } catch {}
  }

  // ====== 主菜单 ======
  if (screen === 'menu') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">🗣️</div>
          <h1 className="text-5xl font-bold text-[var(--text-primary)] mb-3 tracking-wider">话世界</h1>
          <p className="text-lg text-[var(--text-secondary)]">AI 驱动的文字冒险引擎</p>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={() => setScreen('worlds')}
            className="w-full py-4 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] font-bold text-lg hover:bg-[var(--accent-hover)] transition-colors shadow-lg shadow-[var(--accent)]/20"
          >
            开始冒险 ⚔️
          </button>

          <button
            onClick={async () => {
              await actions.refreshSaves()
              setScreen('loads')
            }}
            className="w-full py-4 rounded-xl border-2 border-[var(--border)] text-[var(--text-primary)] font-medium text-lg hover:border-[var(--accent)] hover:bg-[var(--bg-card)] transition-colors"
          >
            📂 继续游戏
          </button>

        </div>

        {mounted && (
          <p className="mt-12 text-xs text-[var(--text-secondary)]">
            {saveService.isOnline() ? `☁️ 在线 · ${state.accountName}` : '💾 离线模式 · 存档保存在本地'}
          </p>
        )}
      </div>
    )
  }

  // ====== 读档画面 ======
  if (screen === 'loads') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md">
          <button onClick={() => setScreen('menu')}
            className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors mb-6">
            ← 返回
          </button>

          <h2 className="text-2xl font-bold mb-6 text-center text-[var(--text-primary)]">📂 继续游戏</h2>

          {saveSlots.length === 0 ? (
            <p className="text-center text-[var(--text-secondary)] mb-6">没有找到存档</p>
          ) : (
            <div className="space-y-3 mb-6">
              {saveSlots.map((save: SaveData, i: number) => (
                <div key={save.id || `save-${i}`} className="flex gap-2">
                  <button
                    onClick={() => handleLoadSave(save)}
                    className="flex-1 text-left p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)] transition-colors"
                  >
                    <div className="font-medium text-[var(--text-primary)]">{save.slotName}</div>
                    <div className="text-sm text-[var(--text-secondary)] mt-1">
                      {worldCardNameMap[save.worldCardId] || save.worldCardId}
                      {' — '}{save.playerState?.playerName || '未知'}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {new Date(save.timestamp).toLocaleString('zh-CN')}
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeleteSave(save)}
                    className="flex-shrink-0 w-10 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:border-red-800 hover:text-red-400 transition-colors text-lg"
                    title="删除存档"
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ====== 世界选择 ======
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        <button onClick={() => { setScreen('menu'); setSelectedCard(null) }}
          className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors mb-4">
          ← 返回
        </button>

        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-1">选择世界</h2>
          <p className="text-sm text-[var(--text-secondary)]">选择一个世界开始你的冒险</p>
        </div>

        {/* 世界卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {allCards.map((card, i) => {
            const isSelected = selectedCard?.id === card.id
            const isCustom = card.id.startsWith('custom_')
            return (
              <div key={card.id || `card-${i}`} className="relative">
                <button
                  onClick={() => handleCardSelect(card)}
                  className={`w-full text-left p-6 rounded-xl border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--bg-card)] shadow-lg shadow-[var(--accent)]/10'
                      : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]/50 hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  <div className="text-4xl mb-3">{card.coverEmoji}</div>
                  <h3 className="text-xl font-bold mb-1 text-[var(--text-primary)]">{card.name}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{card.subtitle}</p>
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
                  >✕</button>
                )}
              </div>
            )
          })}
        </div>

        {/* 创建新世界入口 */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/creator')}
            className="w-full p-4 rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] bg-[var(--bg-card)]/50 hover:bg-[var(--bg-card)] transition-all text-center"
          >
            <div className="text-2xl mb-1">✨</div>
            <div className="text-sm text-[var(--text-secondary)]">创建一个新世界</div>
          </button>
        </div>

        {/* 名字输入 + 开始按钮 */}
        {selectedCard && (
          <div className="max-w-md mx-auto space-y-4 animate-fadeIn">
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
              className="w-full py-3 rounded-lg bg-[var(--accent)] text-[var(--bg-primary)] font-bold text-lg hover:bg-[var(--accent-hover)] transition-colors"
            >
              开始冒险 ⚔️
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

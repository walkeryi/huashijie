'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGame } from '@/lib/game-context'
import { presetWorldCards } from '@/data/world-cards'
import { listSaves } from '@/lib/storage'
import { WorldCard, SaveData } from '@/lib/types'

export default function WorldCardSelector() {
  const router = useRouter()
  const { state, actions } = useGame()
  const { saveSlots } = state

  const [selectedCard, setSelectedCard] = useState<WorldCard | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [showLoadPanel, setShowLoadPanel] = useState(false)
  const [saves, setSaves] = useState<SaveData[]>([])

  const nameInputRef = useRef<HTMLInputElement>(null)

  // Load saves when component mounts or when showLoadPanel becomes true
  useEffect(() => {
    if (showLoadPanel) {
      const loadedSaves = listSaves()
      setSaves(loadedSaves)
    }
  }, [showLoadPanel])

  // Focus name input when card is selected
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
    const card = presetWorldCards.find(c => c.id === save.worldCardId)
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

          {saves.length === 0 ? (
            <p className="text-center text-[var(--text-secondary)] mb-6">
              没有找到存档
            </p>
          ) : (
            <div className="space-y-3 mb-6">
              {saves.map((save) => (
                <button
                  key={save.id}
                  onClick={() => handleLoadSave(save)}
                  className="w-full text-left p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)] transition-colors cursor-pointer"
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
          <h1 className="text-4xl font-bold mb-2">🌍 陪你一起冒险</h1>
          <p className="text-lg text-[var(--text-secondary)]">
            选择你的世界，开始一段全新的旅程
          </p>
        </div>

        {/* API Key + Provider */}
        <div className="max-w-md mx-auto mb-3 flex gap-2">
          <input
            type="password"
            value={state.apiKey}
            onChange={e => actions.setApiKey(e.target.value)}
            placeholder="输入 API Key"
            className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition-colors"
          />
          <select
            value={state.provider}
            onChange={e => {
              const p = e.target.value as 'anthropic' | 'openai' | 'deepseek' | 'custom'
              actions.setProvider(p)
              // 自动填入默认模型
              const defaults: Record<string, string> = { anthropic: 'claude-sonnet-4-6', openai: 'gpt-4o', deepseek: 'deepseek-chat', custom: '' }
              actions.setModel(defaults[p])
            }}
            className="px-3 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] transition-colors"
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
            <option value="custom">自定义</option>
          </select>
        </div>

        {/* Model name */}
        <div className="max-w-md mx-auto mb-3">
          <input
            type="text"
            value={state.model}
            onChange={e => actions.setModel(e.target.value)}
            placeholder="模型名"
            className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition-colors"
          />
        </div>

        {/* Custom base URL — only for custom provider */}
        {state.provider === 'custom' && (
          <div className="max-w-md mx-auto mb-3">
            <input
              type="text"
              value={state.customBaseURL}
              onChange={e => actions.setCustomBaseURL(e.target.value)}
              placeholder="API 地址，例如 https://api.openai.com/v1"
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition-colors"
            />
          </div>
        )}

        {/* Test connection button */}
        <div className="max-w-md mx-auto mb-8 text-center">
          <TestConnectionButton
            apiKey={state.apiKey}
            provider={state.provider}
            model={state.model}
            customBaseURL={state.customBaseURL}
          />
        </div>

        {/* World Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {presetWorldCards.map((card) => {
            const isSelected = selectedCard?.id === card.id
            return (
              <button
                key={card.id}
                onClick={() => handleCardSelect(card)}
                className={`text-left p-6 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
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
            )
          })}
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

// 测试连接按钮
function TestConnectionButton({
  apiKey, provider, model, customBaseURL,
}: {
  apiKey: string; provider: string; model: string; customBaseURL: string
}) {
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [message, setMessage] = useState('')

  const handleTest = async () => {
    if (!apiKey) { setStatus('fail'); setMessage('请先输入 API Key'); return }
    setStatus('testing')
    setMessage('')
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, provider, model, customBaseURL }),
      })
      const data = await res.json()
      if (data.ok) {
        setStatus('ok')
        setMessage(`连接成功 · ${data.latency}ms`)
      } else {
        setStatus('fail')
        setMessage(data.error || '连接失败')
      }
    } catch {
      setStatus('fail')
      setMessage('网络错误')
    }
  }

  return (
    <div className="flex items-center gap-2 justify-center">
      <button
        onClick={handleTest}
        disabled={status === 'testing'}
        className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50"
      >
        {status === 'testing' ? '⏳ 测试中...' : '🧪 测试连接'}
      </button>
      {message && (
        <span className={`text-sm ${status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </span>
      )}
    </div>
  )
}

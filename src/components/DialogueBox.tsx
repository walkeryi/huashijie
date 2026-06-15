'use client'

import { useRef, useEffect, useState } from 'react'
import { useGame } from '@/lib/game-context'

function getModelInfo(model?: string): { icon: string; label: string } | null {
  if (!model) return null
  const m = model.toLowerCase()
  if (m.includes('deepseek')) return { icon: '/icons/deepseek.svg', label: 'DeepSeek' }
  if (m.includes('claude') || m.includes('anthropic')) return { icon: '/icons/claude.svg', label: 'Claude' }
  if (m.includes('gpt') || m.includes('openai') || m.includes('o1') || m.includes('o3') || m.includes('o4')) return { icon: '/icons/openai.svg', label: 'OpenAI' }
  return { icon: '/icons/custom-model.svg', label: model }
}

export default function DialogueBox() {
  const { state } = useGame()
  const { dialogueHistory, currentNarration, isLoading } = state

  const scrollRef = useRef<HTMLDivElement>(null)
  const lastNarrationRef = useRef('')

  const [displayedText, setDisplayedText] = useState('')
  const [typingIndex, setTypingIndex] = useState(0)

  // Derive typing state instead of managing it separately — avoids the bug
  // where a shorter narration resets isTyping to false permanently.
  const isTyping = currentNarration
    ? displayedText.length < currentNarration.length
    : false

  // Reset typewriter when currentNarration changes to a new value
  useEffect(() => {
    if (currentNarration && currentNarration !== lastNarrationRef.current) {
      lastNarrationRef.current = currentNarration
      setDisplayedText('')
      setTypingIndex(0)
    }
  }, [currentNarration])

  // Typewriter effect: advance one character at ~40ms
  useEffect(() => {
    if (!currentNarration || typingIndex >= currentNarration.length) {
      return
    }

    const timer = setTimeout(() => {
      setDisplayedText(currentNarration.slice(0, typingIndex + 1))
      setTypingIndex((idx) => idx + 1)
    }, 40)

    return () => clearTimeout(timer)
  }, [typingIndex, currentNarration])

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [dialogueHistory, displayedText])

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto pr-2 space-y-4"
      style={{ maxHeight: 'calc(100vh - 280px)' }}
    >
      {/* Dialogue History */}
      {dialogueHistory.map((entry) => {
        const isPlayer = entry.role === 'player'
        return (
          <div
            key={entry.id}
            className={`flex ${isPlayer ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg border ${
                isPlayer
                  ? 'border-[var(--accent)] bg-[var(--bg-card)]'
                  : 'border-[var(--border)] bg-[var(--bg-secondary)]'
              }`}
            >
              {isPlayer && (
                <div className="text-xs text-[var(--accent)] mb-1 font-medium">
                  你
                </div>
              )}
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {entry.content}
              </div>
              {!isPlayer && entry.model && (() => {
                const info = getModelInfo(entry.model)
                if (!info) return null
                return (
                  <div className="flex items-center justify-end mt-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border)]">
                      <img src={info.icon} alt={info.label} className="w-5 h-5" />
                      <span className="text-[11px] text-[var(--text-secondary)] leading-none">{info.label}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )
      })}

      {/* Current narration being typed out */}
      {currentNarration && (
        <div className="flex justify-start">
          <div className="max-w-[80%] p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {displayedText}
              {isTyping && (
                <span className="inline-block w-[2px] h-[1em] bg-[var(--accent)] ml-0.5 animate-pulse">
                  |
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading dots when isLoading and no currentNarration */}
      {isLoading && !currentNarration && (
        <div className="flex justify-start">
          <div className="max-w-[80%] p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { useGame } from '@/lib/game-context'
import { GameOption, GameState } from '@/lib/types'

function evalCondition(val: number, condition: string): boolean {
  const match = condition.trim().match(/^([><=!]+)\s*(-?\d+)$/)
  if (!match) return true
  const [, op, numStr] = match
  const target = parseInt(numStr, 10)
  switch (op) {
    case '>=': return val >= target
    case '>': return val > target
    case '<=': return val <= target
    case '<': return val < target
    case '==': return val === target
    case '!=': return val !== target
    default: return true
  }
}

function checkOption(option: GameOption, state: GameState): boolean {
  const attrs = state.playerState?.attributes ?? {}
  const npcAffs = state.npcAffinities ?? {}
  const flags = state.playerState?.flags ?? {}
  const inventory = state.playerState?.inventory ?? []

  // attributeChecks
  if (option.attributeChecks) {
    for (const [key, condition] of Object.entries(option.attributeChecks)) {
      const val = attrs[key] ?? 0
      if (!evalCondition(val, condition)) return false
    }
  }

  // npcAffinityChecks
  if (option.npcAffinityChecks) {
    for (const [key, condition] of Object.entries(option.npcAffinityChecks)) {
      const val = npcAffs[key] ?? 0
      if (!evalCondition(val, condition)) return false
    }
  }

  // flagChecks — all must be true
  if (option.flagChecks) {
    for (const flag of option.flagChecks) {
      if (!flags[flag]) return false
    }
  }

  // flagNot — none can be true
  if (option.flagNot) {
    for (const flag of option.flagNot) {
      if (flags[flag]) return false
    }
  }

  // itemChecks — all must be in inventory
  if (option.itemChecks) {
    for (const item of option.itemChecks) {
      if (!inventory.includes(item)) return false
    }
  }

  // itemNot — none can be in inventory
  if (option.itemNot) {
    for (const item of option.itemNot) {
      if (inventory.includes(item)) return false
    }
  }

  return true
}

export default function OptionsPanel() {
  const { state, actions } = useGame()
  const { currentOptions, isLoading, playerState } = state

  const [freeInput, setFreeInput] = useState('')
  const [visible, setVisible] = useState(false)
  const freeInputRef = useRef<HTMLInputElement>(null)
  const prevOptionsRef = useRef(currentOptions)

  // Delayed appearance: when new options arrive, wait 800ms then fade in
  useEffect(() => {
    if (currentOptions.length > 0 && currentOptions !== prevOptionsRef.current) {
      prevOptionsRef.current = currentOptions
      setVisible(false)
      const timer = setTimeout(() => {
        setVisible(true)
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [currentOptions])

  // Focus free text input when options appear
  useEffect(() => {
    if (visible && freeInputRef.current) {
      freeInputRef.current.focus()
    }
  }, [visible])

  const handleOptionClick = (option: GameOption) => {
    actions.submitAction(option.text)
    setFreeInput('')
  }

  const handleFreeSubmit = () => {
    const text = freeInput.trim()
    if (!text) return
    actions.submitAction(text)
    setFreeInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFreeSubmit()
    }
  }

  // Hidden while loading
  if (isLoading) {
    return null
  }

  return (
    <div className="space-y-3">
      {/* Options - only show when visible (after delay) */}
      {visible && currentOptions.length > 0 && (
        <div className="animate-fadeIn space-y-2">
          {currentOptions.map((option, index) => {
            const meetsConditions = checkOption(option, state)

            return (
              <button
                key={index}
                onClick={() => meetsConditions && handleOptionClick(option)}
                disabled={!meetsConditions}
                className={`w-full text-left p-3 rounded-lg border text-sm leading-relaxed transition-colors ${
                  meetsConditions
                    ? 'border-[var(--accent)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] cursor-pointer'
                    : 'border-[var(--border)] bg-[var(--bg-card)]/50 text-[var(--text-secondary)] line-through cursor-not-allowed'
                }`}
              >
                {option.text}
              </button>
            )
          })}
        </div>
      )}

      {/* Free text input */}
      <div className="flex gap-2">
        <input
          ref={freeInputRef}
          type="text"
          value={freeInput}
          onChange={(e) => setFreeInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="或者输入你想做的事..."
          className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
          maxLength={200}
        />
        <button
          onClick={handleFreeSubmit}
          disabled={!freeInput.trim()}
          className="px-4 py-2.5 rounded-lg bg-[var(--accent)] text-[var(--bg-primary)] font-medium text-sm hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          行动
        </button>
      </div>
    </div>
  )
}

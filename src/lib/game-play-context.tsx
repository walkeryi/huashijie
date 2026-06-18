'use client'

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { type DialogueEntry } from './types'

// ========== State ==========

export interface GamePlayState {
  dialogueHistory: DialogueEntry[]
  memoryFacts: string[]
  isLoading: boolean
  error: string | null
}

function createInitialGamePlayState(): GamePlayState {
  return {
    dialogueHistory: [],
    memoryFacts: [],
    isLoading: false,
    error: null,
  }
}

// ========== Context ==========

interface GamePlayContextValue {
  state: GamePlayState
  setLoading: (loading: boolean) => void
  setError: (error: string) => void
  archiveDialogue: (history: DialogueEntry[]) => void
  appendToDialogue: (entry: DialogueEntry) => void
  updateMemoryFacts: (facts: string[]) => void
  clearError: () => void
  resetGamePlay: () => void
}

const GamePlayContext = createContext<GamePlayContextValue | null>(null)

export function GamePlayProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GamePlayState>(createInitialGamePlayState)

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading, error: null }))
  }, [])

  const setError = useCallback((error: string) => {
    setState(prev => ({ ...prev, error, isLoading: false }))
  }, [])

  const archiveDialogue = useCallback((history: DialogueEntry[]) => {
    console.log('[GamePlay] archiveDialogue: 对话数', history.length, '| 第一条:', history[0]?.content?.slice(0, 30) ?? '(空)')
    setState(prev => ({ ...prev, dialogueHistory: history, isLoading: false }))
  }, [])

  const appendToDialogue = useCallback((entry: DialogueEntry) => {
    setState(prev => ({ ...prev, dialogueHistory: [...prev.dialogueHistory, entry] }))
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const updateMemoryFacts = useCallback((facts: string[]) => {
    setState(prev => ({ ...prev, memoryFacts: facts }))
  }, [])

  const resetGamePlay = useCallback(() => {
    console.log('[GamePlay] resetGamePlay → 清空对话历史和记忆槽')
    setState(createInitialGamePlayState())
  }, [])

  const value = useMemo(() => ({
    state,
    setLoading,
    setError,
    archiveDialogue,
    appendToDialogue,
    updateMemoryFacts,
    clearError,
    resetGamePlay,
  }), [state, setLoading, setError, archiveDialogue, appendToDialogue, updateMemoryFacts, clearError, resetGamePlay])

  return (
    <GamePlayContext.Provider value={value}>
      {children}
    </GamePlayContext.Provider>
  )
}

export function useGamePlay() {
  const ctx = useContext(GamePlayContext)
  if (!ctx) throw new Error('useGamePlay must be used within GamePlayProvider')
  return ctx
}

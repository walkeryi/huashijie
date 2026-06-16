'use client'

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { type DialogueEntry } from './types'

// ========== State ==========

export interface GamePlayState {
  dialogueHistory: DialogueEntry[]
  isLoading: boolean
  error: string | null
}

function createInitialGamePlayState(): GamePlayState {
  return {
    dialogueHistory: [],
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
  clearError: () => void
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
    setState(prev => ({ ...prev, dialogueHistory: history, isLoading: false }))
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const value = useMemo(() => ({
    state,
    setLoading,
    setError,
    archiveDialogue,
    clearError,
  }), [state, setLoading, setError, archiveDialogue, clearError])

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

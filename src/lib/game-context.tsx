'use client'

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react'
import {
  GameState, GameAction, WorldCard, AIResponse, SaveData, DialogueEntry, PlayerState,
} from './types'
import { listSaves, saveToSlot, autoSave, loadSave, deleteSave } from './storage'

// ========== 初始状态 ==========

function createInitialState(): GameState {
  return {
    screen: 'menu',
    worldCard: null,
    playerState: null,
    dialogueHistory: [],
    currentOptions: [],
    currentNarration: '',
    isLoading: false,
    error: null,
    saveSlots: [],
  }
}

// ========== Reducer ==========

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const attrs: Record<string, number> = {}
      action.worldCard.attributes.forEach(a => {
        attrs[a.key] = a.initial
      })
      return {
        ...state,
        screen: 'playing',
        worldCard: action.worldCard,
        playerState: {
          playerName: action.playerName,
          attributes: attrs,
          flags: {},
        },
        dialogueHistory: [],
        currentOptions: [],
        currentNarration: '',
        isLoading: true,
        error: null,
      }
    }

    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading }

    case 'SET_RESPONSE': {
      const { response, playerEntry } = action
      const newHistory = [
        ...state.dialogueHistory,
        playerEntry,
        {
          id: 'narrator_' + Date.now(),
          role: 'narrator' as const,
          content: response.narration,
          timestamp: Date.now(),
        },
      ]

      const newAttrs = { ...state.playerState!.attributes }
      for (const [key, delta] of Object.entries(response.attributeChanges)) {
        if (key in newAttrs) {
          const maxVal = state.worldCard!.attributes.find(a => a.key === key)?.max ?? 10
          newAttrs[key] = Math.max(0, Math.min(newAttrs[key] + delta, maxVal))
        }
      }

      return {
        ...state,
        playerState: { ...state.playerState!, attributes: newAttrs },
        dialogueHistory: newHistory,
        currentOptions: response.options,
        currentNarration: response.narration,
        isLoading: false,
      }
    }

    case 'SET_ERROR':
      return { ...state, error: action.error, isLoading: false }

    case 'APPEND_NARRATION':
      return { ...state, currentNarration: state.currentNarration + action.text }

    case 'LOAD_SAVE':
      return {
        ...state,
        screen: 'playing',
        worldCard: action.worldCard,
        playerState: action.save.playerState,
        dialogueHistory: action.save.dialogueHistory,
        currentOptions: [],
        currentNarration: '',
        isLoading: false,
        error: null,
      }

    case 'REFRESH_SAVES':
      return { ...state, saveSlots: action.saves }

    case 'RETURN_TO_MENU':
      return createInitialState()

    default:
      return state
  }
}

// ========== Context ==========

interface GameContextValue {
  state: GameState
  dispatch: React.Dispatch<GameAction>
  actions: {
    startGame: (worldCard: WorldCard, playerName: string) => void
    submitAction: (optionText: string) => Promise<void>
    saveGame: (slot: number, name: string) => void
    loadGame: (save: SaveData, worldCard: WorldCard) => void
    deleteGame: (slot: number) => void
    refreshSaves: () => void
    returnToMenu: () => void
  }
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState)
  const stateRef = useRef(state)
  stateRef.current = state

  const refreshSaves = useCallback(() => {
    dispatch({ type: 'REFRESH_SAVES', saves: listSaves() })
  }, [])

  const startGame = useCallback((worldCard: WorldCard, playerName: string) => {
    dispatch({ type: 'START_GAME', worldCard, playerName })
  }, [])

  const submitAction = useCallback(async (optionText: string) => {
    const current = stateRef.current
    if (!current.worldCard || !current.playerState) return

    dispatch({ type: 'SET_LOADING', isLoading: true })

    const playerEntry: DialogueEntry = {
      id: 'player_' + Date.now(),
      role: 'player',
      content: optionText,
      timestamp: Date.now(),
    }

    const historyWithInput = [...current.dialogueHistory, playerEntry]

    try {
      const res = await fetch('/api/adventure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldCard: current.worldCard,
          playerState: current.playerState,
          dialogueHistory: historyWithInput,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || 'API 请求失败')
      }

      const data: AIResponse = await res.json()

      // Apply attribute changes
      const newAttrs = { ...current.playerState.attributes }
      for (const [key, delta] of Object.entries(data.attributeChanges)) {
        if (key in newAttrs) {
          const maxVal = current.worldCard!.attributes.find(a => a.key === key)?.max ?? 10
          newAttrs[key] = Math.max(0, Math.min(newAttrs[key] + delta, maxVal))
        }
      }

      dispatch({
        type: 'SET_RESPONSE',
        response: data,
        playerEntry,
      })

      // Auto-save after response
      const updatedPlayer: PlayerState = {
        ...current.playerState,
        attributes: newAttrs,
      }
      const fullHistory = [...historyWithInput, {
        id: 'narrator_' + Date.now(),
        role: 'narrator' as const,
        content: data.narration,
        timestamp: Date.now(),
      }]
      autoSave(current.worldCard.id, updatedPlayer, fullHistory)
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', error: e.message || '未知错误' })
    }
  }, [])

  const saveGame = useCallback((slot: number, name: string) => {
    const current = stateRef.current
    if (!current.worldCard || !current.playerState) return
    saveToSlot(slot, 'save_' + Date.now(), name, current.worldCard.id, current.playerState, current.dialogueHistory)
    refreshSaves()
  }, [refreshSaves])

  const loadGame = useCallback((save: SaveData, worldCard: WorldCard) => {
    dispatch({ type: 'LOAD_SAVE', save, worldCard })
  }, [])

  const deleteGameAction = useCallback((slot: number) => {
    deleteSave(slot)
    refreshSaves()
  }, [refreshSaves])

  const returnToMenu = useCallback(() => {
    dispatch({ type: 'RETURN_TO_MENU' })
  }, [])

  useEffect(() => {
    refreshSaves()
  }, [refreshSaves])

  const value: GameContextValue = {
    state,
    dispatch,
    actions: {
      startGame,
      submitAction,
      saveGame,
      loadGame,
      deleteGame: deleteGameAction,
      refreshSaves,
      returnToMenu,
    },
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}

'use client'

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  GameState, GameAction, WorldCard, AIResponse, SaveData, DialogueEntry, PlayerState, AttributeDef,
} from './types'
import { listSaves, saveToSlot, autoSave, deleteSave } from './storage'

const DEFAULT_MAX_ATTRIBUTE = 10

// ========== 工具函数 ==========

function clampAttributes(
  base: Record<string, number>,
  changes: Record<string, number>,
  defs: AttributeDef[],
): Record<string, number> {
  const result = { ...base }
  for (const [key, delta] of Object.entries(changes)) {
    if (key in result) {
      const maxVal = defs.find(a => a.key === key)?.max ?? DEFAULT_MAX_ATTRIBUTE
      result[key] = Math.max(0, Math.min(result[key] + delta, maxVal))
    }
  }
  return result
}

// ========== 初始状态 ==========

export function createInitialState(): GameState {
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
    apiKey: '',
  }
}

// ========== Reducer ==========

export function gameReducer(state: GameState, action: GameAction): GameState {
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
        isLoading: false,
        error: null,
      }
    }

    case 'SET_API_KEY':
      return { ...state, apiKey: action.apiKey }

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

      const newAttrs = clampAttributes(
        state.playerState!.attributes,
        response.attributeChanges,
        state.worldCard!.attributes,
      )

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
    setApiKey: (key: string) => void
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
  const submittingRef = useRef(false)

  const refreshSaves = useCallback(() => {
    dispatch({ type: 'REFRESH_SAVES', saves: listSaves() })
  }, [])

  const setApiKey = useCallback((key: string) => {
    dispatch({ type: 'SET_API_KEY', apiKey: key })
  }, [])

  const startGame = useCallback((worldCard: WorldCard, playerName: string) => {
    dispatch({ type: 'START_GAME', worldCard, playerName })
  }, [])

  const submitAction = useCallback(async (optionText: string) => {
    if (submittingRef.current) return
    const current = stateRef.current
    if (!current.worldCard || !current.playerState) return

    submittingRef.current = true
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
          apiKey: current.apiKey,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || 'API 请求失败')
      }

      const data: AIResponse = await res.json()

      const newAttrs = clampAttributes(
        current.playerState.attributes,
        data.attributeChanges,
        current.worldCard!.attributes,
      )

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
      autoSave(current.worldCard.id, updatedPlayer, fullHistory, current.apiKey)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      dispatch({ type: 'SET_ERROR', error: message || '未知错误' })
    } finally {
      submittingRef.current = false
    }
  }, [])

  const saveGame = useCallback((slot: number, name: string) => {
    const current = stateRef.current
    if (!current.worldCard || !current.playerState) return
    saveToSlot(slot, 'save_' + Date.now(), name, current.worldCard.id, current.playerState, current.dialogueHistory, current.apiKey)
    refreshSaves()
  }, [refreshSaves])

  const loadGame = useCallback((save: SaveData, worldCard: WorldCard) => {
    dispatch({ type: 'LOAD_SAVE', save, worldCard })
  }, [])

  const deleteGame = useCallback((slot: number) => {
    deleteSave(slot)
    refreshSaves()
  }, [refreshSaves])

  const returnToMenu = useCallback(() => {
    dispatch({ type: 'RETURN_TO_MENU' })
  }, [])

  useEffect(() => {
    refreshSaves()
  }, [refreshSaves])

  const value: GameContextValue = useMemo(() => ({
    state,
    dispatch,
    actions: {
      setApiKey,
      startGame,
      submitAction,
      saveGame,
      loadGame,
      deleteGame,
      refreshSaves,
      returnToMenu,
    },
  }), [state, dispatch, setApiKey, startGame, submitAction, saveGame, loadGame, deleteGame, refreshSaves, returnToMenu])

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}

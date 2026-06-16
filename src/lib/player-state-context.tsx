'use client'

import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react'
import { type WorldCard, type PlayerState, type SaveData, type GameOption, type AttributeDef, type RuntimeNPCState } from './types'

const DEFAULT_MAX_ATTRIBUTE = 10

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

// ========== State ==========

export interface PlayerStateData {
  screen: 'menu' | 'playing'
  worldCard: WorldCard | null
  playerState: PlayerState | null
  currentOptions: GameOption[]
  npcAffinities: Record<string, number>
  npcRuntime: Record<string, RuntimeNPCState>
}

function createInitialPlayerState(): PlayerStateData {
  return {
    screen: 'menu',
    worldCard: null,
    playerState: null,
    currentOptions: [],
    npcAffinities: {},
    npcRuntime: {},
  }
}

// ========== Actions ==========

type PlayerAction =
  | { type: 'START_GAME'; worldCard: WorldCard; playerName: string }
  | { type: 'UPDATE_STATE';
      attributeChanges?: Record<string, number>
      npcAffinityChanges?: Record<string, number>
      itemsGained?: string[]
      itemsLost?: string[]
      newFlags?: string[]
      lostFlags?: string[]
      options: GameOption[]
      attributeDefs?: AttributeDef[]
    }
  | { type: 'LOAD_SAVE'; save: SaveData; worldCard: WorldCard }
  | { type: 'RETURN_TO_MENU' }

function playerStateReducer(state: PlayerStateData, action: PlayerAction): PlayerStateData {
  switch (action.type) {
    case 'START_GAME': {
      const attrs: Record<string, number> = {}
      action.worldCard.attributes.forEach(a => {
        attrs[a.key] = a.initial
      })
      const npcAffinities: Record<string, number> = {}
      action.worldCard.npcs.forEach(n => { npcAffinities[n.id] = n.fields.initialAffinity ?? 0 })
      const npcRuntime: Record<string, RuntimeNPCState> = {}
      action.worldCard.npcs.forEach(n => {
        npcRuntime[n.id] = { currentSelfPerception: '', currentState: '' }
      })
      return {
        screen: 'playing',
        worldCard: action.worldCard,
        playerState: {
          playerName: action.playerName,
          attributes: attrs,
          flags: {},
          inventory: action.worldCard.startingItems,
        },
        npcAffinities,
        npcRuntime,
        currentOptions: [],
      }
    }

    case 'UPDATE_STATE': {
      const ps = state.playerState
      if (!ps) return state

      const newAttrs = action.attributeChanges
        ? clampAttributes(ps.attributes, action.attributeChanges, action.attributeDefs ?? [])
        : ps.attributes

      const newNpcAffinities = { ...state.npcAffinities }
      if (action.npcAffinityChanges) {
        for (const [key, delta] of Object.entries(action.npcAffinityChanges)) {
          if (key in newNpcAffinities) {
            newNpcAffinities[key] = Math.max(0, Math.min(newNpcAffinities[key] + delta, 100))
          }
        }
      }

      let newInventory = [...(ps.inventory ?? [])]
      if (action.itemsGained) {
        for (const item of action.itemsGained) {
          if (!newInventory.includes(item)) {
            newInventory.push(item)
          }
        }
      }
      if (action.itemsLost) {
        newInventory = newInventory.filter(item => !action.itemsLost!.includes(item))
      }

      const newFlags = { ...ps.flags }
      if (action.newFlags) {
        for (const flag of action.newFlags) {
          newFlags[flag] = true
        }
      }
      if (action.lostFlags) {
        for (const flag of action.lostFlags) {
          newFlags[flag] = false
        }
      }

      return {
        ...state,
        playerState: {
          ...ps,
          attributes: newAttrs,
          inventory: newInventory,
          flags: newFlags,
        },
        npcAffinities: newNpcAffinities,
        currentOptions: action.options,
      }
    }

    case 'LOAD_SAVE': {
      // 始终用世界卡 NPC 初始化（覆盖后新增的 NPC 也能获得初始值）
      const npcAffinities: Record<string, number> = {}
      action.worldCard.npcs.forEach(n => { npcAffinities[n.id] = n.fields.initialAffinity ?? 0 })
      // 存档值覆盖（已存在的 NPC 取存档进度，新增 NPC 保留 initialAffinity）
      if (action.save.npcAffinities) {
        Object.assign(npcAffinities, action.save.npcAffinities)
      }
      const npcRuntime: Record<string, RuntimeNPCState> = {}
      action.worldCard.npcs.forEach(n => {
        npcRuntime[n.id] = { currentSelfPerception: '', currentState: '' }
      })
      if (action.save.npcRuntime) {
        Object.assign(npcRuntime, action.save.npcRuntime)
      }
      return {
        ...state,
        screen: 'playing',
        worldCard: action.worldCard,
        playerState: action.save.playerState,
        currentOptions: [],
        npcAffinities,
        npcRuntime,
      }
    }

    case 'RETURN_TO_MENU':
      return createInitialPlayerState()

    default:
      return state
  }
}

// ========== Context ==========

interface PlayerStateContextValue {
  state: PlayerStateData
  dispatch: React.Dispatch<PlayerAction>
  actions: {
    startGame: (worldCard: WorldCard, playerName: string) => void
    updateState: (changes: {
      attributeChanges?: Record<string, number>
      npcAffinityChanges?: Record<string, number>
      itemsGained?: string[]
      itemsLost?: string[]
      newFlags?: string[]
      lostFlags?: string[]
      options: GameOption[]
      attributeDefs?: AttributeDef[]
    }) => void
    loadGame: (save: SaveData, worldCard: WorldCard) => void
    returnToMenu: () => void
  }
}

const PlayerStateContext = createContext<PlayerStateContextValue | null>(null)

export function PlayerStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(playerStateReducer, undefined, createInitialPlayerState)

  const startGame = useCallback((worldCard: WorldCard, playerName: string) => {
    console.log('[PlayerState] START_GAME:', worldCard.id, '| 玩家:', playerName)
    dispatch({ type: 'START_GAME', worldCard, playerName })
  }, [])

  const updateState = useCallback((changes: {
    attributeChanges?: Record<string, number>
    npcAffinityChanges?: Record<string, number>
    itemsGained?: string[]
    itemsLost?: string[]
    newFlags?: string[]
    lostFlags?: string[]
    options: GameOption[]
    attributeDefs?: AttributeDef[]
  }) => {
    dispatch({ type: 'UPDATE_STATE', ...changes })
  }, [])

  const loadGame = useCallback((save: SaveData, worldCard: WorldCard) => {
    dispatch({ type: 'LOAD_SAVE', save, worldCard })
  }, [])

  const returnToMenu = useCallback(() => {
    console.log('[PlayerState] RETURN_TO_MENU')
    dispatch({ type: 'RETURN_TO_MENU' })
  }, [])

  const value = useMemo(() => ({
    state,
    dispatch,
    actions: { startGame, updateState, loadGame, returnToMenu },
  }), [state, startGame, updateState, loadGame, returnToMenu])

  return (
    <PlayerStateContext.Provider value={value}>
      {children}
    </PlayerStateContext.Provider>
  )
}

export function usePlayerState() {
  const ctx = useContext(PlayerStateContext)
  if (!ctx) throw new Error('usePlayerState must be used within PlayerStateProvider')
  return ctx
}

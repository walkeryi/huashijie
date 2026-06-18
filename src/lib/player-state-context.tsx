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
  | { type: 'APPLY_STATE_CHANGES';
      attributeChanges?: Record<string, number>
      npcAffinityChanges?: Record<string, number>
      itemsGained?: string[]
      itemsLost?: string[]
      newFlags?: string[]
      lostFlags?: string[]
      attributeDefs?: AttributeDef[]
    }
  | { type: 'SET_OPTIONS'; options: GameOption[] }
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

      // 翻译 AI 可能使用的属性中文名 → key
      let translatedAttrChanges = action.attributeChanges
      if (translatedAttrChanges && action.attributeDefs) {
        const nameToKey: Record<string, string> = {}
        for (const def of action.attributeDefs) {
          if (def.name) nameToKey[def.name] = def.key
        }
        const fixed: Record<string, number> = {}
        for (const [k, v] of Object.entries(translatedAttrChanges)) {
          const realKey = nameToKey[k] || k
          fixed[realKey] = (fixed[realKey] || 0) + v
        }
        translatedAttrChanges = fixed
      }

      const newAttrs = translatedAttrChanges
        ? clampAttributes(ps.attributes, translatedAttrChanges, action.attributeDefs ?? [])
        : ps.attributes

      // 翻译 AI 可能使用的 NPC 中文名 → id
      let translatedAffinityChanges = action.npcAffinityChanges
      if (translatedAffinityChanges && state.worldCard) {
        const nameToId: Record<string, string> = {}
        for (const npc of state.worldCard.npcs) {
          if (npc.fields.name) nameToId[npc.fields.name] = npc.id
        }
        const fixed: Record<string, number> = {}
        for (const [k, v] of Object.entries(translatedAffinityChanges)) {
          const realId = nameToId[k] || k
          fixed[realId] = (fixed[realId] || 0) + v
        }
        translatedAffinityChanges = fixed
      }

      const newNpcAffinities = { ...state.npcAffinities }
      if (translatedAffinityChanges) {
        for (const [key, delta] of Object.entries(translatedAffinityChanges)) {
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

    case 'APPLY_STATE_CHANGES': {
      const ps = state.playerState
      if (!ps) return state

      // 翻译 AI 可能使用的属性中文名 → key
      let translatedAttrChanges = action.attributeChanges
      if (translatedAttrChanges && action.attributeDefs) {
        const nameToKey: Record<string, string> = {}
        for (const def of action.attributeDefs) {
          if (def.name) nameToKey[def.name] = def.key
        }
        const fixed: Record<string, number> = {}
        for (const [k, v] of Object.entries(translatedAttrChanges)) {
          const realKey = nameToKey[k] || k
          fixed[realKey] = (fixed[realKey] || 0) + v
        }
        translatedAttrChanges = fixed
      }

      const newAttrs = translatedAttrChanges
        ? clampAttributes(ps.attributes, translatedAttrChanges, action.attributeDefs ?? [])
        : ps.attributes

      // 翻译 AI 可能使用的 NPC 中文名 → id
      let translatedAffinityChanges = action.npcAffinityChanges
      if (translatedAffinityChanges && state.worldCard) {
        const nameToId: Record<string, string> = {}
        for (const npc of state.worldCard.npcs) {
          if (npc.fields.name) nameToId[npc.fields.name] = npc.id
        }
        const fixed: Record<string, number> = {}
        for (const [k, v] of Object.entries(translatedAffinityChanges)) {
          const realId = nameToId[k] || k
          fixed[realId] = (fixed[realId] || 0) + v
        }
        translatedAffinityChanges = fixed
      }

      const newNpcAffinities = { ...state.npcAffinities }
      if (translatedAffinityChanges) {
        for (const [key, delta] of Object.entries(translatedAffinityChanges)) {
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
        // 不修改 currentOptions
      }
    }

    case 'SET_OPTIONS': {
      return {
        ...state,
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
    applyStateChanges: (changes: {
      attributeChanges?: Record<string, number>
      npcAffinityChanges?: Record<string, number>
      itemsGained?: string[]
      itemsLost?: string[]
      newFlags?: string[]
      lostFlags?: string[]
      attributeDefs?: AttributeDef[]
    }) => void
    setOptions: (options: GameOption[]) => void
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

  const applyStateChanges = useCallback((changes: {
    attributeChanges?: Record<string, number>
    npcAffinityChanges?: Record<string, number>
    itemsGained?: string[]
    itemsLost?: string[]
    newFlags?: string[]
    lostFlags?: string[]
    attributeDefs?: AttributeDef[]
  }) => {
    dispatch({ type: 'APPLY_STATE_CHANGES', ...changes })
  }, [])

  const setOptions = useCallback((options: GameOption[]) => {
    dispatch({ type: 'SET_OPTIONS', options })
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
    actions: { startGame, updateState, applyStateChanges, setOptions, loadGame, returnToMenu },
  }), [state, startGame, updateState, applyStateChanges, setOptions, loadGame, returnToMenu])

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

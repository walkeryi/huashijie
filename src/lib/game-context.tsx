'use client'

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  GameState, GameAction, WorldCard, AIResponse, SaveData, DialogueEntry, PlayerState, AttributeDef,
  Protocol, AdvancedParams,
} from './types'
import * as saveService from './save-service'

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

type ApiProvider = 'anthropic' | 'openai' | 'deepseek' | 'custom'

interface SavedApiConfig {
  apiKey: string
  model: string
  customBaseURL: string
  protocol: Protocol
  providerName: string
  apiBaseURL: string
  advancedParams: AdvancedParams
}

const API_CONFIGS_KEY = 'adventure_api_configs'

function loadAllApiConfigs(): Record<string, SavedApiConfig> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(API_CONFIGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      delete parsed['undefined']
      delete parsed['null']
      return parsed
    }
  } catch {}
  try {
    const old = localStorage.getItem('adventure_api_config')
    if (old) {
      const parsed = JSON.parse(old)
      const configs: Record<string, SavedApiConfig> = {}
      const provider = parsed.provider || 'deepseek'
      configs[provider] = { apiKey: parsed.apiKey || '', model: parsed.model || '', customBaseURL: parsed.customBaseURL || '', protocol: provider === 'anthropic' ? 'anthropic' : 'openai', providerName: '', apiBaseURL: '', advancedParams: {} }
      localStorage.setItem(API_CONFIGS_KEY, JSON.stringify(configs))
      localStorage.removeItem('adventure_api_config')
      return configs
    }
  } catch {}
  return {}
}

// 修复历史污染：旧版 bug 会把同一把 apiKey 存到所有 provider 下
function migratePollutedApiConfigs(): void {
  if (typeof window === 'undefined') return
  try {
    const configs = loadAllApiConfigs()
    const providers: ApiProvider[] = ['anthropic', 'openai', 'deepseek', 'custom']
    const nonEmpty: { p: ApiProvider; key: string }[] = []
    for (const p of providers) {
      const k = configs[p]?.apiKey || ''
      if (k.length > 0) nonEmpty.push({ p, key: k })
    }
    // 2个以上非空，且全部相同 → 污染数据
    if (nonEmpty.length >= 2 && nonEmpty.every(e => e.key === nonEmpty[0].key)) {
      console.log('[迁移] 检测到 apiKey 污染，清理中...')
      const last = loadLastProvider()
      for (const p of providers) {
        if (p !== last && configs[p]) {
          configs[p].apiKey = ''
        }
      }
      saveAllApiConfigs(configs)
      console.log('[迁移] 完成，仅保留', last, '的 apiKey')
    }
  } catch {}
}

function saveAllApiConfigs(configs: Record<string, SavedApiConfig>): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(API_CONFIGS_KEY, JSON.stringify(configs))
}

export function loadApiConfigForProvider(provider: ApiProvider): SavedApiConfig {
  const configs = loadAllApiConfigs()
  const defaults: Record<ApiProvider, SavedApiConfig> = {
    anthropic: { apiKey: '', model: 'claude-sonnet-4-6', customBaseURL: '', protocol: 'anthropic', providerName: '', apiBaseURL: '', advancedParams: {} },
    openai: { apiKey: '', model: 'gpt-4o', customBaseURL: '', protocol: 'openai', providerName: '', apiBaseURL: '', advancedParams: {} },
    deepseek: { apiKey: '', model: 'deepseek-chat', customBaseURL: '', protocol: 'openai', providerName: '', apiBaseURL: '', advancedParams: {} },
    custom: { apiKey: '', model: '', customBaseURL: '', protocol: 'openai', providerName: '', apiBaseURL: '', advancedParams: {} },
  }
  return { ...defaults[provider], ...configs[provider] }
}

function loadLastProvider(): ApiProvider {
  if (typeof window === 'undefined') return 'deepseek'
  try {
    const raw = localStorage.getItem('adventure_last_provider')
    if (raw) return raw as ApiProvider
  } catch {}
  return 'deepseek'
}

function saveLastProvider(provider: ApiProvider): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('adventure_last_provider', provider)
}

function loadSaveModeConfig(): { saveMode: GameState['saveMode']; accountName: string } {
  const cfg = saveService.getModeConfig()
  return { saveMode: cfg.mode, accountName: cfg.accountName }
}

export function createInitialState(): GameState {
  migratePollutedApiConfigs() // 修复旧版 bug 导致的 apiKey 污染
  const provider = loadLastProvider()
  const saved = loadApiConfigForProvider(provider)
  const saveCfg = loadSaveModeConfig()
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
    apiKey: saved.apiKey,
    provider: provider as GameState['provider'],
    model: saved.model,
    customBaseURL: saved.customBaseURL,
    protocol: saved.protocol,
    providerName: saved.providerName,
    apiBaseURL: saved.apiBaseURL,
    advancedParams: saved.advancedParams,
    npcAffinities: {},
    npcRuntime: {},
    saveMode: saveCfg.saveMode,
    accountName: saveCfg.accountName,
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
      const npcAffinities: Record<string, number> = {}
      action.worldCard.npcs.forEach(n => { npcAffinities[n.id] = n.fields.initialAffinity ?? 0 })
      const npcRuntime: Record<string, { currentSelfPerception: string; currentState: string }> = {}
      action.worldCard.npcs.forEach(n => {
        npcRuntime[n.id] = { currentSelfPerception: '', currentState: '' }
      })
      return {
        ...state,
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
        dialogueHistory: [],
        currentOptions: [],
        currentNarration: '',
        isLoading: false,
        error: null,
      }
    }

    case 'SET_API_KEY':
      console.log('[Reducer] SET_API_KEY:', action.apiKey.slice(0,20)+'...')
      console.trace('[Reducer] SET_API_KEY 来源')
      return { ...state, apiKey: action.apiKey }

    case 'SET_PROVIDER':
      console.log('[Reducer] SET_PROVIDER:', action.provider, 'apiKey:', (action.apiKey||'').slice(0,20)+'...')
      console.trace('[Reducer] SET_PROVIDER 来源')
      return {
        ...state,
        provider: action.provider,
        ...(action.apiKey !== undefined ? { apiKey: action.apiKey } : {}),
        ...(action.model !== undefined ? { model: action.model } : {}),
        ...(action.customBaseURL !== undefined ? { customBaseURL: action.customBaseURL } : {}),
        ...(action.protocol !== undefined ? { protocol: action.protocol } : {}),
        ...(action.providerName !== undefined ? { providerName: action.providerName } : {}),
        ...(action.apiBaseURL !== undefined ? { apiBaseURL: action.apiBaseURL } : {}),
        ...(action.advancedParams !== undefined ? { advancedParams: action.advancedParams } : {}),
      }

    case 'SET_MODEL':
      return { ...state, model: action.model }

    case 'SET_CUSTOM_BASE_URL':
      return { ...state, customBaseURL: action.baseURL }

    case 'SET_PROTOCOL':
      return { ...state, protocol: action.protocol }

    case 'SET_PROVIDER_NAME':
      return { ...state, providerName: action.name }

    case 'SET_API_BASE_URL':
      return { ...state, apiBaseURL: action.url }

    case 'SET_ADVANCED_PARAMS':
      return { ...state, advancedParams: { ...state.advancedParams, ...action.params } }

    case 'APPLY_PRESET': {
      const defaultAdv: AdvancedParams = action.preset.protocol === 'anthropic'
        ? { max_tokens: 4096, temperature: 0.7, top_p: 1, top_k: 40 }
        : { thinking: 'enabled', reasoning_effort: 'high', stream: false, temperature: 0.7, max_tokens: 4096, top_p: 1 }
      console.log('[Reducer] APPLY_PRESET:', action.preset.id, 'apiKey传入:', (action.apiKey || '(空)').slice(0,20), '原apiKey:', state.apiKey.slice(0,20))
      return {
        ...state,
        provider: action.preset.provider,
        providerName: action.providerName ?? action.preset.name,
        apiKey: action.apiKey ?? '',
        model: action.model ?? action.preset.defaultModel,
        apiBaseURL: action.apiBaseURL ?? action.preset.apiBaseURL,
        customBaseURL: action.customBaseURL ?? '',
        protocol: action.protocol ?? action.preset.protocol,
        advancedParams: action.advancedParams ?? defaultAdv,
      }
    }

    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading, error: null }

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
          model: state.model,
        },
      ]

      const newAttrs = clampAttributes(
        state.playerState!.attributes,
        response.attributeChanges,
        state.worldCard!.attributes,
      )

      // Apply npcAffinityChanges (clamp 0-100)
      const newNpcAffinities = { ...state.npcAffinities }
      for (const [key, delta] of Object.entries(response.npcAffinityChanges)) {
        if (key in newNpcAffinities) {
          newNpcAffinities[key] = Math.max(0, Math.min(newNpcAffinities[key] + delta, 100))
        }
      }

      // Apply inventory changes
      let newInventory = [...(state.playerState!.inventory ?? [])]
      for (const item of response.itemsGained) {
        if (!newInventory.includes(item)) {
          newInventory.push(item)
        }
      }
      newInventory = newInventory.filter(item => !response.itemsLost.includes(item))

      // Apply flag changes
      const newFlags = { ...state.playerState!.flags }
      for (const flag of response.newFlags) {
        newFlags[flag] = true
      }
      for (const flag of response.lostFlags) {
        newFlags[flag] = false
      }

      return {
        ...state,
        playerState: {
          ...state.playerState!,
          attributes: newAttrs,
          inventory: newInventory,
          flags: newFlags,
        },
        npcAffinities: newNpcAffinities,
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

    case 'INIT_NPC_AFFINITIES':
      return { ...state, npcAffinities: action.affinities }

    case 'SET_SAVE_MODE':
      return { ...state, saveMode: action.mode, accountName: action.accountName }

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
    setProvider: (provider: 'anthropic' | 'openai' | 'deepseek' | 'custom') => void
    setModel: (model: string) => void
    setCustomBaseURL: (url: string) => void
    startGame: (worldCard: WorldCard, playerName: string) => void
    submitAction: (optionText: string) => Promise<void>
    saveGame: (slot: number, name: string) => Promise<void>
    loadGame: (save: SaveData, worldCard: WorldCard) => void
    deleteGame: (slot: number) => Promise<void>
    refreshSaves: () => Promise<void>
    returnToMenu: () => void
    setSaveMode: (mode: 'offline' | 'online', accountName: string) => void
  }
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState)
  const stateRef = useRef(state)
  stateRef.current = state
  const submittingRef = useRef(false)

  const refreshSaves = useCallback(async () => {
    try {
      if (saveService.isOnline()) {
        const metas = await saveService.listSaveMetas()
        const saves: SaveData[] = metas.map(m => ({
          id: m.id,
          slotName: m.slotName,
          timestamp: m.timestamp,
          worldCardId: m.worldCardId,
          playerState: { playerName: m.playerName, attributes: {}, flags: {}, inventory: [] },
          dialogueHistory: [],
          apiKey: '',
        }))
        dispatch({ type: 'REFRESH_SAVES', saves })
      } else {
        // 离线模式：直接读取 localStorage 获取完整 SaveData
        const { localListSaves } = await import('./local-storage')
        dispatch({ type: 'REFRESH_SAVES', saves: localListSaves() })
      }
    } catch {
      // 列存档失败，保持现有列表
    }
  }, [])

  const setApiKey = useCallback((key: string) => {
    dispatch({ type: 'SET_API_KEY', apiKey: key })
  }, [])

  const setProvider = useCallback((provider: 'anthropic' | 'openai' | 'deepseek' | 'custom') => {
    const saved = loadApiConfigForProvider(provider)
    dispatch({ type: 'SET_PROVIDER', provider, apiKey: saved.apiKey, model: saved.model, customBaseURL: saved.customBaseURL, protocol: saved.protocol, providerName: saved.providerName, apiBaseURL: saved.apiBaseURL, advancedParams: saved.advancedParams })
  }, [])

  const setModel = useCallback((model: string) => {
    dispatch({ type: 'SET_MODEL', model })
  }, [])

  const setCustomBaseURL = useCallback((baseURL: string) => {
    dispatch({ type: 'SET_CUSTOM_BASE_URL', baseURL })
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
          provider: current.provider,
          model: current.model,
          customBaseURL: current.customBaseURL,
          inventory: current.playerState.inventory,
          npcAffinities: current.npcAffinities,
          advancedParams: current.advancedParams,
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
        model: current.model,
      }]
      const saveData: SaveData = {
        id: 'autosave',
        slotName: '自动存档',
        timestamp: Date.now(),
        worldCardId: current.worldCard.id,
        playerState: updatedPlayer,
        dialogueHistory: fullHistory,
        apiKey: current.apiKey,
      }
      saveService.autoSave(saveData).catch(() => {})
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      dispatch({ type: 'SET_ERROR', error: message || '未知错误' })
    } finally {
      submittingRef.current = false
    }
  }, [])

  const saveGame = useCallback(async (slot: number, name: string) => {
    const current = stateRef.current
    if (!current.worldCard || !current.playerState) return
    const data: SaveData = {
      id: 'save_' + Date.now(),
      slotName: name,
      timestamp: Date.now(),
      worldCardId: current.worldCard.id,
      playerState: current.playerState,
      dialogueHistory: current.dialogueHistory,
      apiKey: current.apiKey,
    }
    try {
      await saveService.saveToSlot(slot, data)
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: '存档失败，请检查网络连接' })
    }
    await refreshSaves()
  }, [refreshSaves])

  const loadGame = useCallback((save: SaveData, worldCard: WorldCard) => {
    dispatch({ type: 'LOAD_SAVE', save, worldCard })
  }, [])

  const deleteGame = useCallback(async (slot: number) => {
    try {
      await saveService.deleteSave(slot)
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: '删除失败，请检查网络连接' })
    }
    await refreshSaves()
  }, [refreshSaves])

  const returnToMenu = useCallback(() => {
    dispatch({ type: 'RETURN_TO_MENU' })
  }, [])

  const setSaveMode = useCallback((mode: 'offline' | 'online', accountName: string) => {
    dispatch({ type: 'SET_SAVE_MODE', mode, accountName })
  }, [])

  useEffect(() => {
    refreshSaves()
  }, [refreshSaves])

  // 挂载时从 localStorage 恢复 API 配置（覆盖 SSR 产生的空值）
  useEffect(() => {
    if (typeof window === 'undefined') return
    const provider = loadLastProvider()
    const saved = loadApiConfigForProvider(provider)
    console.log('[API] 启动加载:', provider, saved.apiKey ? 'key='+saved.apiKey.slice(0,12)+'...' : '无key')
    if (saved.apiKey) {
      dispatch({ type: 'SET_PROVIDER', provider, apiKey: saved.apiKey, model: saved.model, customBaseURL: saved.customBaseURL, protocol: saved.protocol, providerName: saved.providerName, apiBaseURL: saved.apiBaseURL, advancedParams: saved.advancedParams })
    }
  }, [])

  // 用户修改 API 配置时自动保存
  const apiInitRef = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!state.provider || !['anthropic','openai','deepseek','custom'].includes(state.provider)) return
    if (!apiInitRef.current) { apiInitRef.current = true; console.log('[API] 跳过首次渲染'); return }
    console.log('[API] 自动保存:', state.provider, state.apiKey.slice(0,12)+'...')
    const configs = loadAllApiConfigs()
    delete configs['undefined']; delete configs['null']
    configs[state.provider] = { apiKey: state.apiKey, model: state.model, customBaseURL: state.customBaseURL, protocol: state.protocol, providerName: state.providerName, apiBaseURL: state.apiBaseURL, advancedParams: state.advancedParams }
    saveAllApiConfigs(configs)
    saveLastProvider(state.provider)
  }, [state.apiKey, state.provider, state.model, state.customBaseURL, state.protocol, state.providerName, state.apiBaseURL, state.advancedParams])

  const value: GameContextValue = useMemo(() => ({
    state,
    dispatch,
    actions: {
      setApiKey,
      setProvider,
      setModel,
      setCustomBaseURL,
      startGame,
      submitAction,
      saveGame,
      loadGame,
      deleteGame,
      refreshSaves,
      returnToMenu,
      setSaveMode,
    },
  }), [state, dispatch, setApiKey, setProvider, setModel, setCustomBaseURL, startGame, submitAction, saveGame, loadGame, deleteGame, refreshSaves, returnToMenu, setSaveMode])

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}

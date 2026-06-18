'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { type Protocol, type AdvancedParams, type SaveMode } from './types'
import * as saveService from './save-service'

// ========== localStorage 工具函数 ==========

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

/** 修复历史污染：旧版 bug 会把同一把 apiKey 存到所有 provider 下 */
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
    if (nonEmpty.length >= 2 && nonEmpty.every(e => e.key === nonEmpty[0].key)) {
      const last = loadLastProvider()
      for (const p of providers) {
        if (p !== last && configs[p]) {
          configs[p].apiKey = ''
        }
      }
      saveAllApiConfigs(configs)
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

function loadSaveModeConfig(): { saveMode: SaveMode; accountName: string } {
  const cfg = saveService.getModeConfig()
  return { saveMode: cfg.mode, accountName: cfg.accountName }
}

// ========== State ==========

export interface AppConfigState {
  apiKey: string
  provider: 'anthropic' | 'openai' | 'deepseek' | 'custom'
  model: string
  customBaseURL: string
  protocol: Protocol
  providerName: string
  apiBaseURL: string
  advancedParams: AdvancedParams
  saveMode: SaveMode
  accountName: string
}

function createInitialAppConfig(): AppConfigState {
  migratePollutedApiConfigs()
  const provider = loadLastProvider()
  const saved = loadApiConfigForProvider(provider)
  const saveCfg = loadSaveModeConfig()
  return {
    apiKey: saved.apiKey,
    provider,
    model: saved.model,
    customBaseURL: saved.customBaseURL,
    protocol: saved.protocol,
    providerName: saved.providerName,
    apiBaseURL: saved.apiBaseURL,
    advancedParams: saved.advancedParams,
    saveMode: saveCfg.saveMode,
    accountName: saveCfg.accountName,
  }
}

// ========== Context ==========

interface AppConfigContextValue {
  state: AppConfigState
  setApiKey: (key: string) => void
  setProvider: (provider: 'anthropic' | 'openai' | 'deepseek' | 'custom') => void
  setModel: (model: string) => void
  setCustomBaseURL: (url: string) => void
  setProtocol: (protocol: Protocol) => void
  setProviderName: (name: string) => void
  setApiBaseURL: (url: string) => void
  setAdvancedParams: (params: Partial<AdvancedParams>) => void
  setSaveMode: (mode: SaveMode, accountName: string) => void
  /** 批量设置所有 API 配置字段（用于 APPLY_PRESET） */
  setAll: (partial: Partial<AppConfigState>) => void
}

const AppConfigContext = createContext<AppConfigContextValue | null>(null)

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppConfigState>(createInitialAppConfig)

  // 启动时从 localStorage 恢复 API 配置（覆盖 SSR 产生的空值）。
  // SSR 阶段无法访问 localStorage，且 hydration 时 useState initializer 不会重新执行（复用 SSR 的空配置），
  // 故必须在 mount effect 中读取并同步到 state。该场景不适合 useSyncExternalStore——
  // 配置既从 localStorage 读初始值，又由 UI 内部 setState 改变，是混合 store。
  useEffect(() => {
    if (typeof window === 'undefined') return
    const provider = loadLastProvider()
    const saved = loadApiConfigForProvider(provider)
    if (saved.apiKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR→client localStorage 配置恢复的必要副作用
      setState(prev => ({
        ...prev,
        provider,
        apiKey: saved.apiKey,
        model: saved.model,
        customBaseURL: saved.customBaseURL,
        protocol: saved.protocol,
        providerName: saved.providerName,
        apiBaseURL: saved.apiBaseURL,
        advancedParams: saved.advancedParams,
      }))
    }
  }, [])

  // 用户修改 API 配置时自动保存到 localStorage
  const apiInitRef = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!state.provider || !['anthropic', 'openai', 'deepseek', 'custom'].includes(state.provider)) return
    if (!apiInitRef.current) { apiInitRef.current = true; return }
    const configs = loadAllApiConfigs()
    delete configs['undefined']; delete configs['null']
    configs[state.provider] = {
      apiKey: state.apiKey,
      model: state.model,
      customBaseURL: state.customBaseURL,
      protocol: state.protocol,
      providerName: state.providerName,
      apiBaseURL: state.apiBaseURL,
      advancedParams: state.advancedParams,
    }
    saveAllApiConfigs(configs)
    saveLastProvider(state.provider)
  }, [state.apiKey, state.provider, state.model, state.customBaseURL, state.protocol, state.providerName, state.apiBaseURL, state.advancedParams])

  const setApiKey = useCallback((key: string) => {
    setState(prev => ({ ...prev, apiKey: key }))
  }, [])

  const setProvider = useCallback((provider: 'anthropic' | 'openai' | 'deepseek' | 'custom') => {
    const saved = loadApiConfigForProvider(provider)
    setState(prev => ({
      ...prev,
      provider,
      apiKey: saved.apiKey,
      model: saved.model,
      customBaseURL: saved.customBaseURL,
      protocol: saved.protocol,
      providerName: saved.providerName,
      apiBaseURL: saved.apiBaseURL,
      advancedParams: saved.advancedParams,
    }))
  }, [])

  const setModel = useCallback((model: string) => {
    setState(prev => ({ ...prev, model }))
  }, [])

  const setCustomBaseURL = useCallback((baseURL: string) => {
    setState(prev => ({ ...prev, customBaseURL: baseURL }))
  }, [])

  const setProtocol = useCallback((protocol: Protocol) => {
    setState(prev => ({ ...prev, protocol }))
  }, [])

  const setProviderName = useCallback((name: string) => {
    setState(prev => ({ ...prev, providerName: name }))
  }, [])

  const setApiBaseURL = useCallback((url: string) => {
    setState(prev => ({ ...prev, apiBaseURL: url }))
  }, [])

  const setAdvancedParams = useCallback((params: Partial<AdvancedParams>) => {
    setState(prev => ({ ...prev, advancedParams: { ...prev.advancedParams, ...params } }))
  }, [])

  const setSaveMode = useCallback((mode: SaveMode, accountName: string) => {
    setState(prev => ({ ...prev, saveMode: mode, accountName }))
  }, [])

  const setAll = useCallback((partial: Partial<AppConfigState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])

  const value = useMemo(() => ({
    state,
    setApiKey,
    setProvider,
    setModel,
    setCustomBaseURL,
    setProtocol,
    setProviderName,
    setApiBaseURL,
    setAdvancedParams,
    setSaveMode,
    setAll,
  }), [state, setApiKey, setProvider, setModel, setCustomBaseURL, setProtocol, setProviderName, setApiBaseURL, setAdvancedParams, setSaveMode, setAll])

  return (
    <AppConfigContext.Provider value={value}>
      {children}
    </AppConfigContext.Provider>
  )
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext)
  if (!ctx) throw new Error('useAppConfig must be used within AppConfigProvider')
  return ctx
}

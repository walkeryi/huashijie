// src/lib/game-context.tsx — 兼容 re-export
// 三个独立 Context 的统一入口，保持旧 import 路径可用

'use client'

import React, { type ReactNode, useCallback } from 'react'
import { AppConfigProvider, useAppConfig, loadApiConfigForProvider } from './app-config-context'
import { PlayerStateProvider, usePlayerState } from './player-state-context'
import { GamePlayProvider, useGamePlay } from './game-play-context'
import type { AdvancedParams } from './types'

// 向后兼容：合并三个 Context 为旧 GameContextValue 形状
export function useGame() {
  const appConfig = useAppConfig()
  const playerState = usePlayerState()
  const gamePlay = useGamePlay()

  const state = {
    screen: playerState.state.screen,
    worldCard: playerState.state.worldCard,
    playerState: playerState.state.playerState,
    dialogueHistory: gamePlay.state.dialogueHistory,
    currentOptions: playerState.state.currentOptions,
    currentNarration: '',
    isLoading: gamePlay.state.isLoading,
    error: gamePlay.state.error,
    saveSlots: [] as any[],
    apiKey: appConfig.state.apiKey,
    provider: appConfig.state.provider as any,
    model: appConfig.state.model,
    customBaseURL: appConfig.state.customBaseURL,
    protocol: appConfig.state.protocol,
    providerName: appConfig.state.providerName,
    apiBaseURL: appConfig.state.apiBaseURL,
    advancedParams: appConfig.state.advancedParams,
    npcAffinities: playerState.state.npcAffinities,
    npcRuntime: playerState.state.npcRuntime,
    saveMode: appConfig.state.saveMode,
    accountName: appConfig.state.accountName,
  }

  // 向后兼容的 dispatch — 将旧 action 转发到对应的 setter/reducer
  const dispatch = useCallback((action: any) => {
    switch (action.type) {
      // ---- AppConfig actions ----
      case 'SET_API_KEY':
        appConfig.setApiKey(action.apiKey)
        break
      case 'SET_PROVIDER':
        appConfig.setProvider(action.provider)
        break
      case 'SET_MODEL':
        appConfig.setModel(action.model)
        break
      case 'SET_CUSTOM_BASE_URL':
        appConfig.setCustomBaseURL(action.baseURL)
        break
      case 'SET_PROTOCOL':
        appConfig.setProtocol(action.protocol)
        break
      case 'SET_PROVIDER_NAME':
        appConfig.setProviderName(action.name)
        break
      case 'SET_API_BASE_URL':
        appConfig.setApiBaseURL(action.url)
        break
      case 'SET_ADVANCED_PARAMS':
        appConfig.setAdvancedParams(action.params)
        break
      case 'SET_SAVE_MODE':
        appConfig.setSaveMode(action.mode, action.accountName)
        break
      case 'APPLY_PRESET': {
        const preset = action.preset
        const defaultAdv: AdvancedParams = preset.protocol === 'anthropic'
          ? { max_tokens: 4096, temperature: 0.7, top_p: 1, top_k: 40 }
          : { thinking: 'enabled', reasoning_effort: 'high', stream: false, temperature: 0.7, max_tokens: 4096, top_p: 1 }
        console.log('[dispatch] APPLY_PRESET:', preset.id, 'apiKey传入:', (action.apiKey || '(空)').slice(0, 20))
        appConfig.setAll({
          provider: preset.provider,
          providerName: action.providerName ?? preset.name,
          apiKey: action.apiKey ?? '',
          model: action.model ?? preset.defaultModel,
          apiBaseURL: action.apiBaseURL ?? preset.apiBaseURL,
          customBaseURL: action.customBaseURL ?? '',
          protocol: action.protocol ?? preset.protocol,
          advancedParams: action.advancedParams ?? defaultAdv,
        })
        break
      }
      // ---- PlayerState actions ----
      case 'START_GAME':
        playerState.actions.startGame(action.worldCard, action.playerName)
        break
      case 'LOAD_SAVE':
        playerState.actions.loadGame(action.save, action.worldCard)
        break
      case 'RETURN_TO_MENU':
        playerState.actions.returnToMenu()
        break
      // ---- GamePlay actions ----
      case 'SET_LOADING':
        gamePlay.setLoading(action.isLoading)
        break
      case 'SET_ERROR':
        gamePlay.setError(action.error)
        break
      default:
        // 未识别的 action 静默忽略（如 SET_RESPONSE / REFRESH_SAVES / APPEND_NARRATION / INIT_NPC_AFFINITIES）
        break
    }
  }, [appConfig, playerState, gamePlay])

  const actions = {
    // AppConfig setters
    setApiKey: appConfig.setApiKey,
    setProvider: appConfig.setProvider,
    setModel: appConfig.setModel,
    setCustomBaseURL: appConfig.setCustomBaseURL,
    setProtocol: appConfig.setProtocol,
    setProviderName: appConfig.setProviderName,
    setApiBaseURL: appConfig.setApiBaseURL,
    setAdvancedParams: appConfig.setAdvancedParams,
    setSaveMode: appConfig.setSaveMode,
    // PlayerState actions
    startGame: playerState.actions.startGame,
    updateState: playerState.actions.updateState,
    loadGame: playerState.actions.loadGame,
    returnToMenu: playerState.actions.returnToMenu,
    // GamePlay actions
    setLoading: gamePlay.setLoading,
    setError: gamePlay.setError,
    archiveDialogue: gamePlay.archiveDialogue,
    clearError: gamePlay.clearError,
    // Placeholder — GameScreen (Task 8) replaces these
    submitAction: async () => {},
    saveGame: async () => {},
    deleteGame: async () => {},
    refreshSaves: async () => {},
  }

  return { state, dispatch, actions } as any
}

// 统一 Provider — 嵌套三个 Context
export function GameProvider({ children }: { children: ReactNode }) {
  return (
    <AppConfigProvider>
      <PlayerStateProvider>
        <GamePlayProvider>
          {children}
        </GamePlayProvider>
      </PlayerStateProvider>
    </AppConfigProvider>
  )
}

// Re-export 工具函数用于旧 import
export { loadApiConfigForProvider } from './app-config-context'

// Re-export 独立 hooks 用于渐进迁移
export { useAppConfig } from './app-config-context'
export { usePlayerState } from './player-state-context'
export { useGamePlay } from './game-play-context'

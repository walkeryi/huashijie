// src/lib/game-context.tsx — 兼容 re-export
// 三个独立 Context 的统一入口，保持旧 import 路径可用

'use client'

import React, { type ReactNode, useCallback, useState, useMemo } from 'react'
import { AppConfigProvider, useAppConfig, loadApiConfigForProvider } from './app-config-context'
import { PlayerStateProvider, usePlayerState } from './player-state-context'
import { GamePlayProvider, useGamePlay } from './game-play-context'
import type { AdvancedParams, SaveData, SaveMeta } from './types'
import * as saveService from './save-service'

// 向后兼容：合并三个 Context 为旧 GameContextValue 形状
export function useGame() {
  const appConfig = useAppConfig()
  const playerState = usePlayerState()
  const gamePlay = useGamePlay()
  const [saveSlots, setSaveSlots] = useState<SaveMeta[]>([])

  const state = useMemo(() => ({
    screen: playerState.state.screen,
    worldCard: playerState.state.worldCard,
    playerState: playerState.state.playerState,
    dialogueHistory: gamePlay.state.dialogueHistory,
    currentOptions: playerState.state.currentOptions,
    currentNarration: '',
    isLoading: gamePlay.state.isLoading,
    error: gamePlay.state.error,
    saveSlots,
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
  }), [playerState.state, gamePlay.state, appConfig.state, saveSlots])

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
          : { temperature: 0.7, max_tokens: 4096, top_p: 1 }
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
        console.log('[dispatch] START_GAME → worldCard:', action.worldCard?.id, '| playerName:', action.playerName)
        playerState.actions.startGame(action.worldCard, action.playerName)
        gamePlay.resetGamePlay()
        break
      case 'LOAD_SAVE':
        console.log('[dispatch] LOAD_SAVE → worldCard:', action.worldCard?.id)
        playerState.actions.loadGame(action.save, action.worldCard)
        if (action.save.dialogueHistory?.length) {
          gamePlay.archiveDialogue(action.save.dialogueHistory)
        } else {
          gamePlay.resetGamePlay()
        }
        break
      case 'RETURN_TO_MENU':
        console.log('[dispatch] RETURN_TO_MENU')
        playerState.actions.returnToMenu()
        gamePlay.resetGamePlay()
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

  const actions = useMemo(() => ({
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
    // PlayerState actions — 包装以同时重置 GamePlay 对话历史
    startGame: (worldCard: any, playerName: string) => {
      playerState.actions.startGame(worldCard, playerName)
      gamePlay.resetGamePlay()
    },
    updateState: playerState.actions.updateState,
    loadGame: (save: any, worldCard: any) => {
      playerState.actions.loadGame(save, worldCard)
      // 从存档恢复对话历史，不重置
      if (save.dialogueHistory?.length) {
        gamePlay.archiveDialogue(save.dialogueHistory)
      } else {
        gamePlay.resetGamePlay()
      }
    },
    returnToMenu: () => {
      playerState.actions.returnToMenu()
      gamePlay.resetGamePlay()
    },
    // GamePlay actions
    setLoading: gamePlay.setLoading,
    setError: gamePlay.setError,
    archiveDialogue: gamePlay.archiveDialogue,
    clearError: gamePlay.clearError,
    // 存档操作 — 委托给 saveService
    saveGame: async (slot: number, slotName: string) => {
      const data: SaveData = {
        id: `slot_${slot}`,
        slotName,
        timestamp: Date.now(),
        worldCardId: playerState.state.worldCard?.id || '',
        playerState: playerState.state.playerState!,
        dialogueHistory: gamePlay.state.dialogueHistory,
        apiKey: appConfig.state.apiKey,
        npcAffinities: playerState.state.npcAffinities,
        npcRuntime: playerState.state.npcRuntime,
      }
      await saveService.saveToSlot(slot, data)
      setSaveSlots(prev => {
        const next = prev.filter(s => !s.id.startsWith(`slot_${slot}`))
        const meta: SaveMeta = {
          slot,
          id: data.id,
          slotName: data.slotName,
          timestamp: data.timestamp,
          worldCardId: data.worldCardId,
          playerName: data.playerState?.playerName ?? '',
        }
        next.push(meta)
        return next
      })
    },
    deleteGame: async (slot: number) => {
      await saveService.deleteSave(slot)
      setSaveSlots(prev => prev.filter(s => !s.id.startsWith(`slot_${slot}`)))
    },
    refreshSaves: async () => {
      const metas = await saveService.listSaveMetas()
      setSaveSlots(metas)
    },
  }), [appConfig, playerState, gamePlay, saveSlots])

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

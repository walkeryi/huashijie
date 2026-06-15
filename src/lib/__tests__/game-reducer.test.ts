import { describe, it, expect } from 'vitest'
import { gameReducer, createInitialState } from '../game-context'
import { GameState, GameAction, WorldCard, PRESET_NPC_FIELDS } from '../types'

function makeWorldCard(overrides?: Partial<WorldCard>): WorldCard {
  return {
    id: 'test_world',
    name: '测试世界',
    subtitle: '一个测试',
    description: '测试世界观',
    coverEmoji: '🧪',
    initialScene: '测试开场',
    attributes: [
      { key: 'courage', name: '勇气', icon: '⚔️', initial: 3, max: 10 },
      { key: 'wisdom', name: '智慧', icon: '🧠', initial: 5, max: 10 },
    ],
    npcs: [],
    flags: [],
    startingItems: [],
    storyBeats: [],
    ...overrides,
  }
}

describe('gameReducer', () => {
  // ---- START_GAME ----

  it('initializes player attributes from world card', () => {
    const state = createInitialState()
    const card = makeWorldCard()
    const action: GameAction = { type: 'START_GAME', worldCard: card, playerName: '英雄' }

    const next = gameReducer(state, action)

    expect(next.screen).toBe('playing')
    expect(next.worldCard).toBe(card)
    expect(next.playerState!.playerName).toBe('英雄')
    expect(next.playerState!.attributes).toEqual({ courage: 3, wisdom: 5 })
    expect(next.playerState!.flags).toEqual({})
    expect(next.playerState!.inventory).toEqual([])
    expect(next.npcAffinities).toEqual({})
  })

  it('START_GAME 从新 NPCDef.fields 初始化 npcAffinities', () => {
    const card = makeWorldCard({
      npcs: [
        { id: 'ally', isMainCharacter: false, fields: { initialAffinity: 20, name: 'Ally', dialogueTone: '友善', id: 'ally', isMainCharacter: false, gender: '男', origin: '未知', birthday: '', dialogueExamples: '', personalityTags: [], appearance: '', currentAttire: '' } },
        { id: 'rival', isMainCharacter: false, fields: { initialAffinity: -10, name: 'Rival', dialogueTone: '冷淡', id: 'rival', isMainCharacter: false, gender: '女', origin: '未知', birthday: '', dialogueExamples: '', personalityTags: [], appearance: '', currentAttire: '' } },
      ],
    })
    const state = createInitialState()
    const action: GameAction = { type: 'START_GAME', worldCard: card, playerName: 'test' }
    const next = gameReducer(state, action)
    expect(next.npcAffinities).toEqual({ ally: 20, rival: -10 })
    expect(next.npcRuntime).toEqual({ ally: { currentSelfPerception: '', currentState: '' }, rival: { currentSelfPerception: '', currentState: '' } })
  })

  it('resets dialogue and options on new game', () => {
    const state: GameState = {
      ...createInitialState(),
      dialogueHistory: [{ id: 'x', role: 'narrator', content: '旧对话', timestamp: 1 }],
      currentOptions: [{ text: '旧选项' }],
    }
    const action: GameAction = { type: 'START_GAME', worldCard: makeWorldCard(), playerName: 'x' }

    const next = gameReducer(state, action)

    expect(next.dialogueHistory).toHaveLength(0)
    expect(next.currentOptions).toHaveLength(0)
  })

  // ---- SET_LOADING ----

  it('toggles loading state', () => {
    const state = createInitialState()
    expect(state.isLoading).toBe(false)

    const loading = gameReducer(state, { type: 'SET_LOADING', isLoading: true })
    expect(loading.isLoading).toBe(true)

    const done = gameReducer(loading, { type: 'SET_LOADING', isLoading: false })
    expect(done.isLoading).toBe(false)
  })

  // ---- SET_RESPONSE ----

  it('appends player entry and narrator entry to history', () => {
    const state: GameState = {
      ...createInitialState(),
      screen: 'playing',
      worldCard: makeWorldCard(),
      playerState: { playerName: 't', attributes: { courage: 3, wisdom: 5 }, flags: {}, inventory: [] },
    }
    const action: GameAction = {
      type: 'SET_RESPONSE',
      response: {
        narration: '你走进大门。',
        options: [{ text: '继续' }],
        attributeChanges: {},
        npcAffinityChanges: {},
        newFlags: [],
        lostFlags: [],
        itemsGained: [],
        itemsLost: [],
      },
      playerEntry: {
        id: 'p_001',
        role: 'player',
        content: '进门',
        timestamp: 100,
      },
    }

    const next = gameReducer(state, action)

    expect(next.dialogueHistory).toHaveLength(2)
    expect(next.dialogueHistory[0].role).toBe('player')
    expect(next.dialogueHistory[0].content).toBe('进门')
    expect(next.dialogueHistory[1].role).toBe('narrator')
    expect(next.dialogueHistory[1].content).toBe('你走进大门。')
    expect(next.currentOptions).toEqual([{ text: '继续' }])
    expect(next.currentNarration).toBe('你走进大门。')
    expect(next.isLoading).toBe(false)
  })

  it('applies attribute changes from response', () => {
    const state: GameState = {
      ...createInitialState(),
      screen: 'playing',
      worldCard: makeWorldCard(),
      playerState: { playerName: 't', attributes: { courage: 3, wisdom: 5 }, flags: {}, inventory: [] },
    }
    const action: GameAction = {
      type: 'SET_RESPONSE',
      response: {
        narration: '你成功了！',
        options: [],
        attributeChanges: { courage: 2, wisdom: -1 },
        npcAffinityChanges: {},
        newFlags: [],
        lostFlags: [],
        itemsGained: [],
        itemsLost: [],
      },
      playerEntry: { id: 'p', role: 'player', content: '试试', timestamp: 1 },
    }

    const next = gameReducer(state, action)
    expect(next.playerState!.attributes.courage).toBe(5)
    expect(next.playerState!.attributes.wisdom).toBe(4)
  })

  it('clamps attributes between 0 and max', () => {
    const state: GameState = {
      ...createInitialState(),
      screen: 'playing',
      worldCard: makeWorldCard(),
      playerState: { playerName: 't', attributes: { courage: 9, wisdom: 1 }, flags: {}, inventory: [] },
    }
    // courage max=10, try to add 5 → should clamp to 10
    // wisdom min=0, try to subtract 5 → should clamp to 0
    const action: GameAction = {
      type: 'SET_RESPONSE',
      response: {
        narration: '',
        options: [],
        attributeChanges: { courage: 5, wisdom: -5 },
        npcAffinityChanges: {},
        newFlags: [],
        lostFlags: [],
        itemsGained: [],
        itemsLost: [],
      },
      playerEntry: { id: 'p', role: 'player', content: '', timestamp: 1 },
    }

    const next = gameReducer(state, action)
    expect(next.playerState!.attributes.courage).toBe(10)
    expect(next.playerState!.attributes.wisdom).toBe(0)
  })

  // ---- SET_ERROR ----

  it('sets error and clears loading', () => {
    const state: GameState = {
      ...createInitialState(),
      isLoading: true,
    }
    const next = gameReducer(state, { type: 'SET_ERROR', error: '出错了' })
    expect(next.error).toBe('出错了')
    expect(next.isLoading).toBe(false)
  })

  // ---- LOAD_SAVE ----

  it('restores state from save data', () => {
    const state = createInitialState()
    const card = makeWorldCard()
    const save = {
      id: 's',
      slotName: '旧档',
      timestamp: Date.now(),
      worldCardId: 'test_world',
      playerState: {
        playerName: '老玩家',
        attributes: { courage: 7, wisdom: 3 },
        flags: { met_king: true },
        inventory: [],
      },
      dialogueHistory: [
        { id: 'x', role: 'narrator' as const, content: '旧剧情', timestamp: 1 },
      ],
      apiKey: 'test-key',
    }

    const next = gameReducer(state, { type: 'LOAD_SAVE', save, worldCard: card })
    expect(next.screen).toBe('playing')
    expect(next.playerState!.playerName).toBe('老玩家')
    expect(next.playerState!.attributes.courage).toBe(7)
    expect(next.playerState!.flags.met_king).toBe(true)
    expect(next.dialogueHistory).toHaveLength(1)
  })

  // ---- RETURN_TO_MENU ----

  it('resets to initial state', () => {
    const state: GameState = {
      ...createInitialState(),
      screen: 'playing',
      worldCard: makeWorldCard(),
      playerState: { playerName: 'x', attributes: {}, flags: {}, inventory: [] },
    }

    const next = gameReducer(state, { type: 'RETURN_TO_MENU' })
    expect(next.screen).toBe('menu')
    expect(next.worldCard).toBeNull()
    expect(next.playerState).toBeNull()
    expect(next.dialogueHistory).toHaveLength(0)
  })

  // ---- REFRESH_SAVES ----

  it('updates save slots', () => {
    const state = createInitialState()
    const saves = [
      { id: 'a', slotName: '档1', timestamp: 1, worldCardId: 'w', playerState: { playerName: '', attributes: {}, flags: {}, inventory: [] }, dialogueHistory: [], apiKey: '' },
    ]

    const next = gameReducer(state, { type: 'REFRESH_SAVES', saves })
    expect(next.saveSlots).toEqual(saves)
  })
})

// ========== NPC 角色档案类型 ==========

describe('PRESET_NPC_FIELDS', () => {
  it('12 个静态预设字段符合 schema', () => {
    const fields = PRESET_NPC_FIELDS
    expect(fields).toHaveLength(12)
    fields.forEach(f => {
      expect(f).toHaveProperty('key')
      expect(f).toHaveProperty('label')
      expect(f).toHaveProperty('desc')
      expect(f).toHaveProperty('type')
      expect(f).toHaveProperty('fixed')
      expect(f).toHaveProperty('runtimeRequired')
      expect(f).toHaveProperty('nullable')
      expect(['string', 'string[]', 'boolean', 'number']).toContain(f.type)
    })
  })

  it('静态预设字段不含运行时字段 currentSelfPerception / currentState', () => {
    const keys = PRESET_NPC_FIELDS.map(f => f.key)
    expect(keys).not.toContain('currentSelfPerception')
    expect(keys).not.toContain('currentState')
  })
})

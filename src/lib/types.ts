// ========== 世界卡 ==========

export interface AttributeDef {
  key: string        // 例如 "courage"
  name: string       // 例如 "勇气"
  icon: string       // emoji 例如 "⚔️"
  initial: number    // 初始值
  max: number        // 最大值
}

export interface WorldCard {
  id: string
  name: string           // 世界名称
  subtitle: string       // 副标题/简介
  description: string    // 世界设定（注入 AI prompt）
  coverEmoji: string     // 封面 emoji
  initialScene: string   // 初始场景描述
  attributes: AttributeDef[]
  npcs: NPCDef[]
  flags: string[]
  startingItems: string[]
}

export interface NPCDef {
  id: string              // "blacksmith"
  name: string            // "铁匠老王"
  description: string     // 背景描述
  initialAffinity: number // 初始好感 (0-100)
}

// ========== 游戏状态 ==========

export interface DialogueEntry {
  id: string
  role: 'narrator' | 'player'
  content: string
  timestamp: number
}

export interface GameOption {
  text: string
  attributeChecks?: Record<string, string>  // 例如 {courage: ">= 3"}
  npcAffinityChecks?: Record<string, string> // {blacksmith: ">= 40"}
  flagChecks?: string[]                      // ["found_allies"]
  flagNot?: string[]                         // ["betrayed_king"]
  itemChecks?: string[]                      // ["rusty_key"]
  itemNot?: string[]                         // ["poison_vial"]
}

export interface AIResponse {
  narration: string
  options: GameOption[]
  attributeChanges: Record<string, number>   // 例如 {courage: 2, health: -1}
  npcAffinityChanges: Record<string, number>
  newFlags: string[]
  lostFlags: string[]
  itemsGained: string[]
  itemsLost: string[]
}

export interface PlayerState {
  playerName: string
  attributes: Record<string, number>  // 例如 {courage: 5, health: 8}
  flags: Record<string, boolean>      // 例如 {met_king: true}
  inventory: string[]
}

// ========== 存档 ==========

export interface SaveData {
  id: string
  slotName: string
  timestamp: number
  worldCardId: string
  playerState: PlayerState
  dialogueHistory: DialogueEntry[]
  apiKey: string
}

// ========== 游戏上下文 ==========

export type GameScreen = 'menu' | 'playing'

export interface GameState {
  screen: GameScreen
  worldCard: WorldCard | null
  playerState: PlayerState | null
  dialogueHistory: DialogueEntry[]
  currentOptions: GameOption[]
  currentNarration: string
  isLoading: boolean
  error: string | null
  saveSlots: SaveData[]
  apiKey: string
  provider: 'anthropic' | 'openai' | 'deepseek' | 'custom'
  model: string
  customBaseURL: string
  npcAffinities: Record<string, number>
}

export type GameAction =
  | { type: 'START_GAME'; worldCard: WorldCard; playerName: string }
  | { type: 'SET_API_KEY'; apiKey: string }
  | { type: 'SET_PROVIDER'; provider: 'anthropic' | 'openai' | 'deepseek' | 'custom' }
  | { type: 'SET_MODEL'; model: string }
  | { type: 'SET_CUSTOM_BASE_URL'; baseURL: string }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_RESPONSE'; response: AIResponse; playerEntry: DialogueEntry }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'APPEND_NARRATION'; text: string }
  | { type: 'LOAD_SAVE'; save: SaveData; worldCard: WorldCard }
  | { type: 'REFRESH_SAVES'; saves: SaveData[] }
  | { type: 'RETURN_TO_MENU' }
  | { type: 'INIT_NPC_AFFINITIES'; affinities: Record<string, number> }

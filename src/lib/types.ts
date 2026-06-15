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
  storyBeats: StoryBeat[]
}

export interface StoryBeat {
  id: string
  name: string
  description: string
  preconditions?: {
    attributeChecks?: Record<string, string>
    npcAffinityChecks?: Record<string, string>
    flagChecks?: string[]
    itemChecks?: string[]
  }
  effects: {
    newFlags?: string[]
    itemsGained?: string[]
    npcAffinityChanges?: Record<string, number>
  }
  unlocks: string[]
}

// ========== NPC 角色档案 ==========

export interface NPCFieldMeta {
  key: string
  label: string
  desc: string
  type: 'string' | 'string[]' | 'boolean' | 'number'
  fixed: boolean
  runtimeRequired: boolean
  nullable: boolean
}

export interface CustomFieldMeta {
  type: 'string' | 'string[]' | 'boolean' | 'number'
  key: string
  label: string
  desc: string
}

export interface NPCDef {
  id: string
  isMainCharacter: boolean
  fields: Record<string, any>
}

// 运行时动态状态 — 从静态定义中剥离，防止存档污染
export interface RuntimeNPCState {
  currentSelfPerception: string
  currentState: string
}

// 12 个静态预设字段（不含 runtime 字段）
export const PRESET_NPC_FIELDS: NPCFieldMeta[] = [
  { key: 'id', label: '标识符', desc: '唯一标识，同一角色在不同事件中保持一致', type: 'string', fixed: true, runtimeRequired: true, nullable: false },
  { key: 'name', label: '角色名', desc: '角色的显示名称', type: 'string', fixed: true, runtimeRequired: true, nullable: false },
  { key: 'isMainCharacter', label: '是主角', desc: '布尔标志；整张卡至多1个。系统字段，不在卡面展示。', type: 'boolean', fixed: true, runtimeRequired: true, nullable: false },
  { key: 'gender', label: '性别', desc: '如：女/男/未知', type: 'string', fixed: true, runtimeRequired: true, nullable: true },
  { key: 'origin', label: '来历', desc: '一句话说明出身或来源', type: 'string', fixed: true, runtimeRequired: true, nullable: true },
  { key: 'birthday', label: '生日', desc: '纯时间值，格式必须符合当前世界历法', type: 'string', fixed: true, runtimeRequired: false, nullable: true },
  { key: 'dialogueTone', label: '对话基调', desc: '稳定说话风格+性格底色', type: 'string', fixed: true, runtimeRequired: true, nullable: false },
  { key: 'dialogueExamples', label: '说话示例', desc: 'few-shot示例对话；in_person≥6/sms≥4；in_person含*动作*+对白，sms禁*动作*', type: 'string', fixed: true, runtimeRequired: false, nullable: true },
  { key: 'personalityTags', label: '性格标签', desc: '如：强势/沉稳/温和', type: 'string[]', fixed: true, runtimeRequired: false, nullable: true },
  { key: 'appearance', label: '外貌特征', desc: '如：黑长直/金发碧眼', type: 'string', fixed: true, runtimeRequired: false, nullable: true },
  { key: 'currentAttire', label: '当前衣着', desc: '当前具体衣着', type: 'string', fixed: true, runtimeRequired: false, nullable: true },
  { key: 'initialAffinity', label: '初始好感度', desc: '角色初始好感值，范围-100~100，默认0', type: 'number', fixed: true, runtimeRequired: false, nullable: true },
]

// ========== API 高级设置 ==========

export type Protocol = 'openai' | 'anthropic'

export interface AdvancedParams {
  thinking?: 'enabled' | 'disabled'
  reasoning_effort?: 'low' | 'medium' | 'high'
  stream?: boolean
  temperature?: number
  max_tokens?: number
  top_p?: number
  top_k?: number
}

export interface PresetProvider {
  id: string
  name: string
  provider: 'anthropic' | 'openai' | 'deepseek' | 'custom'
  apiBaseURL: string
  defaultModel: string
  protocol: Protocol
  icon: string
}

// ========== 游戏状态 ==========

export interface DialogueEntry {
  id: string
  role: 'narrator' | 'player'
  content: string
  timestamp: number
  model?: string
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
  protocol: Protocol
  providerName: string
  apiBaseURL: string
  advancedParams: AdvancedParams
  npcAffinities: Record<string, number>
  npcRuntime: Record<string, RuntimeNPCState>
  saveMode: SaveMode
  accountName: string
}

// ========== 存档模式 ==========

export type SaveMode = 'offline' | 'online'

/** 存储模式配置，持久化在 localStorage key: 'adventure_save_config' */
export interface SaveModeConfig {
  mode: SaveMode
  accountName: string
}

/** 存档元数据（列表用，不含对话历史和 apiKey） */
export interface SaveMeta {
  slot: number
  id: string
  slotName: string
  timestamp: number
  worldCardId: string
  playerName: string
}

export type GameAction =
  | { type: 'START_GAME'; worldCard: WorldCard; playerName: string }
  | { type: 'SET_API_KEY'; apiKey: string }
  | { type: 'SET_PROVIDER'; provider: 'anthropic' | 'openai' | 'deepseek' | 'custom'; apiKey?: string; model?: string; customBaseURL?: string; protocol?: Protocol; providerName?: string; apiBaseURL?: string; advancedParams?: AdvancedParams }
  | { type: 'SET_MODEL'; model: string }
  | { type: 'SET_CUSTOM_BASE_URL'; baseURL: string }
  | { type: 'SET_PROTOCOL'; protocol: Protocol }
  | { type: 'SET_PROVIDER_NAME'; name: string }
  | { type: 'SET_API_BASE_URL'; url: string }
  | { type: 'SET_ADVANCED_PARAMS'; params: Partial<AdvancedParams> }
  | { type: 'APPLY_PRESET'; preset: PresetProvider }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_RESPONSE'; response: AIResponse; playerEntry: DialogueEntry }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'APPEND_NARRATION'; text: string }
  | { type: 'LOAD_SAVE'; save: SaveData; worldCard: WorldCard }
  | { type: 'REFRESH_SAVES'; saves: SaveData[] }
  | { type: 'RETURN_TO_MENU' }
  | { type: 'INIT_NPC_AFFINITIES'; affinities: Record<string, number> }
  | { type: 'SET_SAVE_MODE'; mode: SaveMode; accountName: string }

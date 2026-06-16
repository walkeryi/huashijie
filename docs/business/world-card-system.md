---
name: world-card-system
description: 世界卡完整业务：WorldCard 类型定义（15个字段+AttributeDef+NPCDef+StoryBeat）、2张预设世界卡（蒸汽苍穹/玉京风华）、自定义卡 localStorage CRUD、NPC 字段体系（12个核心字段+自定义字段+isCoreField检查）、StoryBeat 节拍链（preconditions+effects+unlocks）、WorldCreator 创作台（6标签页：世界观/属性/角色/物品&旗标/节拍链/预览）、HomeIsland 世界选择与游戏启动（START_GAME 初始化）
---

# 世界卡系统

## 边界

本文件覆盖世界卡的定义、创建、编辑、选择和游戏启动全流程。
不覆盖：好感度算法细节（见 npc-affinity-system.md）、选项条件评估（见 game-options-conditions.md）、AI prompt 构建细节（见 ai-engine.md）。

---

## 1. WorldCard 类型体系

### 1.1 WorldCard 接口（15 个字段）

定义于 `src/lib/types.ts`：

```ts
interface WorldCard {
  id: string               // 唯一标识。预设卡固定字符串，自定义卡 'custom_' + Date.now()
  name: string             // 世界名称
  subtitle: string         // 副标题/简介
  description: string      // 世界设定描述（Markdown 格式，注入 AI system prompt）
  coverEmoji: string       // 封面 emoji
  initialScene: string     // 初始场景描述（玩家进入游戏看到的第一段文字）
  attributes: AttributeDef[] // 能力属性定义
  npcs: NPCDef[]           // 角色定义（含玩家主角 + NPC）
  flags: string[]          // 世界级旗标（剧情进度标记）
  startingItems: string[]  // 开局物品
  storyBeats: StoryBeat[]  // 故事节拍链
}
```

核心设计原则：`description` 字段用 Markdown 格式书写，直接注入 AI system prompt；`attributes` 和 `npcs` 定义世界的能力体系和角色生态；`storyBeats` 定义剧情骨架，AI 在骨架内自由发挥。

### 1.2 AttributeDef

```ts
interface AttributeDef {
  key: string     // 程序标识，例如 "courage"
  name: string    // 显示名称，例如 "勇气"
  icon: string    // Emoji，例如 "⚔️"
  initial: number // 初始值
  max: number     // 最大值（默认 DEFAULT_MAX_ATTRIBUTE = 10）
}
```

属性值的修改由 `clampAttributes` 工具函数守卫：`Math.max(0, Math.min(result[key] + delta, maxVal))`，确保值在 0~max 区间内。

### 1.3 StoryBeat

```ts
interface StoryBeat {
  id: string
  name: string
  description: string
  preconditions?: {
    attributeChecks?: Record<string, string>   // e.g. { courage: ">= 5" }
    npcAffinityChecks?: Record<string, string> // e.g. { guard_captain: ">= 40" }
    flagChecks?: string[]
    itemChecks?: string[]
  }
  effects: {
    newFlags?: string[]
    itemsGained?: string[]
    npcAffinityChanges?: Record<string, number>
  }
  unlocks: string[]  // 解锁的后续节拍 ID 列表
}
```

preconditions 共四种类型：属性门槛、NPC 好感度门槛、旗标检查、物品检查。effects 触发旗标设置、物品获得、好感度变化。`unlocks` 指向后续节拍的 `id`，形成有向剧情图。

**惯例**：第一个节拍（id: intro）无 precondition、无 effects，作为开场锚点。最后一个节拍 unlocks 为空数组，作为剧情收束。

### 1.4 GameOption（选项条件体系）

定义于 `src/lib/types.ts` 的 `GameOption` 是 AI 每次回复时为玩家生成的选择项，与 StoryBeat 共用六种条件评估体系：

```ts
interface GameOption {
  text: string
  attributeChecks?: Record<string, string>
  npcAffinityChecks?: Record<string, string>
  flagChecks?: string[]
  flagNot?: string[]
  itemChecks?: string[]
  itemNot?: string[]
}
```

与 StoryBeat.preconditions 的区别：StoryBeat 条件是"进入这个剧情节点"的门槛；GameOption 条件是"这个选项是否可见/可选"的门槛。GameOption 多了 `flagNot` 和 `itemNot` 两种反向条件。

---

## 2. NPC 字段体系

### 2.1 PRESET_NPC_FIELDS（12 个核心字段）

定义于 `src/lib/types.ts`，每个字段包含 `{ key, label, desc, type, fixed, runtimeRequired, nullable }`：

| key | label | type | runtimeRequired | nullable | 说明 |
|-----|-------|------|-----------------|----------|------|
| id | 标识符 | string | true | false | 唯一标识，同一角色在不同事件中保持一致 |
| name | 角色名 | string | true | false | 角色的显示名称 |
| isMainCharacter | 是主角 | boolean | true | false | 整张卡至多 1 个主角，系统字段，不在卡面展示 |
| gender | 性别 | string | true | true | 如：女/男/未知 |
| origin | 来历 | string | true | true | 一句话说明出身或来源 |
| birthday | 生日 | string | false | true | 纯时间值，格式必须符合当前世界历法 |
| dialogueTone | 对话基调 | string | true | false | 稳定说话风格+性格底色 |
| dialogueExamples | 说话示例 | string | false | true | few-shot 示例对话 |
| personalityTags | 性格标签 | string[] | false | true | 如：强势/沉稳/温和 |
| appearance | 外貌特征 | string | false | true | 如：黑长直/金发碧眼 |
| currentAttire | 当前衣着 | string | false | true | 当前具体衣着 |
| initialAffinity | 初始好感度 | number | false | true | 范围 -100~100，默认 0 |

### 2.2 isCoreField（不可删除字段）

WorldCreator 中定义的 `CORE_FIELD_KEYS` 包含 6 个核心字段：

```
['id', 'name', 'gender', 'origin', 'dialogueTone', 'initialAffinity']
```

核心字段在编辑器中显示 🔒 锁定标志，不允许删除。非核心预设字段可以被标记为删除（设置 `_rm_{key}: true`），自定义字段可以被彻底删除。

### 2.3 自定义字段

通过编辑器"双空添加槽"机制添加。自定义字段与预设字段分开存储：

- 字段值直接存储在 `NPCDef.fields` 中
- 字段元数据（desc 等）存储在 `NPCDef.fields._customMeta` 中
- 通过 `Object.keys(fields)` 过滤掉 `_customMeta` 和 `_rm_*` 前缀后，再排除 `PRESET_NPC_FIELDS` 已有的 key，得到自定义字段列表

### 2.4 RuntimeNPCState（运行时动态状态）

```ts
interface RuntimeNPCState {
  currentSelfPerception: string  // 当前自我认知
  currentState: string           // 当前状态
}
```

运行时状态在 `START_GAME` 时初始化为空字符串，AI 可以在游戏过程中更新。与静态 `NPCDef` 分离，防止存档污染定义数据。

---

## 3. 预设世界卡

定义于 `src/data/world-cards.ts`，`presetWorldCards: WorldCard[]` 数组包含 2 张预设卡：

### 3.1 蒸汽苍穹（steampunk_skyfall）

| 字段 | 内容 |
|------|------|
| id | `steampunk_skyfall` |
| name | 蒸汽苍穹 |
| subtitle | 天空之城正在坠落，你是唯一能拯救它的人 |
| coverEmoji | ⚙️ |
| 属性 | 勇气(3/10), 智力(5/10), 魅力(3/10), 机械(4/10) |
| NPC | 主角(玩家), 老机械师陈(好感20), 卫队长赵(好感0), 天空贵族洛(好感10) |
| 旗标 | 4 个：found_crystal_clue, allied_with_mechanics, confronted_nobles, discovered_truth |
| 开局物品 | 机械扳手, 残破的飞艇日志 |
| 节拍链 | 5 个：intro → find_clue → {confront_noble, investigate_mines} → discover_truth |

节拍链形成分支结构：
- intro 解锁 find_clue
- find_clue 解锁 confront_noble 和 investigate_mines（两条分支路线）
- confront_noble 需要勇气 >= 5，解锁 discover_truth
- investigate_mines 需要机械 >= 4 且持有机械扳手，解锁 discover_truth
- discover_truth 需要老机械师陈好感 >= 40，为终局节点

### 3.2 玉京风华（jade_dynasty）

| 字段 | 内容 |
|------|------|
| id | `jade_dynasty` |
| name | 玉京风华 |
| subtitle | 在神灵隐退的王朝末年，寻找最后一只灵兽 |
| coverEmoji | 🏮 |
| 属性 | 胆识(2/10), 慧根(5/10), 风雅(4/10), 灵力(3/10) |
| NPC | 主角(玩家), 茶馆说书人柳(好感30), 灵兽守护者青(好感5), 朝廷密使白(好感-10) |
| 旗标 | 4 个：found_ancient_scroll, awakened_spirit_sense, exposed_corruption, reunited_last_beast |
| 开局物品 | 泛黄的古卷, 铜钱 x5 |
| 节拍链 | 5 个：intro → find_scroll → {awaken_sense, ally_tea_master} → expose_truth |

节拍链同样形成分支：
- intro 解锁 find_scroll
- find_scroll 解锁 awaken_sense 和 ally_tea_master
- awaken_sense 需要灵兽守护者青好感 >= 20
- ally_tea_master 需要风雅 >= 5
- expose_truth 需要朝廷密使白好感 >= 30，为终局节点

### 3.3 预设卡识别

预设卡 ID 不以 `custom_` 开头。自定义卡 ID 以 `custom_` 为前缀。代码中通过 `card.id.startsWith('custom_')` 判断。

---

## 4. 自定义世界卡 CRUD

定义于 `src/lib/custom-cards.ts`，全部基于 `localStorage`。

### 4.1 createEmptyCard

```ts
function createEmptyCard(): WorldCard
```

生成一个完全空白的卡片骨架：
- `id`: `'custom_' + Date.now()`（确保唯一性）
- `name`, `subtitle`, `description`, `initialScene`: 空字符串
- `coverEmoji`: `'🌍'`（默认）
- `attributes`, `npcs`, `flags`, `startingItems`, `storyBeats`: 空数组

### 4.2 listCustomCards

```ts
function listCustomCards(): WorldCard[]
```

从 `localStorage['custom_world_cards']` 读取。含 `typeof window === 'undefined'` SSR 保护。JSON 解析失败时返回空数组。

### 4.3 saveCustomCard

```ts
function saveCustomCard(card: WorldCard): void
```

按 `card.id` 查找替换（更新）或追加（新建）。全量覆盖写入 localStorage。

### 4.4 deleteCustomCard

```ts
function deleteCustomCard(id: string): void
```

按 ID 过滤后写回 localStorage。

### 4.5 存储风险

- 无版本号/迁移机制
- 无大小限制（JSON 序列化大卡可能导致 localStorage 溢出）
- 无加密（敏感数据不应存放在此）

---

## 5. WorldCreator 创作台（6 标签页）

定义于 `src/components/WorldCreator.tsx`，是一个 'use client' 组件。内部状态 `card: WorldCard` 通过 `createEmptyCard()` 初始化，编辑过程中的 `patch` 通过 `update()` 函数（`setCard(c => ({ ...c, ...patch }))`）进行字段级合并。

顶部栏包含返回按钮、AccountButton、SystemSettings，以及"保存"和"试玩"按钮。
- 保存：`saveCustomCard(card)` + 2 秒短暂显示"已保存"反馈
- 试玩：保存后 `router.push('/game?custom=${card.id}')`

### 5.1 世界观标签页（world）

编辑 WorldCard 的前 5 个字段：世界名称（必填）、Emoji（独立短输入）、副标题、世界观描述（textarea，说明将注入 AI prompt）、开场场景（textarea，第一段文字）。

### 5.2 属性标签页（attrs）

动态列表管理 AttributeDef。每行包含：icon（emoji）、属性名、初始值（0~10 number）、上限（1~10 number）、删除按钮。底部"+ 添加属性"按钮添加默认行：`{ key: 'attr_N', name: '', icon: '⬡', initial: 3, max: 10 }`。空列表时显示提示文案。

### 5.3 角色标签页（characters）

**双子标签**：主角(⭐) / 配角(👥)，通过 `subTab` 状态切换。

角色卡片渲染逻辑：
1. 主角至多 1 个，由 `isMainCharacter` 标示。按"创建主角"按钮时自动生成完整 NPC 骨架（所有 PRESET_NPC_FIELDS 按类型初始化默认值）。
2. 配角可添加多个，按钮"添加配角"同样生成 NPC 骨架，默认 name 为"新角色"。
3. 每个角色卡片内按 `getVisibleKeys` 决定字段展示顺序：核心字段 → 预设非核心字段 → 自定义字段。

**NPC 字段管理**：
- 核心字段（CORE_FIELD_KEYS）显示 🔒 锁定，不可删除
- 非核心预设字段可删除（设 `_rm_{key}: true` 标记隐藏）
- 自定义字段可彻底删除（从 fields 和 _customMeta 中移除）

**双空添加槽机制**：
每个角色卡片底部有两个并排的空字段添加槽。每个槽位包含：
- 字段名称输入（短输入）
- 说明/示例输入（flex 占满剩余空间）
- "+ 添加"按钮

输入名称后点击添加，自动在 `fields` 中新增键值对，并在 `_customMeta` 中记录字段说明。两个槽位独立管理各自的临时状态（`slot1`, `slot2`）。

### 5.4 物品 & 旗标标签页（items）

两个独立区块：

**开局物品**：文本输入 + Enter 键/按钮添加，显示为标签式胶囊，点击 ✕ 移除。AI 可能围绕物品生成剧情。

**世界旗标**：同样输入 + 标签式展示（浅色主题胶囊 + 等宽字体），与节拍链中的旗标选择联动。

### 5.5 节拍链标签页（beats）

节拍卡片列表，每个卡片包含：

1. **基本信息**：名称输入 + ID 显示 + 删除按钮
2. **描述**：AI 判断完成此节拍的标准
3. **前置条件**：列出当前卡片定义的所有属性（属性门槛 ≥ N）和所有 NPC（好感度门槛 ≥ N）。数字输入值为空时自动移除该条件。
4. **效果**：从当前卡片定义的旗标列表中选择（`<select>` 避免手动输入错误）。已选的旗标显示为标签。
5. **解锁**：勾选当前卡片中除自身外的其他节拍。对应 StoryBeat.unlocks 数组。

底部"+ 添加节拍"按钮添加默认节拍：`{ id: 'beat_Date.now()', name: '', description: '', effects: {}, unlocks: [] }`。

### 5.6 预览标签页（preview）

只读展示卡片的完整预览：封面 emoji + 名称 + 副标题居中，四格数据展示（属性、NPC、物品、节拍的数量和明细）。NPC 条目显示名称和初始好感度。

---

## 6. 世界选择与游戏启动

### 6.1 入口流程

```
主菜单（HomeIsland）
  ├── 开始冒险 → 世界选择画面（HomeIsland screen='worlds' / WorldCardSelector）
  │   ├── 预设世界卡展示
  │   ├── 自定义世界卡展示（从 localStorage 加载）
  │   ├── "创建一个新世界" → /creator（WorldCreator 创作台）
  │   └── 选中卡片 → 玩家名称输入 → "开始冒险"
  └── 继续游戏 → 读档画面（screen='loads'）
```

HomeIsland.tsx 和 WorldCardSelector.tsx 是两个并存的实现。HomeIsland 是主入口组件（使用三屏幕状态机：menu/worlds/loads），WorldCardSelector 是仅包含世界选择和读档的子组件（用于复用或被其他路由引用）。两者逻辑相同。

### 6.2 START_GAME action（核心初始化）

定义于 `src/lib/player-state-context.tsx` 的 `playerStateReducer` 中。当用户点击"开始冒险"时，`actions.startGame(selectedCard, playerName)` 向 reducer 分发 `{ type: 'START_GAME', worldCard, playerName }`：

```ts
case 'START_GAME': {
  // 1. 从 worldCard.attributes 读取每个属性的 initial 值
  const attrs: Record<string, number> = {}
  action.worldCard.attributes.forEach(a => { attrs[a.key] = a.initial })

  // 2. 从每个 NPC 的初始好感度初始化 npcAffinities
  const npcAffinities: Record<string, number> = {}
  action.worldCard.npcs.forEach(n => { npcAffinities[n.id] = n.fields.initialAffinity ?? 0 })

  // 3. 为每个 NPC 初始化空运行时状态
  const npcRuntime: Record<string, RuntimeNPCState> = {}
  action.worldCard.npcs.forEach(n => {
    npcRuntime[n.id] = { currentSelfPerception: '', currentState: '' }
  })

  // 4. 构建 PlayerState
  return {
    screen: 'playing',
    worldCard: action.worldCard,           // 完整世界卡对象
    playerState: {
      playerName: action.playerName,       // 玩家输入或默认"冒险者"
      attributes: attrs,                   // 初始属性值
      flags: {},                           // 空旗标表（游戏开始时无任何进度）
      inventory: action.worldCard.startingItems,  // 从世界卡复制开局物品
    },
    npcAffinities,                         // NPC 好感度表
    npcRuntime,                            // NPC 运行时状态
    currentOptions: [],                    // 空选项列表（AI 首次回复后填充）
  }
}
```

关键要点：
- **`flags` 初始化为空对象**：世界卡上的 `worldCard.flags` 是"这个世界的预期旗标列表"，不是初始值。游戏启动时零进度。
- **`inventory` 直接拷贝 self 引用**：`action.worldCard.startingItems` 是 `string[]`，拷贝后修改不影响原定义。
- **`npcAffinities` 浅拷贝**：后续游戏中通过 delta 加减更新。
- **`npcRuntime` 每个 NPC 初始化为 `{ currentSelfPerception: '', currentState: '' }`**，AI 可以在游戏中进行填充。

### 6.3 自定义卡启动

如果 URL 包含 `?custom={cardId}` 参数，`/game` 路径会从 localStorage 查找对应自定义卡再执行 START_GAME。试玩按钮就是通过此机制路由。

### 6.4 读档流程

LoadSave action 直接从存档恢复 `playerState`、`npcAffinities` 和 `worldCard`，不经过 START_GAME 的完整初始化。

---

## 7. 关键设计决策

### 7.1 旗标的两层含义

`WorldCard.flags` 是**世界定义层的预期旗标列表**（创作时作者列出所有可能出现的剧情标记），`PlayerState.flags` 是**运行时的旗标状态**（键为旗标名，值为 boolean）。两者独立——世界定义层的旗标用于编辑器的节拍链条件选择和下拉列表，不自动注入运行时。

### 7.2 StoryBeat 的解锁图

节拍链通过 `unlocks: string[]` 形成一个有向无环图。第一个节拍（通常是 intro）无前驱，最后一个节拍的 unlocks 为空数组。游戏运行时目前不强制节拍顺序——节拍信息通过 system prompt 注入 AI，由 AI 判断何时触发哪个节拍。

### 7.3 NPC 运行时与静态定义分离

`RuntimeNPCState`（currentSelfPerception + currentState）与 `NPCDef`（静态档案）物理分离。存档只存储运行时部分，防止 AI 在游戏中修改 NPC 的原始定义字段。

### 7.4 主角约束

世界卡至多一个 `isMainCharacter: true` 的 NPC。这是业务约束（未在类型层面强制），由 WorldCreator 的 UI 逻辑保证：主角标签页只展示/创建第一个主角 NPC。

### 7.5 自定义字段的双空槽模式

编辑器为每个 NPC 保留两个空字段添加槽，字段名与字段说明分开输入，避免创作者需要回头编辑已添加字段的元数据。每个槽独立管理临时状态。

### 7.6 description 作为 AI 注入文本

`WorldCard.description` 不经过任何 Schema 校验，以 Markdown 格式直接注入 AI system prompt。这意味着世界描述的语法和结构由创作者自行负责，AI 品质直接取决于描述质量。

---

## 相关文档

- ai-engine.md：world settings 注入 AI system prompt 的格式（buildSystemPrompt）
- npc-affinity-system.md：initialAffinity 是 NPC 好感度的初始值来源，NPC 定义中的 personalityTags
- game-options-conditions.md：StoryBeat.preconditions 共用六种条件评估体系
- state-management.md：START_GAME action 的分发逻辑，PlayerState 初始化

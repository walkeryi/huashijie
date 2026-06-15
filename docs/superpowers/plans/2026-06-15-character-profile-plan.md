# 角色档案系统 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 NPC 系统从 4 字段扩展为 14 字段的角色档案，支持玩家自定义字段，并实现好感度概率算法。

**Architecture:** 类型层（types.ts）定义 NPCFieldMeta/NPCDef → 数据层（world-cards.ts）迁移预设剧本 → 业务层（affinity.ts）好感度算法 → UI 层（WorldCreator/NPCPanel）适配新格式 → API 层（adventure route）注入更丰富的角色信息到 AI prompt。

**Tech Stack:** TypeScript, React, Next.js, Vitest

---

### Task 1: 类型定义 — NPCFieldMeta、NPCDef、RuntimeNPCState、预设字段

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: 写类型定义测试**

在 `src/lib/__tests__/game-reducer.test.ts` 中追加测试：

```ts
import { NPCFieldMeta, NPCDef, RuntimeNPCState } from '../types'

describe('NPCFieldMeta', () => {
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
      expect(['string','string[]','boolean','number']).toContain(f.type)
    })
  })

  it('静态预设字段不含运行时字段 currentSelfPerception / currentState', () => {
    const keys = PRESET_NPC_FIELDS.map(f => f.key)
    expect(keys).not.toContain('currentSelfPerception')
    expect(keys).not.toContain('currentState')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/lib/__tests__/game-reducer.test.ts
```
预期: `ReferenceError: PRESET_NPC_FIELDS is not defined` / `RuntimeNPCState is not defined`

- [ ] **Step 3: 实现类型定义**

在 `src/lib/types.ts` 中，替换旧的 NPCDef 并新增：

```ts
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
```

同时在 `GameState` 中添加：

```ts
npcRuntime: Record<string, RuntimeNPCState>  // key = npc.id
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/lib/__tests__/game-reducer.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/__tests__/game-reducer.test.ts
git commit -m "feat(types): NPCFieldMeta/NPCDef/RuntimeNPCState — 12静态+2运行时"
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/lib/__tests__/game-reducer.test.ts
```
预期: 包含 PRESET_NPC_FIELDS 的所有测试 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/__tests__/game-reducer.test.ts
git commit -m "feat(types): NPCFieldMeta/NPCDef 重定义，14个预设角色字段"
```

---

### Task 2: 预设剧本 NPC 迁移

**Files:**
- Modify: `src/data/world-cards.ts:29-33,70-74`
- 可能受影响的测试: `src/data/__tests__/world-cards.test.ts`

- [ ] **Step 1: 确认现有测试**

先看现有测试是否需要更新：

```bash
npx vitest run src/data/__tests__/world-cards.test.ts
```

如果测试引用了旧 NPCDef 的 `description` 或 `initialAffinity`，记录下来稍后更新。

- [ ] **Step 2: 迁移蒸汽苍穹 NPC**

在 `src/data/world-cards.ts` 中，替换第 29-33 行的 npcs 数组：

```ts
npcs: [
  {
    id: 'player',
    isMainCharacter: true,
    fields: {
      id: 'player',
      name: '',
      isMainCharacter: true,
      gender: '未知',
      origin: '铁鹰城年轻机械师学徒，在飞艇坠毁中失去了记忆',
      birthday: '',
      currentSelfPerception: '刚遭遇坠机事故的幸存者，困惑但对自己追查水晶线索的使命有模糊直觉',
      currentState: '身体有几处擦伤和头痛，在残骸中苏醒，窗外是下坠的城市碎片',
      dialogueTone: '年轻、好奇、坚韧；面对危险时偶尔自嘲；对机械术语自然流露',
      dialogueExamples: '"这家伙还能修——给我五分钟。"（*蹲下检查齿轮组*）',
      personalityTags: ['坚韧', '好奇', '务实'],
      appearance: '深棕色短发，浅褐肤色，手上常年有机油印',
      currentAttire: '残破的深蓝色机械师工装，左肩有铁鹰城学徒徽章',
      initialAffinity: 0,
    },
  },
  {
    id: 'old_mechanic',
    isMainCharacter: false,
    fields: {
      id: 'old_mechanic',
      name: '老机械师陈',
      isMainCharacter: false,
      gender: '男',
      origin: '铁鹰城退休首席机械师',
      birthday: '',
      currentSelfPerception: '退休了但心里仍惦记着水晶问题',
      currentState: '在工坊里捣鼓旧机器，表面上不问世事',
      dialogueTone: '古怪、爱唠叨、偶尔蹦出真知灼见',
      dialogueExamples: '',
      personalityTags: ['古怪', '睿智'],
      appearance: '满头白发，铜框护目镜，手上全是机油',
      currentAttire: '旧皮围裙+满是口袋的工作背心',
      initialAffinity: 20,
    },
  },
  {
    id: 'guard_captain',
    isMainCharacter: false,
    fields: {
      id: 'guard_captain',
      name: '卫队长赵',
      isMainCharacter: false,
      gender: '男',
      origin: '铁鹰城卫队长，平民靠军功晋升',
      birthday: '',
      currentSelfPerception: '忠于职守的军人，内心对贵族不满',
      currentState: '正在巡查城防，忧心忡忡',
      dialogueTone: '严肃、简练、偶尔流露无奈',
      dialogueExamples: '',
      personalityTags: ['正直', '压抑'],
      appearance: '中年，体格魁梧，眼角有刀疤',
      currentAttire: '铁灰色卫队制服+披风',
      initialAffinity: 0,
    },
  },
  {
    id: 'sky_noble',
    isMainCharacter: false,
    fields: {
      id: 'sky_noble',
      name: '天空贵族洛',
      isMainCharacter: false,
      gender: '女',
      origin: '天空贵族世家小姐',
      birthday: '',
      currentSelfPerception: '渴望摆脱贵族束缚，追求自由',
      currentState: '偷溜出家门，在城中游荡',
      dialogueTone: '活泼、好奇、有时任性',
      dialogueExamples: '',
      personalityTags: ['活泼', '叛逆'],
      appearance: '长发及腰，虽着脏裙装仍可见贵族气质',
      currentAttire: '蓝色丝绒长裙，裙角沾了机油污渍',
      initialAffinity: 10,
    },
  },
],
```

- [ ] **Step 3: 迁移玉京风华 NPC**

同上模式，将第 70-74 行的 NPC 迁移为新的 NPCDef 格式。包含 4 个角色：player（主角）、tea_master、spirit_guardian、court_official。

- [ ] **Step 4: 更新测试**

更新 `src/data/__tests__/world-cards.test.ts` 中引用了旧 NPCDef 格式的断言。将 `npc.description` 改为 `npc.fields.origin`，`npc.initialAffinity` 改为 `npc.fields.initialAffinity`。

- [ ] **Step 5: 运行全部测试**

```bash
npx vitest run
```
预期: 全部 PASS

- [ ] **Step 6: Commit**

```bash
git add src/data/world-cards.ts src/data/__tests__/world-cards.test.ts
git commit -m "feat(data): 预设剧本 NPC 迁移到14字段角色档案格式"
```

---

### Task 3: 好感度算法模块

**Files:**
- Create: `src/lib/affinity.ts`
- Create: `src/lib/__tests__/affinity.test.ts`

- [ ] **Step 1: 写好感度测试**

创建 `src/lib/__tests__/affinity.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { mapAffinityToBaseProbability, personalityComplianceCoefficient, computeComplianceProbability } from '../affinity'

describe('mapAffinityToBaseProbability', () => {
  it('-100~-51 返回 0.05', () => {
    expect(mapAffinityToBaseProbability(-100)).toBe(0.05)
    expect(mapAffinityToBaseProbability(-75)).toBe(0.05)
    expect(mapAffinityToBaseProbability(-51)).toBe(0.05)
  })

  it('-50~-1 返回 0.20', () => {
    expect(mapAffinityToBaseProbability(-50)).toBe(0.20)
    expect(mapAffinityToBaseProbability(-1)).toBe(0.20)
  })

  it('0~19 返回 0.40', () => {
    expect(mapAffinityToBaseProbability(0)).toBe(0.40)
    expect(mapAffinityToBaseProbability(19)).toBe(0.40)
  })

  it('80~100 返回 0.95', () => {
    expect(mapAffinityToBaseProbability(80)).toBe(0.95)
    expect(mapAffinityToBaseProbability(100)).toBe(0.95)
  })

  it('超出范围值被 clamp', () => {
    expect(mapAffinityToBaseProbability(-200)).toBe(0.05)
    expect(mapAffinityToBaseProbability(200)).toBe(0.95)
  })
})

describe('personalityComplianceCoefficient', () => {
  it('顺从/温和/忠诚返回 1.3', () => {
    expect(personalityComplianceCoefficient(['顺从'])).toBe(1.3)
    expect(personalityComplianceCoefficient(['温和'])).toBe(1.3)
  })

  it('叛逆/傲慢返回 0.6', () => {
    expect(personalityComplianceCoefficient(['叛逆'])).toBe(0.6)
  })

  it('多个标签取最低系数', () => {
    expect(personalityComplianceCoefficient(['顺从', '谨慎'])).toBe(0.85)
  })

  it('无匹配标签返回默认 1.0', () => {
    expect(personalityComplianceCoefficient(['其他'])).toBe(1.0)
  })

  it('空数组返回默认 1.0', () => {
    expect(personalityComplianceCoefficient([])).toBe(1.0)
  })
})

describe('computeComplianceProbability', () => {
  it('好感45、正直性格、普通请求、私下 → 0.70', () => {
    const result = computeComplianceProbability({
      affinity: 45,
      personalityTags: ['正直'],
      requestLevel: 'normal',
      situation: 'private',
    })
    // 0.70 × 1.0 × 1.0 × 1.0 = 0.70
    expect(result).toBe(0.70)
  })

  it('好感45、叛逆性格、重要请求、私下 → clamp(0.336, 0.02, 0.98)', () => {
    const result = computeComplianceProbability({
      affinity: 45,
      personalityTags: ['叛逆'],
      requestLevel: 'important',
      situation: 'private',
    })
    // 0.70 × 0.6 × 0.8 × 1.0 = 0.336
    expect(result).toBeCloseTo(0.336)
  })

  it('好感≥80 高好感保底：只补到1.0不放大', () => {
    const result = computeComplianceProbability({
      affinity: 85,
      personalityTags: ['叛逆'],
      requestLevel: 'extreme',
      situation: 'public',
    })
    // 保底：低于1.0的取1.0，高于1.0的保持不变
    // base=0.95 × personality=0.6 × request=min(0.2→1.0)=1.0 × situation=min(0.7→1.0)=1.0 = 0.57
    expect(result).toBeCloseTo(0.57)
  })

  it('好感≥80 琐碎请求不放大（修复保底漏洞）', () => {
    const result = computeComplianceProbability({
      affinity: 85,
      personalityTags: ['正直'],
      requestLevel: 'trivial',
      situation: 'public',
    })
    // base=0.95 × personality=1.0 × request: 1.2保持不变(>1.0) × situation: 0.7→1.0 = 0.95×1.0×1.2×1.0 = 1.14 → clamp → 0.98
    // 而非旧版: 0.95×1.0×1.2×1.0 = 1.14, 没有放大琐碎请求
    expect(result).toBeCloseTo(0.98)
  })

  it('最终概率不低于 0.02', () => {
    const result = computeComplianceProbability({
      affinity: -100,
      personalityTags: ['叛逆'],
      requestLevel: 'extreme',
      situation: 'public',
    })
    expect(result).toBe(0.02)
  })

  it('最终概率不高于 0.98', () => {
    const result = computeComplianceProbability({
      affinity: 100,
      personalityTags: ['顺从'],
      requestLevel: 'trivial',
      situation: 'saved',
    })
    // base=0.95 × 1.3 × 1.2 × 1.5 = 2.223 → clamp → 0.98
    expect(result).toBe(0.98)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/lib/__tests__/affinity.test.ts
```
预期: 全部 FAIL（模块不存在）

- [ ] **Step 3: 实现好感度算法**

创建 `src/lib/affinity.ts`：

```ts
// ========== 好感映射 → 基础概率 ==========

export function mapAffinityToBaseProbability(affinity: number): number {
  const clamped = Math.max(-100, Math.min(100, affinity))
  if (clamped >= 80) return 0.95
  if (clamped >= 60) return 0.85
  if (clamped >= 40) return 0.70
  if (clamped >= 20) return 0.55
  if (clamped >= 0) return 0.40
  if (clamped >= -50) return 0.20
  return 0.05
}

// ========== 性格系数 ==========

const PERSONALITY_COEFFICIENTS: Record<string, number> = {
  '顺从': 1.3,
  '温和': 1.3,
  '忠诚': 1.3,
  '正直': 1.0,
  '勇敢': 1.0,
  '谨慎': 0.85,
  '多疑': 0.85,
  '叛逆': 0.6,
  '傲慢': 0.6,
}

/** 从 personalityTags 取最低系数 */
export function personalityComplianceCoefficient(personalityTags: string[]): number {
  if (personalityTags.length === 0) return 1.0
  let min = 1.0
  for (const tag of personalityTags) {
    const c = PERSONALITY_COEFFICIENTS[tag]
    if (c !== undefined && c < min) min = c
  }
  return min
}

// ========== 请求系数 ==========

const REQUEST_COEFFICIENTS: Record<string, number> = {
  trivial: 1.2,
  normal: 1.0,
  important: 0.8,
  major: 0.5,
  extreme: 0.2,
}

// ========== 情境系数 ==========

const SITUATION_COEFFICIENTS: Record<string, number> = {
  private: 1.0,
  public: 0.7,
  aligned: 1.3,
  saved: 1.5,
  coerced: 0.5,
  lifeThreatened: 0.3,
}

// ========== 核心公式 ==========

export interface ComplianceInput {
  affinity: number
  personalityTags: string[]
  requestLevel: 'trivial' | 'normal' | 'important' | 'major' | 'extreme'
  situation: 'private' | 'public' | 'aligned' | 'saved' | 'coerced' | 'lifeThreatened'
}

export function computeComplianceProbability(input: ComplianceInput): number {
  const base = mapAffinityToBaseProbability(input.affinity)
  const personality = personalityComplianceCoefficient(input.personalityTags)
  let request = REQUEST_COEFFICIENTS[input.requestLevel] ?? 1.0
  let situation = SITUATION_COEFFICIENTS[input.situation] ?? 1.0

  // 高好感保底：只对低于1.0的系数补到1.0，高于1.0的保持不变（防琐碎请求刷成功率）
  if (input.affinity >= 80) {
    if (request < 1.0) request = 1.0
    if (situation < 1.0) situation = 1.0
  }

  const raw = base * personality * request * situation
  return Math.max(0.02, Math.min(0.98, raw))
}

// ========== 好感变化 ==========

export interface AffinityChangeEvent {
  type: 'dialogue' | 'wishFulfilled' | 'betrayal' | 'saved' | 'warningIgnored'
  magnitude: number
}

export function computeAffinityChange(event: AffinityChangeEvent): number {
  switch (event.type) {
    case 'dialogue':
      return event.magnitude // ±5~15
    case 'wishFulfilled':
      return event.magnitude // +20~30
    case 'betrayal':
      return -event.magnitude // -(20~30)
    case 'saved':
      return event.magnitude // +20~30
    case 'warningIgnored':
      return -event.magnitude // -(10~20)
    default:
      return 0
  }
}

/** 冷却期检查：关键事件后游戏内3天重复触发效果减半 */
export function applyCooldown(
  change: number,
  lastMajorEventDay: number | null,
  currentDay: number,
): number {
  if (lastMajorEventDay !== null && Math.abs(change) >= 20 && (currentDay - lastMajorEventDay) <= 3) {
    return Math.round(change / 2)
  }
  return change
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/lib/__tests__/affinity.test.ts
```
预期: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/affinity.ts src/lib/__tests__/affinity.test.ts
git commit -m "feat(affinity): 好感度概率算法 + 映射表 + 变化规则"
```

---

### Task 4: game-context 适配新 NPCDef

**Files:**
- Modify: `src/lib/game-context.tsx` — 约 5 处

- [ ] **Step 1: 补充 game-reducer 测试**

在 `src/lib/__tests__/game-reducer.test.ts` 中追加测试：

```ts
it('START_GAME 从新 NPCDef.fields 初始化 npcAffinities', () => {
  const card = makeWorldCard({
    npcs: [
      { id: 'ally', isMainCharacter: false, fields: { initialAffinity: 20, name: 'Ally', dialogueTone: '友善', id: 'ally', isMainCharacter: false, gender: '男', origin: '未知', birthday: '', currentSelfPerception: '', currentState: '', dialogueExamples: '', personalityTags: [], appearance: '', currentAttire: '' } },
      { id: 'rival', isMainCharacter: false, fields: { initialAffinity: -10, name: 'Rival', dialogueTone: '冷淡', id: 'rival', isMainCharacter: false, gender: '女', origin: '未知', birthday: '', currentSelfPerception: '', currentState: '', dialogueExamples: '', personalityTags: [], appearance: '', currentAttire: '' } },
    ],
  })
  const state = createInitialState()
  const action: GameAction = { type: 'START_GAME', worldCard: card, playerName: 'test' }
  const next = gameReducer(state, action)
  expect(next.npcAffinities).toEqual({ ally: 20, rival: -10 })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/lib/__tests__/game-reducer.test.ts
```
预期: 新测试 FAIL（npcAffinities 未从 fields 读取）

- [ ] **Step 3: 修改 START_GAME reducer**

在 `src/lib/game-context.tsx` 的 `START_GAME` case 中，修改 npcAffinities 初始化：

```ts
// 旧代码（第 134-135 行）:
// action.worldCard.npcs.forEach(n => { npcAffinities[n.id] = n.initialAffinity })

// 替换为:
action.worldCard.npcs.forEach(n => {
  npcAffinities[n.id] = n.fields.initialAffinity ?? 0
})
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/lib/__tests__/game-reducer.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/game-context.tsx src/lib/__tests__/game-reducer.test.ts
git commit -m "fix(game-context): START_GAME 从新 NPCDef.fields 读取初始好感度"
```

---

### Task 5: AI prompt 适配新 NPCDef + few-shot 约束模板

**Files:**
- Modify: `src/app/api/adventure/route.ts`

- [ ] **Step 1: 更新 route 测试**

在 `src/app/api/adventure/__tests__/route.test.ts` 中找到涉及 NPC 描述的测试数据，更新为新 NPCDef 格式（把 `npc.description` 和 `npc.initialAffinity` 改为 `npc.fields.*`）。

- [ ] **Step 2: 重写 buildSystemPrompt 的 NPC 段（含 few-shot 约束）**

将 `src/app/api/adventure/route.ts` 的 NPC 段替换为完整模板：

```ts
// NPC 角色档案（含 few-shot 风格约束）
const npcText = worldCard.npcs.length > 0
  ? worldCard.npcs.map(npc => {
      const f = npc.fields
      const affinity = npcAffinities[npc.id] ?? f.initialAffinity ?? 0
      const runtime = (npcRuntime as Record<string, RuntimeNPCState>)?.[npc.id]

      let text = `👤 ${f.name || npc.id}`
      if (f.gender) text += `  |  性别: ${f.gender}`
      if (f.origin) text += `  |  来历: ${f.origin}`
      if (f.dialogueTone) text += `  |  性格: ${f.dialogueTone}`
      if (f.personalityTags?.length) text += `  |  标签: ${f.personalityTags.join('、')}`
      if (f.appearance) text += `  |  外貌: ${f.appearance}`
      if (f.currentAttire) text += `  |  衣着: ${f.currentAttire}`
      if (runtime?.currentSelfPerception) text += `  |  此刻自我认知: ${runtime.currentSelfPerception}`
      if (runtime?.currentState) text += `  |  此刻状态: ${runtime.currentState}`
      text += `  |  好感: ${affinity}/100`

      if (f.dialogueExamples) {
        text += `\n\n**说话风格指南（参考以下例句的口吻和节奏，但绝不照搬原句）：**\n${f.dialogueExamples}`
      }

      return text
    }).join('\n\n')
  : '无'

// 追加全局约束到 system prompt
const npcInstruction = worldCard.npcs.some(n => n.fields.dialogueExamples)
  ? `\n## NPC 对话约束
- 以上 NPC 的「说话风格指南」仅用于理解该角色的说话方式、用词习惯和语气节奏
- 生成该角色的对白时，必须根据当前上下文重新组织语言，严禁直接输出例句中的任何原文
- 当前场景的上下文优先于参考例句中的历史情景
- 称呼规则：好感≥40 直呼其名，好感≥60 用专属昵称，好感≥80 私下用昵称、正式场合用敬称`
  : ''
```

注意：`buildSystemPrompt` 函数签名需新增 `npcRuntime` 参数，调用方（POST handler）传入 `body.npcRuntime`。

- [ ] **Step 3: 运行测试确认通过**

```bash
npx vitest run src/app/api/adventure/__tests__/route.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/adventure/route.ts src/app/api/adventure/__tests__/route.test.ts
git commit -m "feat(api): AI prompt NPC 段改用14字段角色档案"
```

---

### Task 6: NPCPanel 适配新 NPCDef

**Files:**
- Modify: `src/components/NPCPanel.tsx`

- [ ] **Step 1: 修改 NPCPanel 数据读取**

`NPCPanel.tsx:27-39` — 将 `npc.description` 替换为 `npc.fields.dialogueTone || npc.fields.origin`；`npc.initialAffinity` 已在 game-context 中处理，这里不需要改。

```tsx
// 第 27 行: const val = affinities[npc.id] ?? npc.initialAffinity
// 改为:
const val = affinities[npc.id] ?? npc.fields.initialAffinity ?? 0

// 第 33 行: <span className="font-medium">{npc.name}</span>
// 改为:
<span className="font-medium">{npc.fields.name || npc.id}</span>

// 第 39 行: <p className="text-xs text-[var(--text-secondary)] mt-1">{npc.description}</p>
// 改为:
<p className="text-xs text-[var(--text-secondary)] mt-1">{npc.fields.origin || npc.fields.dialogueTone || ''}</p>
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/NPCPanel.tsx
git commit -m "fix(NPCPanel): 数据源改用新 NPCDef.fields"
```

---

### Task 7: 创作台角色标签 UI

**Files:**
- Modify: `src/components/WorldCreator.tsx` — 重写 NPCsTab 为 CharacterTab

- [ ] **Step 1: 更新测试**

在 `src/components/__tests__/SystemSettings.test.tsx` 同级目录，后续可补 WorldCreator 测试。本次先靠手动验证 UI。

- [ ] **Step 2: 改造 WorldCreator**

将 `src/components/WorldCreator.tsx` 做以下改动：

**a) Tab 定义修改（第 10-17 行）：**

```tsx
type Tab = 'world' | 'attrs' | 'characters' | 'items' | 'beats' | 'preview'

const TABS: { key: Tab; label: string }[] = [
  { key: 'world', label: '世界观' },
  { key: 'attrs', label: '属性' },
  { key: 'characters', label: '👤角色' },
  { key: 'items', label: '物品&旗标' },
  { key: 'beats', label: '节拍链' },
  { key: 'preview', label: '预览' },
]
```

**b) Tab 内容渲染修改（第 81 行附近）：**

```tsx
{tab === 'characters' && <CharacterTab card={card} update={update} />}
```

**c) 新建 CharacterTab 组件**（替换旧的 NPCsTab）：

主角/配角 子标签 + 纵向表单。字段按 preset metadata 渲染：
- `fixed: true` 的字段显示锁定标记
- `nullable: true` 的字段可留空
- 底部"+ 添加自定义字段"按钮

```tsx
function CharacterTab({ card, update }: { card: WorldCard; update: (p: Partial<WorldCard>) => void }) {
  const [subTab, setSubTab] = useState<'main' | 'side'>('main')

  const mainNpc = card.npcs.find(n => n.isMainCharacter)
  const sideNpcs = card.npcs.filter(n => !n.isMainCharacter)

  const ensureMainExists = () => {
    if (mainNpc) return
    const newNpc: NPCDef = {
      id: 'player',
      isMainCharacter: true,
      fields: {},
    }
    PRESET_NPC_FIELDS.forEach(f => {
      newNpc.fields[f.key] = f.type === 'string[]' ? [] : f.type === 'number' ? 0 : f.type === 'boolean' ? false : ''
    })
    newNpc.fields.id = 'player'
    newNpc.fields.isMainCharacter = true
    update({ npcs: [newNpc, ...sideNpcs] })
  }

  const updateField = (npcId: string, key: string, value: any) => {
    const npcs = card.npcs.map(n => {
      if (n.id !== npcId) return n
      return { ...n, fields: { ...n.fields, [key]: value } }
    })
    update({ npcs })
  }

  // ... 渲染逻辑
}
```

完整的 CharacterTab 实现（包括子标签切换、字段渲染、添加自定义字段）在 Task 7 步骤 c 中实现。

- [ ] **Step 3: 验证编译和功能**

```bash
npx tsc --noEmit
npm run dev  # 手动验证 /creator 页面
```

- [ ] **Step 4: Commit**

```bash
git add src/components/WorldCreator.tsx
git commit -m "feat(creator): 角色标签+主角/配角子标签+纵向表单+自定义字段"
```

---

## 验证 Checklist

- [ ] `npx vitest run` — 全部测试 PASS
- [ ] `npx tsc --noEmit` — 无类型错误
- [ ] `npm run dev` — 创作台"角色"标签正常渲染
- [ ] 预设剧本 NPC 静态字段不含 `currentSelfPerception`/`currentState`
- [ ] `npcRuntime` 独立初始化，存档时与静态定义分开序列化
- [ ] 好感度核心公式：高好感不放大琐碎请求（trivial×public→1.2 非 1.2）
- [ ] AI prompt 注入含 few-shot "风格参考非台词库"约束
- [ ] 好感度面板（NPCPanel）正确显示新格式数据

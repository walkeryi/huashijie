# 进度门控系统 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完整的剧情进度门控系统：属性 + NPC好感 + 物品 + 世界旗标决定可用分支，AI 管理数值，前端弹窗只读展示。

**Architecture:** types → reducer → API prompt → UI组件。数据流：AI 返回 `npcAffinityChanges/itemsGained/newFlags` → reducer 累积更新 → 系统提示词下次携带完整状态 → UI 弹窗读取展示。

**Tech Stack:** Next.js + TypeScript（现有栈）

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/lib/types.ts` | 修改 | NPCDef、WorldCard/PlayerState/GameState/AIResponse/GameOption/GameAction 扩展 |
| `src/data/world-cards.ts` | 修改 | 预设世界卡加 npcs/flags/startingItems |
| `src/lib/game-context.tsx` | 修改 | 新字段初始值、reducer 处理、submitAction 传参 |
| `src/app/api/adventure/route.ts` | 修改 | 系统提示词注入 NPC/物品/旗标、prompt 新增规则 |
| `src/components/OptionsPanel.tsx` | 修改 | 新增 npcAffinityChecks/itemChecks/flagChecks 条件判断 |
| `src/components/StatusPanel.tsx` | 修改 | 底部三个图标按钮 |
| `src/components/NPCPanel.tsx` | 新建 | NPC 好感弹窗 |
| `src/components/InventoryPanel.tsx` | 新建 | 物品栏弹窗 |
| `src/components/FlagPanel.tsx` | 新建 | 旗标弹窗 |
| `src/__tests__/` | 新建/修改 | 测试 |

---

### Task 1: 扩展类型定义

**Files:**
- Modify: `src/lib/types.ts`

添加 NPCDef、WorldCard 新增字段、PlayerState 加 inventory、GameState 加 npcAffinities、GameOption 加全部条件类型、AIResponse 加全部新字段、GameAction 加新动作。

- [ ] **Step 1: 写类型代码**

```typescript
// 新增
export interface NPCDef {
  id: string
  name: string
  description: string
  initialAffinity: number
}

// WorldCard 新增字段
npcs: NPCDef[]
flags: string[]
startingItems: string[]

// PlayerState 新增
inventory: string[]

// GameState 新增
npcAffinities: Record<string, number>

// GameOption 新增字段
npcAffinityChecks?: Record<string, string>
flagChecks?: string[]
flagNot?: string[]
itemChecks?: string[]
itemNot?: string[]

// AIResponse 新增字段
npcAffinityChanges: Record<string, number>
newFlags: string[]
lostFlags: string[]
itemsGained: string[]
itemsLost: string[]

// GameAction 新增
| { type: 'INIT_NPC_AFFINITIES'; affinities: Record<string, number> }
```

- [ ] **Step 2: 验证编译（预期 RED — 其他文件报错）**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/types.ts
git commit -m "feat: extend types for progression system — NPCDef, inventory, flags, affinity checks"
```

---

### Task 2: 更新预设世界卡

**Files:**
- Modify: `src/data/world-cards.ts`

添加 npcs、flags、startingItems 到两张预设卡。

- [ ] **Step 1: 为蒸汽苍穹添加 NPC 和旗标**

```typescript
npcs: [
  { id: 'old_mechanic', name: '老机械师陈', description: '铁鹰城退休首席机械师，对核心水晶了如指掌。脾气古怪但心肠不坏。', initialAffinity: 20 },
  { id: 'guard_captain', name: '卫队长赵', description: '铁鹰城卫队长，忠于职守。对贵族不满但不敢公开对抗。', initialAffinity: 0 },
  { id: 'sky_noble', name: '天空贵族洛', description: '年轻的贵族小姐，对机械和冒险充满好奇。是贵族中的异类。', initialAffinity: 10 },
],
flags: ['found_crystal_clue', 'allied_with_mechanics', 'confronted_nobles', 'discovered_truth'],
startingItems: ['机械扳手', '残破的飞艇日志'],
```

- [ ] **Step 2: 为玉京风华添加 NPC 和旗标**

```typescript
npcs: [
  { id: 'tea_master', name: '茶馆说书人柳', description: '京城茶馆的说书先生，消息灵通。似乎知道很多不该知道的事。', initialAffinity: 30 },
  { id: 'spirit_guardian', name: '灵兽守护者青', description: '隐居山林的灵兽守护者，沉默寡言。对灵力的感知异常敏锐。', initialAffinity: 5 },
  { id: 'court_official', name: '朝廷密使白', description: '奉命追查龙脉异象的密使。表面冷漠，内心对朝廷的腐败深恶痛绝。', initialAffinity: -10 },
],
flags: ['found_ancient_scroll', 'awakened_spirit_sense', 'exposed_corruption', 'reunited_last_beast'],
startingItems: ['泛黄的古卷', '铜钱 x5'],
```

- [ ] **Step 3: 验证编译并修复现有测试**

现有 world-cards 测试会因新增必填字段失败——更新测试的 makeWorldCard。

- [ ] **Step 4: 提交**

---

### Task 3: 更新 game-context（reducer + 状态）

**Files:**
- Modify: `src/lib/game-context.tsx`

- 初始值：inventory: [], npcAffinities: {}
- START_GAME: 用 worldCard.npcs 初始化 npcAffinities，inventory 从 startingItems
- SET_RESPONSE: 处理所有新字段（npcAffinityChanges 累积、itemsGained/Lost、newFlags/lostFlags）
- INIT_NPC_AFFINITIES: 批量设置好感
- submitAction: 把 inventory 和 npcAffinities 传给 API

- [ ] **Step 1: 修改 createInitialState**

```typescript
playerState: {
  // ... 现有 ...
  inventory: [],
},
npcAffinities: {},
```

- [ ] **Step 2: 修改 START_GAME reducer**

从 worldCard.npcs 初始化 npcAffinities，从 worldCard.startingItems 初始化 inventory。

- [ ] **Step 3: 修改 SET_RESPONSE reducer**

处理 npcAffinityChanges（累积）、itemsGained/Lost（合并到 inventory）、newFlags/lostFlags（合并到 flags）。

- [ ] **Step 4: 修改 submitAction**

body 中传递 inventory 和 npcAffinities。

- [ ] **Step 5: 验证编译 + 测试**

```bash
npx tsc --noEmit
npx vitest run
```

- [ ] **Step 6: 提交**

---

### Task 4: 更新系统提示词

**Files:**
- Modify: `src/app/api/adventure/route.ts`

- buildSystemPrompt 接受 playerState（已有），注入 inventory 列表、npcAffinities 状态、flags 状态
- Prompt 末尾加规则：NPC 好感管理、物品消耗、旗标变化
- parseAIResponse 中验证所有新字段（默认值 {} 或 []）

- [ ] **Step 1: 扩展 prompt**

在 "玩家当前状态" 下新增三个小节：

```
## NPC 关系
{遍历 npcs 显示好感}

## 物品栏
{遍历 inventory}

## 已解锁旗标
{遍历 flags}
```

- [ ] **Step 2: 扩展 prompt 规则**

末尾加：
> - NPC 好感度随玩家行为变化，友善行为增加、冒犯行为减少，范围 -100 到 100
> - 好感度高的 NPC 主动提供帮助、透露信息；好感度低的 NPC 拒绝交流或成为障碍
> - 物品在合理时消耗（itemsLost）或获得（itemsGained），影响后续可用选项
> - 旗标代表不可逆的世界变化，newFlags 添加、lostFlags 移除

- [ ] **Step 3: parseAIResponse 默认值处理**

npcAffinityChanges 默认 {}，newFlags/lostFlags/itemsGained/itemsLost 默认 []。

- [ ] **Step 4: 验证编译 + 测试**

```bash
npx tsc --noEmit
npx vitest run
```

- [ ] **Step 5: 提交**

---

### Task 5: 新增 NPC/物品/旗标面板组件

**Files:**
- Create: `src/components/NPCPanel.tsx`
- Create: `src/components/InventoryPanel.tsx`
- Create: `src/components/FlagPanel.tsx`

三个弹窗组件，结构一致：
- fixed inset-0 bg-black/60 遮罩
- 居中浮层，max-w-sm
- 标题 + 关闭按钮
- 内容只读列表
- 点击遮罩关闭

- [ ] **Step 1: NPCPanel**

```tsx
// props: open, onClose, npcs: NPCDef[], affinities: Record<string, number>
// 展示每个 NPC：name + 好感进度条 (0-100，红色表示负数)
```

- [ ] **Step 2: InventoryPanel**

```tsx
// props: open, onClose, inventory: string[]
// 展示物品列表
```

- [ ] **Step 3: FlagPanel**

```tsx
// props: open, onClose, flags: Record<string, boolean>
// 展示所有为 true 的旗标
```

- [ ] **Step 4: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 提交**

---

### Task 6: 更新 OptionsPanel 条件判断

**Files:**
- Modify: `src/components/OptionsPanel.tsx`

扩展 `checkCondition` → `checkOption`，处理所有 4 种条件：

- attributeChecks（已有，不变）
- npcAffinityChecks（新增）
- flagChecks / flagNot（新增）
- itemChecks / itemNot（新增）

需要从 `useGame()` 获取 `npcAffinities`、`inventory`、`playerState.flags`。

- [ ] **Step 1: 实现 checkOption**

```typescript
function checkOption(option: GameOption, state: GameState): boolean {
  // attributeChecks
  // npcAffinityChecks
  // flagChecks / flagNot
  // itemChecks / itemNot
  // ALL must pass
}
```

- [ ] **Step 2: 替换原有 checkCondition 调用**

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 提交**

---

### Task 7: 更新 StatusPanel + 添加弹窗触发

**Files:**
- Modify: `src/components/StatusPanel.tsx`

在侧边栏底部属性区下面加三个图标按钮，触发各自弹窗。

- [ ] **Step 1: 添加按钮和弹窗状态**

```tsx
const [showNPC, setShowNPC] = useState(false)
const [showInv, setShowInv] = useState(false)
const [showFlag, setShowFlag] = useState(false)

// 底部三个按钮
<div className="flex gap-2 border-t border-[var(--border)] pt-3">
  <button onClick={() => setShowNPC(true)}>👤</button>
  <button onClick={() => setShowInv(true)}>🎒</button>
  <button onClick={() => setShowFlag(true)}>🏳️</button>
</div>

// 弹窗
<NPCPanel open={showNPC} onClose={() => setShowNPC(false)} npcs={worldCard.npcs} affinities={state.npcAffinities} />
<InventoryPanel open={showInv} onClose={() => setShowInv(false)} inventory={state.playerState.inventory} />
<FlagPanel open={showFlag} onClose={() => setShowFlag(false)} flags={state.playerState.flags} />
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

---

### Task 8: 端到端验证 + 测试补充

- [ ] **Step 1: 全量测试**

```bash
npx vitest run
npx next build
```

- [ ] **Step 2: 补充测试**

新条件判断逻辑（checkOption）的单元测试。

- [ ] **Step 3: 提交**

# 进度门控系统 — 设计文档

> 日期: 2026-06-15 | 状态: 已确认

## 概述

为世界引擎添加完整的剧情进度门控系统：属性 + NPC好感 + 物品 + 世界旗标 共同决定可用的剧情分支。NPC 好感由 AI 根据玩家选择驱动，数值累积；物品和旗标由 AI 管理。

## 数据模型

### 世界卡扩展

```typescript
interface WorldCard {
  // ... 现有字段 ...
  npcs: NPCDef[]          // 关键 NPC
  flags: string[]         // 可用的世界标记
  startingItems: string[] // 初始物品
}

interface NPCDef {
  id: string              // "blacksmith"
  name: string            // "铁匠老王"
  description: string     // 背景描述
  initialAffinity: number // 初始好感 (0-100)
}
```

### 游戏状态扩展

```typescript
// PlayerState 新增
inventory: string[]                              // ["rusty_key", "铜币x3"]
// GameState 新增
npcAffinities: Record<string, number>            // {"blacksmith": 45}
```

### 选项条件（四种 AND 关系）

```typescript
interface GameOption {
  text: string
  attributeChecks?: Record<string, string>   // {courage: ">= 7"}
  npcAffinityChecks?: Record<string, string> // {blacksmith: ">= 40"}
  flagChecks?: string[]                      // ["found_allies"]
  flagNot?: string[]                         // ["betrayed_king"]
  itemChecks?: string[]                      // ["rusty_key"]
  itemNot?: string[]                         // ["poison_vial"]
}
```

### AI 响应扩展

```typescript
interface AIResponse {
  narration: string
  options: GameOption[]
  attributeChanges: Record<string, number>
  npcAffinityChanges: Record<string, number>
  newFlags: string[]
  lostFlags: string[]
  itemsGained: string[]
  itemsLost: string[]
}
```

## 系统提示词改造

注入 NPC 关系、物品栏、已解锁旗标到系统提示词，AI 能"看到"完整玩家状态。

新增规则：
- NPC 好感度受行为影响
- 高好感 NPC 提供帮助和信息
- 低好感 NPC 可能成为障碍
- 物品合理消耗和获得
- 旗标代表不可逆变化，持久生效

## UI 设计

右侧边栏底部三个图标按钮：👤 NPC 关系 / 🎒 物品栏 / 🏳️ 旗标

每个按钮点击弹出独立浮层弹窗，只读展示：
- NPC 面板：名称 + 好感进度条 (0-100)
- 物品栏：物品列表
- 旗标面板：已解锁旗标列表

弹窗半透明遮罩，点背景或关闭按钮关闭。

属性栏保持展开在侧边栏中。

## 排除

- 玩家手动修改数值
- NPC 记忆系统（本次不涉及跨会话 NPC 记忆）

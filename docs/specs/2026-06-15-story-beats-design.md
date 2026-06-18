# 故事节拍系统 — 设计文档

> 日期: 2026-06-15 | 状态: 已确认

## 概述

借鉴 Failbetter Games（Fallen London）的 storylet 系统和 inkle Studios 的 Ink 语言，为世界引擎添加结构化叙事控制。在世界卡中定义故事节拍链，每个节拍有前置条件和效果，AI 在节拍框架内自由发挥。

## 数据模型

```typescript
interface StoryBeat {
  id: string
  name: string
  description: string  // AI 用它判断"玩家是否完成了这个节拍"
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
  unlocks: string[]  // 完成后解锁的节拍 ID
}
```

WorldCard 新增：`storyBeats: StoryBeat[]`

## 系统提示词改造

在 prompt 末尾注入故事进度：

```
## 故事进度
✅ 已完成: find_crystal_clue
🔓 可解锁: confront_noble, investigate_mines
🔒 未解锁: discover_truth

## 职责
- 判断玩家是否完成已解锁的节拍（参考 description）
- 完成时在 newFlags 中添加节拍 ID
- 同时应用该节拍的 effects
- 不要提前引入未解锁节拍的内容
```

## 蒸汽苍穹示例节拍链

intro → find_clue → (confront_noble + investigate_mines) → discover_truth

## 范围

MVP：类型 + prompt 注入 + 预设卡节拍数据
排除：节拍编辑器、可视化节拍图

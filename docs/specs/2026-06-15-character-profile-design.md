# 角色档案系统 — 设计文档

> 日期: 2026-06-15 | 状态: 待确认

## 概述

将 NPC 从简单的 4 字段（id/name/description/initialAffinity）扩展为 14 字段的角色档案。系统预设 14 个固定字段，玩家可自由添加自定义字段。配套设计好感度概率算法。

---

## 一、类型定义

### NPCFieldMeta — 字段元数据

```ts
interface NPCFieldMeta {
  key: string              // 内部标识，如 "clothing"
  label: string            // 显示名，如 "当前衣着"
  desc: string             // 描述/提示
  type: 'string' | 'string[]' | 'boolean' | 'number'
  fixed: boolean           // true = 系统预设，不可删除
  runtimeRequired: boolean // true = 运行时必须有值（注入 AI prompt）
  nullable: boolean        // true = 允许为空
}
```

玩家自定义字段不含 `fixed/runtimeRequired/nullable`，结构简化为：

```ts
interface CustomFieldMeta {
  type: 'string' | 'string[]' | 'boolean' | 'number'
  key: string
  label: string
  desc: string
}
```

### NPCDef — 角色定义

```ts
interface NPCDef {
  id: string                    // 唯一标识
  isMainCharacter: boolean      // 系统管理，UI 自动设置
  fields: Record<string, any>   // 按 key 存值
}
```

### WorldCard 变化

`npcs` 类型从 `NPCDef[]` 不变，但 NPCDef 结构完全替换。旧的 `description` 和 `initialAffinity` 移入 `fields`。

---

## 二、12 个静态预设字段 + 2 个运行时字段

### 静态字段（NPCDef.fields）

| # | key | label | type | fixed | nullable | 说明 |
|---|-----|-------|------|-------|----------|------|
| 1 | id | 标识符 | string | true | false | 唯一标识 |
| 2 | name | 角色名 | string | true | false | 显示名称 |
| 3 | isMainCharacter | 是主角 | boolean | true | false | 系统字段，不在卡面展示 |
| 4 | gender | 性别 | string | true | true | 如：女/男/未知 |
| 5 | origin | 来历 | string | true | true | 一句话说明出身 |
| 6 | birthday | 生日 | string | true | true | 纯时间值，符合世界历法 |
| 7 | dialogueTone | 对话基调 | string | true | false | 说话风格 + 性格底色 |
| 8 | dialogueExamples | 说话示例 | string | true | true | few-shot 示例；in_person≥6/sms≥4 |
| 9 | personalityTags | 性格标签 | string[] | true | true | 如：["强势","沉稳","温和"] |
| 10 | appearance | 外貌特征 | string | true | true | 如：黑长直/金发碧眼 |
| 11 | currentAttire | 当前衣着 | string | true | true | 当前具体衣着 |
| 12 | initialAffinity | 初始好感度 | number | true | true | 范围 -100~100，默认 0 |

### 运行时字段（RuntimeNPCState）

`currentSelfPerception` 和 `currentState` 从静态定义中剥离，放入独立的运行时对象。AI 在游戏中动态更新这些值，存档时与静态定义分开序列化。

```ts
interface RuntimeNPCState {
  currentSelfPerception: string  // 此刻自我认知
  currentState: string           // 此刻状态：身体/情绪/在场位置/正在做什么
}

// GameState 中：
npcRuntime: Record<string, RuntimeNPCState>  // key = npc.id
```

**理由：** `currentSelfPerception` 和 `currentState` 是随剧情推进持续变化的运行时数据。与静态档案混存会导致：① 角色定义被动态值污染 ② 存档时需额外分离 ③ 同一 NPC 的多个实例会撑爆序列化。分离后静态定义只读，运行时状态独立管理。

`personalityTags` 的 type 是 `string[]`（数组），其余均为 `string`/`number`/`boolean`。

---

## 三、创作台 UI

### 标签栏改动

```
世界观 | 属性 | 👤角色 | 物品&旗标 | 节拍链 | 预览
```

"角色"标签不再叫"NPC"，内容不再包含物品/旗标（它们已在"物品&旗标"标签中）。

### 子标签

进入"角色"标签后：

```
         [主角]  [配角]
```

- **主角**：一个角色，`isMainCharacter = true`，至多 1 个
- **配角**：NPC 列表，`isMainCharacter = false`

### 编辑区

纵向表单布局。14 个预设字段按 `fixed` 分区展示。`fixed: true` 的字段附带系统标记，不可删除。底部" + 添加自定义字段"按钮，弹出 `{ type, key, label, desc }` 输入表单。

---

## 四、预设剧本 NPC 迁移

### 蒸汽苍穹（4 个角色）

> **运行时字段** (`npcRuntime['player']`): `currentSelfPerception = '刚遭遇坠机事故的幸存者，困惑但对自己追查水晶线索的使命有模糊直觉'`, `currentState = '身体有几处擦伤和头痛，在残骸中苏醒，窗外是下坠的城市碎片'`。这些由 AI 在游戏中动态更新，不储存在 NPCDef.fields 中。

**主角** — 铁鹰城机械师学徒

| 字段 | 值 |
|------|-----|
| id | player |
| name | (玩家输入) |
| isMainCharacter | true |
| gender | 未知 |
| origin | 铁鹰城年轻机械师学徒，在飞艇坠毁中失去了记忆 |
| birthday | 未知 |
| currentSelfPerception | 刚遭遇坠机事故的幸存者，困惑但对自己追查水晶线索的使命有模糊直觉 |
| currentState | 身体有几处擦伤和头痛，在残骸中苏醒，窗外是下坠的城市碎片 |
| dialogueTone | 年轻、好奇、坚韧；面对危险时偶尔自嘲；对机械术语自然流露 |
| dialogueExamples | "这家伙还能修——给我五分钟。"（*蹲下检查齿轮组*） |
| personalityTags | ["坚韧","好奇","务实"] |
| appearance | 深棕色短发，浅褐肤色，手上常年有机油印 |
| currentAttire | 残破的深蓝色机械师工装，左肩有铁鹰城学徒徽章 |
| initialAffinity | 0 |

**配角 ×3**

| 字段 | 老机械师陈 | 卫队长赵 | 天空贵族洛 |
|------|-----------|---------|-----------|
| id | old_mechanic | guard_captain | sky_noble |
| name | 老机械师陈 | 卫队长赵 | 天空贵族洛 |
| isMainCharacter | false | false | false |
| gender | 男 | 男 | 女 |
| origin | 铁鹰城退休首席机械师 | 铁鹰城卫队长，平民靠军功晋升 | 天空贵族世家小姐 |
| birthday | 未知 | 未知 | 未知 |
| dialogueTone | 古怪、爱唠叨、偶尔蹦出真知灼见 | 严肃、简练、偶尔流露无奈 | 活泼、好奇、有时任性 |
| dialogueExamples | (待补充) | (待补充) | (待补充) |
| personalityTags | ["古怪","睿智"] | ["正直","压抑"] | ["活泼","叛逆"] |
| appearance | 满头白发，铜框护目镜，手上全是机油 | 中年，体格魁梧，眼角有刀疤 | 长发及腰，虽着脏裙装仍可见贵族气质 |
| currentAttire | 旧皮围裙+满是口袋的工作背心 | 铁灰色卫队制服+披风 | 蓝色丝绒长裙，裙角沾了机油污渍 |
| initialAffinity | 20 | 0 | 10 |

### 玉京风华（4 个角色）

**主角** — 京城落魄书生

| 字段 | 值 |
|------|-----|
| id | player |
| name | (玩家输入) |
| isMainCharacter | true |
| gender | 未知 |
| origin | 京城落魄书生，偶然发现记载灵兽行踪的古卷 |
| birthday | 未知 |
| dialogueTone | 文雅、谦逊、内心坚定；引用古籍时自然流露 |
| dialogueExamples | "书中所言，或许并非妄谈。小生愿去寻一寻——阁下可愿同行？" |
| personalityTags | ["文雅","执着"] |
| appearance | 眉目清秀，袖口磨破但干净整洁 |
| currentAttire | 青色长衫，头戴方巾 |
| initialAffinity | 0 |

**配角 ×3**

| 字段 | 茶馆说书人柳 | 灵兽守护者青 | 朝廷密使白 |
|------|------------|------------|----------|
| id | tea_master | spirit_guardian | court_official |
| name | 茶馆说书人柳 | 灵兽守护者青 | 朝廷密使白 |
| isMainCharacter | false | false | false |
| gender | 男 | 女 | 男 |
| origin | 京城茶馆说书先生，消息灵通 | 隐居山林的灵兽守护者末裔 | 奉旨追查龙脉异象的密使 |
| birthday | 未知 | 未知 | 未知 |
| dialogueTone | 圆滑、爱卖关子、暗藏锋芒 | 沉默寡言、字字珠玑 | 冷漠、克制、偶尔流露愤怒 |
| dialogueExamples | (待补充) | (待补充) | (待补充) |
| personalityTags | ["圆滑","神秘"] | ["沉默","敏锐"] | ["冷漠","正直"] |
| appearance | 中年，山羊胡，眼睛精明 | 年轻女子，长发及腰，眼神如鹰 | 面容冷峻，举止利落 |
| currentAttire | 灰布长衫，手持折扇 | 素色麻衣，披兽皮斗篷 | 黑色官服，低调但用料考究 |
| initialAffinity | 30 | 5 | -10 |

---

## 五、好感度系统

### 5.1 核心公式

```
服从概率 = 基础概率(好感映射) × 性格系数 × 请求系数 × 情境系数
最终概率 = Clamp(服从概率, 0.02, 0.98)
```

**保底规则（高好感补到门槛，不放大）：** 当好感 ≥ 80，请求系数和情境系数中低于 1.0 的取 1.0，高于 1.0 的保持不变。即 `Min(原值, 1.0) → 1.0`。

### 5.2 好感映射表

| 好感区间 | 基础概率 | 情感表达 | 信息透露 |
|---------|---------|---------|---------|
| -100 ~ -51 | 0.05 | 敌意、威胁 | 故意误导或沉默 |
| -50 ~ -1 | 0.20 | 冷淡、不耐烦 | 公共信息 |
| 0 ~ 19 | 0.40 | 礼貌、陌生 | 半公开信息 |
| 20 ~ 39 | 0.55 | 友好 | 个人背景 |
| 40 ~ 59 | 0.70 | 信任、倾诉 | 秘密 |
| 60 ~ 79 | 0.85 | 亲近、袒护 | 深层秘密 |
| 80 ~ 100 | 0.95 | 无条件支持 | 绝密 |

### 5.3 性格系数（四档，每个 NPC 挂一个）

| 性格标签 | 系数 |
|---------|------|
| 顺从/温和/忠诚 | 1.3 |
| 正直/勇敢 | 1.0 |
| 谨慎/多疑 | 0.85 |
| 叛逆/傲慢 | 0.6 |

### 5.4 请求系数

| 级别 | 系数 | 示例 |
|-----|------|------|
| 琐碎 | 1.2 | "帮我看一下这个" |
| 普通 | 1.0 | "告诉我一些信息" |
| 重要 | 0.8 | "把武器借我" |
| 重大 | 0.5 | "对抗你的上级" |
| 极端 | 0.2 | "为我去死" |

### 5.5 情境系数

| 情境 | 系数 |
|-----|------|
| 私下 | 1.0 |
| 公开场合 | 0.7 |
| 目标一致 | 1.3 |
| 主角刚救过NPC | 1.5（一次性） |
| NPC被胁迫 | 0.5 |
| NPC生命受威胁 | 0.3 |

### 5.6 AI Prompt 角色档案注入模板

14 字段转化为有效指令时，必须遵循以下约束：

```
[NPC角色档案 — 作为风格参考，不要原样复述]

👤 [name]  |  性别: [gender]  |  来历: [origin]  |  性格: [dialogueTone]
标签: [personalityTags]  |  外貌: [appearance]  |  衣着: [currentAttire]
此刻自我认知: [currentSelfPerception]
此刻状态: [currentState]

**说话风格指南（参考以下例句的口吻和节奏，但绝不照搬原句）：**
[dialogueExamples]

**约束：**
- 以上例句仅用于理解该角色的说话方式、用词习惯和语气节奏
- 生成该角色的对白时，根据当前上下文重新组织语言，严禁直接输出例句中的任何原文
- 当前场景的上下文优先于参考例句中的历史情景
- 称呼规则：好感≥40 直呼其名，好感≥60 用专属昵称，好感≥80 私下用昵称/正式场合用敬称
```

**注入原则：**
1. few-shot 为风格参考，非台词库。AI 必须基于当前上下文重新生成
2. 当前上下文 > 历史情境。参考例句中的情境信息不能覆盖当前场景
3. 运行时字段（currentSelfPerception/currentState）随对话推进更新，prompt 中始终注入最新值

### 5.8 好感变化规则

| 来源 | 幅度 |
|-----|------|
| 对话选择 | ±5~15 |
| 完成心愿 | +20~30 |
| 出卖/背叛 | -20~30 |
| 救命 | +20~30 |
| 无视警告 | -10~20 |

**冷却机制：** 关键事件（≥20点变化）触发后，该NPC进入游戏内3天冷却期，同类事件效果减半。

### 5.9 文本分层（核心跑通后迭代）

- 拒绝态度模板：4套，按性格分流
- 称呼渐变：好感≥40 直呼其名，≥60 专属昵称，≥80 正式/私下双模式
- 战斗开场白：按好感区间变化

### 5.10 深度系统（搁置）

- 好感交叉影响（阵营对立 NPC 之间互相影响）
- 信任崩塌（好感暴跌触发永久后果）
- NPC心理阈值（高好感触发隐藏行为）

---

## 六、实施优先级

**本次实施：**
- 类型定义（NPCFieldMeta + NPCDef + RuntimeNPCState + customFields）
- 预设字段元数据（12 静态 + 2 运行时）
- 创作台 UI（角色标签 + 主角/配角 + 纵向表单 + 添加自定义字段）
- 预设剧本 NPC 迁移（静态字段不含 currentSelfPerception/currentState）
- 好感度核心公式 + 修正保底规则 + 变化规则
- 初始好感度配置（NPCDef 字段 + 节拍链效果）
- AI prompt 角色档案注入模板（含 few-shot 约束）

**核心跑通后：**
- 拒绝模板 + 称呼渐变 + 战斗开场白

**搁置：**
- 深度系统（交叉影响 / 信任崩塌 / NPC心理阈值）

---

## 七、涉及文件

| 文件 | 改动 |
|------|------|
| `src/lib/types.ts` | NPCFieldMeta / NPCDef / RuntimeNPCState / customFields 重定义 |
| `src/lib/affinity.ts` | 好感度概率算法（新建） |
| `src/components/WorldCreator.tsx` | 角色标签 + 主角/配角子标签 + 纵向表单 + 自定义字段 |
| `src/data/world-cards.ts` | 8 个角色迁移到新格式（静态字段） |
| `src/app/api/adventure/route.ts` | AI prompt 注入模板（含 few-shot 约束） |
| `src/components/NPCPanel.tsx` | 数据源改用新 NPCDef |
| `src/lib/game-context.tsx` | GameState 加 npcRuntime + npcAffinities 初始化适配 |
| `docs/superpowers/specs/2026-06-15-character-profile-design.md` | 本文档 |

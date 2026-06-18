---
name: npc-affinity-system
description: 好感度等级体系（7级）、条件解析（6种运算符）、概率模型（性格系数9标签/请求等级5级/情境系数6种/仁慈模式）、冷却期规则、综合公式。覆盖 src/lib/affinity.ts 和 src/lib/favorability.ts
---

# NPC 好感度系统

## 等级体系

好感度值始终钳制在 `[-100, 100]` 闭区间内，划分为 7 个等级：

| 等级 Key      | 范围            | 中文标签 | 阈值下限 |
|---------------|----------------|----------|----------|
| `hatred`      | -100 ~ -80     | 仇恨     | -100     |
| `dislike`     | -79  ~ -41     | 厌恶     | -79      |
| `cold`        | -40  ~ -1      | 冷淡     | -40      |
| `neutral`     | 0              | 中立     | 0        |
| `friendly`    | 1    ~ 20      | 友善     | 1        |
| `warm`        | 21   ~ 60      | 友好     | 21       |
| `intimate`    | 61   ~ 100     | 亲密     | 61       |

- `getAffinityTier(affinity: number): AffinityTier` — 从高到低遍历阈值数组，返回第一个匹配的等级。`neutral` 仅当值为精确 0 时命中。
- `getAffinityLabel(affinity: number): string` — 返回当前值对应的中文标签。

## 条件解析

### parseAffinityCondition

将形式如 `">= 40"` 的条件字符串解析为 `{ operator, value }`。

支持的 6 种运算符：

| 运算符 | 含义   |
|--------|--------|
| `>=`   | 大于等于 |
| `<=`   | 小于等于 |
| `>`    | 大于   |
| `<`    | 小于   |
| `==`   | 等于   |
| `!=`   | 不等于  |

格式要求：`/(!=|>=|<=|>|<|==)\s*(-?\d+(?:\.\d+)?)/`。不匹配时抛出 `Error`。

### checkAffinityCondition

检查单个好感度值是否满足传入的条件字符串。内部调用 `parseAffinityCondition` 后根据 operator 分支判断。

### checkAllAffinityConditions

批量 AND 检查：接受 `affinities: Record<string, number>` 和 `checks: Record<string, string>`，遍历每个 `npcId → condition` 条目，任一 NPC 不在 affinities 中或条件不满足则返回 `false`，全部通过返回 `true`。

## 钳制与批量更新

- `clampAffinity(value: number): number` — 将值钳制在 `[-100, 100]`。
- `applyAffinityChanges(base, changes): Record<string, number>` — 传入当前好感度表和一个增量表，对 `base` 中已存在的 key 累加增量并 clamp，忽略 `changes` 中不在 `base` 里的 NPC（即不会自动注册新 NPC）。

## 概率模型

### 好感度 → 基础概率

`mapAffinityToBaseProbability(affinity: number): number`

| 好感度区间 | 基础概率 |
|-----------|---------|
| >= 80     | 0.95    |
| >= 60     | 0.85    |
| >= 40     | 0.70    |
| >= 20     | 0.55    |
| >= 0      | 0.40    |
| >= -50    | 0.20    |
| < -50     | 0.05    |

输入先自动 clamp 到 [-100, 100]。

### 性格系数（9 标签）

`PERSONALITY_COEFFICIENTS` 中定义了 9 个性格标签及其系数：

| 标签   | 系数  | 倾向     |
|--------|-------|----------|
| 顺从   | 1.3   | 高依从   |
| 温和   | 1.3   | 高依从   |
| 忠诚   | 1.3   | 高依从   |
| 正直   | 1.0   | 中性     |
| 勇敢   | 1.0   | 中性     |
| 谨慎   | 0.85  | 低依从   |
| 多疑   | 0.85  | 低依从   |
| 叛逆   | 0.6   | 极低依从 |
| 傲慢   | 0.6   | 极低依从 |

`personalityComplianceCoefficient(tags: string[]): number` — 取所有标签系数中的最小值（最不配合的性格起决定作用）。空数组返回 1.0。

### 请求等级（5 级）

| 等级       | 系数  | 说明                     |
|-----------|-------|--------------------------|
| trivial   | 1.2   | 琐碎请求（提高概率）       |
| normal    | 1.0   | 一般请求                 |
| important | 0.8   | 重要请求                 |
| major     | 0.5   | 重大请求                 |
| extreme   | 0.2   | 极端请求（大幅降低概率）   |

### 情境系数（6 种）

| 类型             | 系数  | 说明                     |
|------------------|-------|--------------------------|
| private          | 1.0   | 私密场合（基准）          |
| public           | 0.7   | 公开场合                 |
| aligned          | 1.3   | 目标一致                 |
| saved            | 1.5   | 救命之恩（最高加成）      |
| coerced          | 0.5   | 被胁迫                   |
| lifeThreatened   | 0.3   | 生命受威胁（最低）        |

### 仁慈模式

当好感度 >= 80 时，request 和 situation 系数会被兜底：如果系数原本低于 1.0，则提升至 1.0。即高好感度 NPC 不会因为请求难度大或情境不利而降低配合意愿。

## 综合公式

`computeComplianceProbability(input: ComplianceInput): number`

```
raw = baseProbability * personalityCoeff * requestCoeff * situationCoeff
final = clamp(raw, 0.02, 0.98)
```

- `baseProbability` 来自 `mapAffinityToBaseProbability`
- `personalityCoeff` 来自 `personalityComplianceCoefficient`
- `requestCoeff` 和 `situationCoeff` 来自各自字典，好感度 >= 80 时触发仁慈模式
- 最终概率钳制在 `[0.02, 0.98]`，确保永远有小概率失败和极低概率成功

## 冷却期

`applyCooldown(change, lastMajorEventDay, currentDay): number`

规则：
1. 存在上次重大事件发生日（`lastMajorEventDay !== null`）
2. 该次变化绝对值 >= 20
3. 距离上次事件不超过 3 天（`currentDay - lastMajorEventDay <= 3`）

同时满足以上条件时，变化值减半（`Math.round(change / 2)`），否则原值返回。

## 变化量计算

`computeAffinityChange(event: AffinityChangeEvent): number`

| 事件类型          | 方向   | 说明                 |
|-------------------|--------|----------------------|
| `dialogue`       | 正变化 | 对话中的好感提升     |
| `wishFulfilled`  | 正变化 | 愿望实现             |
| `betrayal`       | 负变化 | 背叛行为             |
| `saved`          | 正变化 | 救命                 |
| `warningIgnored` | 负变化 | 忽视警告             |

变化值由调用方通过 `magnitude` 传入，本函数仅决定正负号。未知事件类型返回 0。

## 关键设计决策

1. **最小值策略（性格系数）**：多性格标签取最小值而非均值，确保负面性格的权重不会被正面性格稀释，使 NPC 的核心性格更突出。
2. **仁慈模式**：好感度 >= 80 时锁定 request/situation 系数不低于 1.0，避免高好感 NPC 因"请求难度大"而拒绝——这是游戏叙事逻辑的体现：亲密伙伴不会因为请求重要而拒绝帮忙。
3. **冷却期**：防止短时间内好感度剧烈波动，让玩家不能通过反复触发同一事件刷分。
4. **概率下/上限 [0.02, 0.98]**：保留极端情境下的小概率失败/成功可能，增加叙事张力。
5. **applyAffinityChanges 不自动注册**：批量更新只修改已有 NPC，要求 NPC 必须先通过世界卡系统注册到状态中，避免幽灵 NPC 数据。

## 相关文档

- → world-card-system.md：NPC 定义中的 `initialAffinity` 和 `personalityTags` 来源
- → game-options-conditions.md：`npcAffinityChecks` 条件评估依赖本系统的条件解析
- → state-management.md：`npcAffinities` 存储在 PlayerStateContext

## 边界

本文件覆盖 NPC 好感度的完整算法体系：等级判定、条件解析、概率计算、变化量计算。
不覆盖：NPC 数据定义（见 world-card-system.md）、选项的条件检查 UI（见 game-options-conditions.md）、状态存储的 reducer 逻辑（见 state-management.md）。

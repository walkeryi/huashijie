---
name: game-options-conditions
description: GameOption 类型（6种条件字段）、OptionsPanel 的 evalCondition/checkOption（六种运算符+AND逻辑）、不可用选项的灰色+删除线渲染、800ms 延迟淡入动画、自由文本输入（200字符限制）、StoryBeat.preconditions 共用同一条件评估体系
---

# 游戏选项与条件系统

## 边界

本文件覆盖游戏选项的类型定义、条件评估、UI 渲染和用户交互流程。

不覆盖：好感度条件的具体算法（见 npc-affinity-system.md）、SSE 流解析和打字机（见 event-bus-typewriter.md）、AI 如何生成选项（见 ai-engine.md）。

## GameOption 类型定义

```
src/lib/types.ts
```

`GameOption` 是 AI 通过 `update_state` 工具输出的选项类型，核心字段为 `text` 加上六种可选条件字段：

```typescript
export interface GameOption {
  text: string
  attributeChecks?: Record<string, string>   // {courage: ">= 3"}
  npcAffinityChecks?: Record<string, string>  // {blacksmith: ">= 40"}
  flagChecks?: string[]                       // ["found_allies"]
  flagNot?: string[]                          // ["betrayed_king"]
  itemChecks?: string[]                       // ["rusty_key"]
  itemNot?: string[]                          // ["poison_vial"]
}
```

### 六种条件字段

| 字段 | 类型 | 语义 | 示例 |
|------|------|------|------|
| `attributeChecks` | `Record<string, string>` | 玩家属性需满足某个比较条件 | `{courage: ">= 3"}` |
| `npcAffinityChecks` | `Record<string, string>` | NPC 好感度需满足某个比较条件 | `{blacksmith: ">= 40"}` |
| `flagChecks` | `string[]` | 所有旗标必须为 `true` | `["found_allies"]` |
| `flagNot` | `string[]` | 所有旗标必须为 `false` | `["betrayed_king"]` |
| `itemChecks` | `string[]` | 所有物品必须在背包中 | `["rusty_key"]` |
| `itemNot` | `string[]` | 所有物品不能在背包中 | `["poison_vial"]` |

所有条件字段均为 optional。空字段或不存在的字段等价于"无条件"（直接通过）。

### 比较运算符

`attributeChecks` 和 `npcAffinityChecks` 的值使用比较运算符字符串：

| 运算符 | 语义 |
|--------|------|
| `>=` | 大于等于 |
| `>` | 大于 |
| `<=` | 小于等于 |
| `<` | 小于 |
| `==` | 等于 |
| `!=` | 不等于 |

格式要求：运算符后跟空格（可选），然后是整数。如 `">= 3"`、`"== 0"`、`"!= -5"`。如果字符串不匹配该格式，`evalCondition` 返回 `true`（宽松通过）。

## 条件评估引擎

```
src/components/OptionsPanel.tsx — evalCondition, checkOption
```

### evalCondition（单值条件判断）

```typescript
function evalCondition(val: number, condition: string): boolean
```

接收当前值和一个比较条件字符串，解析运算符和目标值并返回比较结果。使用正则 `/^([><=!]+)\s*(-?\d+)$/` 解析。解析失败（正则不匹配）时返回 `true`，提供容错。

### checkOption（选项完整条件检查）

```typescript
function checkOption(option: GameOption, state: GameState): boolean
```

接收一个选项和当前 `GameState`，按顺序执行六步检查。使用 **AND 逻辑**（所有条件必须通过）：

1. **attributeChecks** — 遍历 `option.attributeChecks` 的每个 `[key, condition]`，从 `state.playerState.attributes` 中取值（缺失则为 0），调用 `evalCondition`。任一不通过则返回 `false`。
2. **npcAffinityChecks** — 遍历 `option.npcAffinityChecks` 的每个 `[key, condition]`，从 `state.npcAffinities` 中取值（缺失则为 0），调用 `evalCondition`。任一不通过则返回 `false`。
3. **flagChecks** — 遍历 `option.flagChecks` 的所有旗标值，检查 `state.playerState.flags` 中对应键是否为 `true`。任一为 `false` 或缺失则返回 `false`。
4. **flagNot** — 遍历 `option.flagNot` 的所有旗标值，检查 `state.playerState.flags` 中对应键是否不为 `true`。任一为 `true` 则返回 `false`。
5. **itemChecks** — 遍历 `option.itemChecks` 的所有物品，检查 `state.playerState.inventory` 中是否包含每个物品。任一缺失则返回 `false`。
6. **itemNot** — 遍历 `option.itemNot` 的所有物品，检查 `state.playerState.inventory` 中是否不包含每个物品。任一项存在则返回 `false`。

全部通过返回 `true`。

### NPC 好感度条件的深层次委托

`npcAffinityChecks` 在 `checkOption` 中使用的是和属性检查相同的 `evalCondition` 语法和逻辑。`favorability.ts` 中的 `checkAllAffinityConditions` 函数提供了等效的能力，包含额外的校验：**如果检查的 NPC 不在 `affinities` 字典中则视为不通过**。两套逻辑对齐，区别仅在于 `checkAllAffinityConditions` 更严格地要求 NPC 必须已注册。

## checkOption 在 UI 层的完整流程

```
OptionsPanel → checkOption → 布尔结果 → 样式分支
```

每轮新选项到达后，`OptionsPanel` 对 `currentOptions` 中的每个 `GameOption` 调用 `checkOption(option, state)`：

- **条件满足时**：可点击按钮，样式为 `border-[var(--accent)]` + `bg-[var(--bg-card)]`，hover 变 `bg-[var(--bg-secondary)]`。
- **条件不满足时**：禁止点击（`cursor-not-allowed`），文字加删除线（`line-through`），颜色变为 `text-[var(--text-secondary)]`，背景半透明（`bg-[var(--bg-card)]/50`）。

用户点击满足条件的选项时，调用 `onSubmit(option.text)` 并清空自由输入框。不满足条件的选项点击无反应。

## 选项来源与时机

```
GameScreen.submitAction → SSE 流处理 → UPDATE_STATE → currentOptions → OptionsPanel
```

完整链路：

1. 用户在 `OptionsPanel` 点击一个选项 → `GameScreen.submitAction` 被调用
2. `submitAction` 发送 `POST /api/adventure` 请求
3. AI SDK v6 的 `streamText()` 返回 SSE 流，由本地 `readDataStream` 解析
4. SSE 流中出现 `tool-input-available` 事件（toolName 为 `update_state`）时：
   ```typescript
   actions.updateState(part.input as Record<string, unknown>)
   ```
5. `UPDATE_STATE` reducer 将 `input.options` 写入 `GameState.currentOptions`
6. 降级兜底：如果 SSE 流结束时未发生 tool call，自动注入三个默认选项（继续前进 / 仔细观察周围 / 与附近的人交谈）
7. `OptionsPanel` 订阅 `state.currentOptions`，检测到新选项数组后触发延迟淡入

### UPDATE_STATE 的可选字段守卫

AI 的 `update_state` 调用只保证 `options` 为必填，其余字段（`attributeChanges`、`npcAffinityChanges`、`itemsGained`、`itemsLost`、`newFlags`、`lostFlags`）均为可选。reducer 中每个更新操作都有 `if` 守卫，防止 `Object.entries(undefined)` 崩溃。详见 state-management.md。

## 800ms 延迟淡入

```
OptionsPanel useEffect
```

打字机逐字输出期间选项不应出现，因此使用 800ms 延迟：

```typescript
const [visible, setVisible] = useState(false)
const prevOptionsRef = useRef(currentOptions)

useEffect(() => {
  if (currentOptions.length > 0 && currentOptions !== prevOptionsRef.current) {
    prevOptionsRef.current = currentOptions
    setVisible(false)
    const timer = setTimeout(() => { setVisible(true) }, 800)
    return () => clearTimeout(timer)
  }
}, [currentOptions])
```

关键细节：
- `prevOptionsRef` 使用 `useRef` 而非 state，避免额外重渲染
- 引用比较 `currentOptions !== prevOptionsRef.current` 检测**新数组实例**（每次 UPDATE_STATE 都是新创建的数组）
- `setVisible(false)` 先隐藏旧选项 → 800ms 后淡入新选项
- 超出 800ms 后：`visible && currentOptions.length > 0` 控制显示，CSS 类 `animate-fadeIn` 提供入场动画
- **加载中隐藏**：`isLoading` 为 `true` 时整个 `OptionsPanel` 返回 `null`

## 自由文本输入

选项面板底部始终显示自由输入区域（即使在选项不可见时）：

- `<input>` 控件，`maxLength={200}`，支持多行 UTF-8 文本
- 占位符："或者输入你想做的事..."
- 选项出现时（`visible` 变为 `true`）自动聚焦：`freeInputRef.current.focus()`
- 提交方式：
  - 点击"行动"按钮（`disabled` 条件：输入为空或全空白）
  - 按 Enter 键
- 提交后清空输入框

## StoryBeat.preconditions 共用条件体系

```
src/lib/types.ts — StoryBeat.preconditions
```

世界卡中的 `StoryBeat` 也支持条件检查，使用与 `GameOption` **相同的六种条件语义，但字段组织为嵌套对象**：

```typescript
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
  // ...
}
```

StoryBeat 的条件字段与 GameOption 的差异：
- `preconditions` 是一个嵌套对象，而 `GameOption` 的条件是顶层字段
- StoryBeat **不支持** `flagNot` 和 `itemNot`（仅支持正向条件）
- 条件评估逻辑与 `checkOption` 一致：所有条件 AND 逻辑

这意味着条件评估引擎可以复用于判断故事节拍是否应解锁，但当前代码中 `checkOption` 是为 UI 层的 `GameOption` 设计的，`StoryBeat.preconditions` 的检查在游戏逻辑层独立实现。

## 关键设计决策

### 1. 条件字符串而非结构化字段

`attributeChecks` 和 `npcAffinityChecks` 的值使用字符串（如 `">= 3"`）而非 `{ operator, value }` 对象。原因：AI 生成 JSON 时拼接字符串比构造嵌套对象更容易，减少 tool call 格式错误。

### 2. 解析失败返回 true（容错优先）

`evalCondition` 在正则匹配失败时返回 `true` 而非抛出异常。这是有意的容错设计：宁可让条件宽松通过，也不因 AI 生成格式错误而锁定玩家。

### 3. 800ms 硬编码延迟

延迟值与打字机速度无关，是固定值。打字机完成时间不确定时（取决于旁白长度 × 打字速度），800ms 是一个经验值，假定中等长度旁白在此时间内完成。如果打字机因长文本延迟，选项可能在旁白还在滚动时就出现——这是已知的粗糙之处。

### 4. 降级兜底默认选项

当 AI 没有调用 `update_state` 工具时（模型不支持 tool use 或 API 异常），`GameScreen` 注入三个硬编码选项以保持游戏可进行，而不是显示空白屏幕。

### 5. 不可用选项可见但禁用

所有选项始终渲染到 DOM 中，不满足条件的以视觉上可区分的方式展示（灰色 + 删除线），而非直接隐藏。这给玩家提供了环境约束的可见反馈——可以看到有哪些路径被属性/物品/好感度阻断了。

### 6. freeInput 和 options 复用同一 onSubmit

自由文本输入和选项点击最终调用同一个 `submitAction(optionText)`，AI 端无法区分玩家是点了选项还是自由输入。这种设计使自由输入成为"任意选项"的补充，而非独立模式。

## 相关文档

- npc-affinity-system.md：npcAffinityChecks 的具体评估委托给 checkAllAffinityConditions，包含 NPC 注册校验
- event-bus-typewriter.md：SSE 流结束后 tool-input-available 事件携带 options，事件时序决定选项何时出现
- state-management.md：currentOptions 存储在 PlayerStateContext，通过 UPDATE_STATE reducer 更新
- world-card-system.md：StoryBeat.preconditions 使用同一套六种条件评估体系，但不包含 flagNot/itemNot
- ai-engine.md：AI 如何通过 update_state 工具生成选项，tool schema 定义

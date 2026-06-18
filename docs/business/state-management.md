---
name: state-management
description: 三层 Context 架构（AppConfigContext / PlayerStateContext / GamePlayContext）、拆分原因和消费者关系、PlayerState reducer 的六种 action（APPLY_STATE_CHANGES / SET_OPTIONS / UPDATE_STATE 等）和 optional 字段守卫模式、向后兼容的 useGame() 和 GameProvider、debouncedAutoSave 防抖逻辑、AppConfigContext 的 localStorage 持久化与历史数据迁移
---

# 状态管理

## 三层 Context 架构

单体 GameContext 已拆分为三个独立 Context，按变更频率物理隔离：

| Context | 文件 | 变更频率 | 关键字段 |
|---------|------|---------|---------|
| AppConfigContext | `src/lib/app-config-context.tsx` | 用户手动操作 | apiKey, provider, model, customBaseURL, advancedParams, saveMode, accountName |
| PlayerStateContext | `src/lib/player-state-context.tsx` | 每次 AI 响应后更新一次 | screen, worldCard, playerState, currentOptions, npcAffinities, npcRuntime |
| GamePlayContext | `src/lib/game-play-context.tsx` | 用户交互 + AI 流结束后 | dialogueHistory, isLoading, error |

### 为什么拆分

- **避免无效重渲染**：状态面板（StatusPanel）只订阅 PlayerState，不因 dialogueHistory 追加而重渲染
- **打字机脱离 React**：逐字动画走 RAF + DOM textContent，不触发任何 setState
- **API 配置持久化**：AppConfig 独立管理 localStorage 读写，不受游戏状态生命周期影响

## 向后兼容层

`src/lib/game-context.tsx` 保留作为统一入口：

- `GameProvider` 嵌套三个 Provider：`AppConfigProvider → PlayerStateProvider → GamePlayProvider`
- `useGame()` 合并三个 Context 为旧 `{ state, dispatch, actions }` 形状
- 同时 re-export `useAppConfig`、`usePlayerState`、`useGamePlay` 供渐进迁移

`dispatch` 函数根据 `action.type` 转发到对应 Context 的 setter/reducer。

## AppConfigContext 详解

`src/lib/app-config-context.tsx` 管理 API 配置（provider/model/apiKey 等），与游戏状态生命周期无关。

### 启动恢复流程

`AppConfigProvider` 的 `createInitialAppConfig()` 在第一次渲染时执行：

1. **调用 `migratePollutedApiConfigs()`** — 检测并修复历史污染
2. **调用 `loadLastProvider()`** — 从 `localStorage.getItem('adventure_last_provider')` 恢复上次使用的 provider
3. **调用 `loadApiConfigForProvider(provider)`** — 从 `adventure_api_configs` JSON 中读取对应 provider 的配置

`useEffect` 在挂载后再次从 localStorage 恢复（覆盖 SSR 产生的空值），并打印日志。

### 旧版配置迁移

`loadAllApiConfigs()` 在读取 `adventure_api_configs` 失败时，尝试读取旧版单 key `adventure_api_config`：

```ts
const old = localStorage.getItem('adventure_api_config')
if (old) {
  const parsed = JSON.parse(old)
  // 将旧版配置转换为 per-provider 格式
  configs[provider] = { apiKey, model, customBaseURL, protocol, ... }
  localStorage.setItem('adventure_api_configs', JSON.stringify(configs))
  localStorage.removeItem('adventure_api_config')  // 删除旧 key
}
```

### 历史污染检测与清理

`migratePollutedApiConfigs()` 修复旧版 bug 导致的 apiKey 跨 provider 污染：

1. 遍历所有四个 provider，收集非空 apiKey
2. 如果至少两个 provider 有 key 且所有 key 值相同，判定为污染
3. 仅保留 `lastProvider` 的 apiKey，其他 provider 的 apiKey 置空
4. 写回 localStorage

### setAll 批量更新

`setAll(partial: Partial<AppConfigState>)` 提供一次性更新多个字段的能力，由 dispatch 的 `APPLY_PRESET` action 调用，用于快速切换预设供应商时还原所有字段。

### 按 provider 的独立默认值

`loadApiConfigForProvider` 内置每个 provider 的独立默认值表：

| Provider | 默认模型 | 默认 Protocol |
|----------|---------|-------------|
| anthropic | claude-sonnet-4-6 | anthropic |
| openai | gpt-4o | openai |
| deepseek | deepseek-chat | openai |
| custom | （空） | openai |

每次切换 provider 时，`setProvider` 调用 `loadApiConfigForProvider(newProvider)` 加载该 provider 独立存储的配置，互不干扰。

## GamePlayContext 详解

`src/lib/game-play-context.tsx` 负责用户交互和 AI 流结束后的 UI 状态管理。

### dialogueHistory 追加策略

`archiveDialogue(history: DialogueEntry[])` **全量替换**而非增量追加：

```ts
const archiveDialogue = useCallback((history: DialogueEntry[]) => {
  setState(prev => ({ ...prev, dialogueHistory: history, isLoading: false }))
}, [])
```

调用方（GameScreen）在 SSE 流结束后构造新的完整历史数组，一次性提交。这避免增量追加带来的竞态（多个异步流可能乱序写入）。

### isLoading / error 生命周期

- `setLoading(true)` → 用户提交选项后立即调用，OptionsPanel 显示加载状态
- AI 流正常结束 → `archiveDialogue` 内部将 `isLoading` 置为 `false`
- AI 流异常 → `setError(message)` 将 `isLoading` 置为 `false`，设置错误消息
- `clearError()` → 手动清除错误消息

## PlayerState Reducer 详解

`src/lib/player-state-context.tsx` 包含一个 `useReducer` 实现，支持六种 action：

| Action | 触发时机 | 关键逻辑 |
|--------|---------|---------|
| `START_GAME` | 选择世界、输入姓名后 | 初始化属性值、NPC 好感度 |
| `APPLY_STATE_CHANGES` | Stage 1（Plan）完成后 | 更新属性、好感度、物品、旗标，**不修改** currentOptions |
| `SET_OPTIONS` | Stage 3（Choices）完成后 | 仅设置 currentOptions |
| `UPDATE_STATE` | 向后兼容（旧代码路径） | 同时更新属性+选项，三阶段管线中已不用于主流程 |
| `LOAD_SAVE` | 读档时 | 恢复完整 game state |
| `RETURN_TO_MENU` | 回到主菜单 | 重置为初始状态 |

### 三阶段管线中的使用

三阶段管线分别使用不同的 action，确保 Plan（状态变更）和 Choices（选项生成）的副作用彼此隔离：

1. **Stage 1（Plan）完成后** → `actions.applyStateChanges()` dispatch `APPLY_STATE_CHANGES`，仅更新属性/NPC好感度/物品/旗标，不触碰 currentOptions
2. **Stage 3（Choices）完成后** → `actions.setOptions()` dispatch `SET_OPTIONS`，仅设置 currentOptions
3. **Stage 2（Narrate）** 用本地计算的 `computeUpdatedPlayerState()` 构造更新后的 playerState 传给服务端（避免依赖 React 异步 dispatch 的时序）

### UPDATE_STATE 的 Optional 字段守卫（极重要）

AI 的 `UPDATE_STATE` / `APPLY_STATE_CHANGES` action 只保证核心字段有默认行为，所有可选字段。**reducer 中每个字段都有 `if` 守卫**，防止 `Object.entries(undefined)` 崩溃：

```ts
// ✅ 正确
const newAttrs = action.attributeChanges
  ? clampAttributes(ps.attributes, action.attributeChanges, action.attributeDefs ?? [])
  : ps.attributes

// ❌ 错误（会崩溃）
const newAttrs = clampAttributes(ps.attributes, action.attributeChanges, action.attributeDefs)
```

同样的守卫模式应用于：
- `npcAffinityChanges` → `if (action.npcAffinityChanges) { for ... }`
- `itemsGained` / `itemsLost` → `if (action.itemsGained) { for ... }`
- `newFlags` / `lostFlags` → `if (action.newFlags) { for ... }`

**新增字段时必须也加守卫。**

### clampAttributes

辅助函数，将属性变化 clamp 到 `[0, max]` 范围内。默认 max 值为 10。

## 自动存档

`src/lib/save-service.ts` 的 `debouncedAutoSave()` 使用模块级 2 秒防抖，避免 AI 快速响应时堆积 I/O。在线模式失败时静默回退 localStorage。

## 相关文档
→ save-system.md：存档数据的 LOAD_SAVE dispatch 目标，debouncedAutoSave 的触发时机
→ game-options-conditions.md：currentOptions 的存储和 SET_OPTIONS 更新
→ ai-engine.md：provider/model/apiKey 的存储位置
→ event-bus-typewriter.md：dialogueHistory 与打字机的关系
→ world-card-system.md：START_GAME 的初始化逻辑

## 边界
本文件覆盖三层 Context 的状态管理架构和 PlayerState reducer 逻辑。
不覆盖：存档存取的具体实现（见 save-system.md）、打字机效果的渲染（见 event-bus-typewriter.md）、AI 引擎调用（见 ai-engine.md）。

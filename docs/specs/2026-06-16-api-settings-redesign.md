# API 设置布局重设计

> 重新设计系统设置中的 API 配置界面，引入预设供应商按钮、高级参数配置、协议兼容切换、自定义供应商管理。

## 目标

将 API 设置表单重设计为结构清晰的阶梯式配置界面：预设供应商 → 基础字段 → 高级选项。支持按供应商独立保存 API Key，支持自定义供应商的添加和删除。

## 架构

纯前端 UI 重设计 + 状态扩展。高级参数存入 `GameState` 并通过 `/api/adventure` 转发到 AI SDK。

## UI 结构

```
┌─────────────────────────────────────┐
│  🎨 主题    🔑 API                [X]│  ← 关闭按钮右上角
├─────────────────────────────────────┤
│  预设供应商                          │
│  [OpenAI] [Anthropic] [DeepSeek]    │
│  [我的定制×] [自定义]                │  ← 自定义可删
├─────────────────────────────────────┤
│  供应商名称    [OpenAI           ]   │
│  API 密钥      [sk-...           ]   │
│  请求地址      [https://api.open  ]  │
│  模型名称      [gpt-4o           ]   │
│                                     │
│  ──────── 高级选项 ────────           │
│                                     │
│  协议兼容  [OpenAI图标 OpenAI] [Claude图标 Anthropic] │
│                                     │
│  [协议对应的动态表单字段]              │
│                                     │
│  [🧪 测试连接]  ✅ 连接成功          │
│  [+ 添加供应商]   ← 仅自定义模式显示  │
└─────────────────────────────────────┘
```

## 预设供应商

| 按钮 | provider | API 地址 | 默认模型 | 协议 | 图标 |
|------|----------|----------|---------|------|------|
| OpenAI | openai | `https://api.openai.com/v1` | `gpt-4o` | openai | ModelIcon(`gpt-4o`) |
| Anthropic | anthropic | `https://api.anthropic.com` | `claude-sonnet-4-6` | anthropic | ModelIcon(`claude-sonnet-4-6`) |
| DeepSeek | deepseek | `https://api.deepseek.com` | `deepseek-chat` | openai | ModelIcon(`deepseek-chat`) |
| 自定义 | custom | (空) | (空) | openai | 齿轮占位 |

图标通过 `@lobehub/icons` 的 `ModelIcon` 组件，传入 `modelKey` 做正则关键词匹配 → 本地 SVG 组件。

## API Key 按 Provider 分隔保存

### 存储

`localStorage` key `adventure_api_configs`，结构：

```ts
Record<Provider, { apiKey, model, customBaseURL, protocol, providerName, apiBaseURL, advancedParams }>
```

### 切换流程

点预设按钮 → `loadApiConfigForProvider(provider)` 读取该 provider 的已保存配置 → `APPLY_PRESET` 一并传入 → reducer 合并预设默认值和已保存值（已保存优先）。

### 迁移

`migratePollutedApiConfigs()` 在 `createInitialState` 时执行：检测 ≥2 个 provider 有相同的非空 apiKey → 判定为旧版 bug 污染 → 只保留 `loadLastProvider()` 对应 provider 的 key，其余清空。

### 自定保存

`useEffect` 监听 `[apiKey, provider, model, ...]` 变化 → `configs[state.provider] = { ... }` → `saveAllApiConfigs`。首次渲染跳过。

## 关闭按钮

- 位置：标签栏右侧（`ml-auto`）
- 样式：SVG X 图标（20×20），悬停变色
- 移除底部全宽"关闭"文字按钮

## 高级参数（按协议，按 API 实际支持整理）

### OpenAI 协议
| 参数 | 标签 | 类型 | 范围 | 说明 |
|------|------|------|------|------|
| `reasoning_effort` | 推理力度 | select | 低/中/高 | 推理模型专用 |
| `stream` | 流式输出 | toggle | - | 逐字返回 |
| `temperature` | 温度 | number | 0~2 | |
| `max_tokens` | 最大令牌数 | number | 1~128000 | |
| `top_p` | 核采样 | number | 0~1 | |

> 移除 `thinking`：OpenAI Chat Completions API 不支持此参数

### Anthropic 协议
| 参数 | 标签 | 类型 | 范围 | 说明 |
|------|------|------|------|------|
| `thinking` | 思考模式 | select | 启用/禁用 | Anthropic 扩展思考 |
| `stream` | 流式输出 | toggle | - | |
| `max_tokens` | 最大令牌数 | number | 1~128000 | |
| `temperature` | 温度 | number | 0~1 | |
| `top_p` | 核采样 | number | 0~1 | |
| `top_k` | 候选数 | number | 0~100 | Anthropic 独有 |

> 新增 `thinking`、`stream`（Anthropic Messages API 均支持）

## 协议兼容

两个 pill 按钮：OpenAI 兼容 / Anthropic。选中态 `ring-2 ring-[var(--accent)]`，未选中态 `border`。图标通过 ModelIcon 匹配。

## 自定义供应商

### 存储

`localStorage` key `adventure_custom_presets`，数组：

```ts
interface CustomPreset {
  id: string          // 'custom_1730000000000'
  name: string        // 供应商名称
  provider: 'custom'
  apiKey: string
  apiBaseURL: string
  model: string
  protocol: Protocol
  advancedParams?: Record<string, unknown>
}
```

### 交互

1. 选「自定义」，填好字段
2. 滚到底部，点「+ 添加供应商」
3. 校验：名称不能为空、不能重名
4. 保存到 `customPresets` state + localStorage
5. 按钮行出现新预设（排在「自定义」之前），自动高亮
6. 每个自定义预设右侧有 × 删除按钮
7. 删除当前激活的预设时，自动切回默认「自定义」

## 测试连接超时

`AbortController` + `setTimeout(10000)`，超时显示"连接超时（10秒）"。

## 类型扩展

```ts
// src/lib/types.ts

type Protocol = 'openai' | 'anthropic'

interface AdvancedParams {
  thinking?: 'enabled' | 'disabled'
  reasoning_effort?: 'low' | 'medium' | 'high'
  stream?: boolean
  temperature?: number
  max_tokens?: number
  top_p?: number
  top_k?: number
}

// GameState 新增字段
protocol: Protocol
providerName: string
apiBaseURL: string
advancedParams: AdvancedParams

// 新增 Actions
| { type: 'SET_PROTOCOL'; protocol: Protocol }
| { type: 'SET_PROVIDER_NAME'; name: string }
| { type: 'SET_API_BASE_URL'; url: string }
| { type: 'SET_ADVANCED_PARAMS'; params: Partial<AdvancedParams> }
| { type: 'APPLY_PRESET'; preset: PresetProvider; apiKey?: string; model?: string; ... }
```

## 预设联动

点预设按钮 → `loadApiConfigForProvider` 读取已保存配置 → dispatch `APPLY_PRESET`（含已保存字段） → reducer 合并预设默认值和已保存值（已保存优先 `??`）。

## 持久化

- API 配置：`loadAllApiConfigs` / `saveAllApiConfigs`，按 `state.provider` 为 key
- 自定义预设：`loadCustomPresets` / `saveCustomPresets`，数组格式
- 迁移逻辑：`migratePollutedApiConfigs` 修复旧版 apiKey 污染

## 改动文件

| 文件 | 改动 |
|------|------|
| `src/lib/types.ts` | 新增 `Protocol`、`AdvancedParams`、扩展 `GameState` 和 `GameAction` |
| `src/lib/game-context.tsx` | Reducer 新增 action 处理；导出 `loadApiConfigForProvider`；新增 `migratePollutedApiConfigs` |
| `src/components/SystemSettings.tsx` | 重写 API 标签 UI（预设按钮、协议切换、高级表单、自定义供应商、关闭按钮） |
| `src/app/api/adventure/route.ts` | 读取 `advancedParams` 传入 AI SDK 调用 |

## 不做

- 不改变主题标签 UI
- 不改变 autofill 防护逻辑

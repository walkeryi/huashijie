# API 设置布局重设计

> 重新设计系统设置中的 API 配置界面，引入预设供应商按钮、高级参数配置、协议兼容切换。

## 目标

将当前杂乱的 API 设置表单重设计为结构清晰的阶梯式配置界面：预设供应商 → 基础字段 → 高级选项。

## 架构

纯前端 UI 重设计 + 状态扩展。高级参数存入 `GameState` 并通过 `/api/adventure` 转发到 AI SDK。

## UI 结构

```
┌─────────────────────────────────────┐
│  🎨 主题    🔑 API                  │
├─────────────────────────────────────┤
│  预设供应商                          │
│  ┌────────┬────────┬────────┬────┐  │
│  │ 🌀 GPT │ ⭐ Claude│ 🐋 DeepSeek│⚙️ 自定义│
│  └────────┴────────┴────────┴────┘  │
│                                     │
│  供应商名称    [OpenAI           ]   │
│  API Key      [sk-...           ]   │
│  请求地址      [https://api.open  ]  │
│  模型名称      [gpt-4o           ]   │
│                                     │
│  ──────── 高级选项 ────────           │
│                                     │
│  协议兼容  ○ OpenAI 兼容  ○ Anthropic │
│  [协议对应的动态表单字段]              │
│                                     │
│  [🧪 测试连接]  ✅ 连接成功          │
│  [关闭]                              │
└─────────────────────────────────────┘
```

## 预设供应商

| 按钮 | 提供商名 | API 地址 | 默认模型 | 协议 |
|------|---------|----------|---------|------|
| OpenAI | OpenAI | `https://api.openai.com/v1` | `gpt-4o` | openai |
| Claude | Anthropic | `https://api.anthropic.com` | `claude-sonnet-4-6` | anthropic |
| DeepSeek | DeepSeek | `https://api.deepseek.com` | `deepseek-chat` | openai |
| 自定义 | (空) | (空) | (空) | openai |

## 高级参数（按协议）

### OpenAI 兼容协议
- `thinking` — 下拉: enabled / disabled
- `reasoning_effort` — 下拉: low / medium / high
- `stream` — 开关
- `temperature` — 数字 0~2
- `max_tokens` — 数字
- `top_p` — 数字 0~1

### Anthropic 协议
- `max_tokens` — 数字
- `temperature` — 数字 0~1
- `top_p` — 数字 0~1
- `top_k` — 数字

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
| { type: 'APPLY_PRESET'; preset: PresetProvider }
```

## 预设联动

点预设按钮 → dispatch `APPLY_PRESET` → reducer 同时设置 provider、providerName、model、apiBaseURL、protocol、advancedParams 默认值。

## 持久化

高级参数跟随现有的 API 配置自动保存逻辑（`loadAllApiConfigs` / `saveAllApiConfigs` 扩展）。

## 改动文件

| 文件 | 改动 |
|------|------|
| `src/lib/types.ts` | 新增 `Protocol`、`AdvancedParams`、扩展 `GameState` 和 `GameAction` |
| `src/lib/game-context.tsx` | Reducer 新增 action 处理；扩展持久化逻辑 |
| `src/components/SystemSettings.tsx` | 重写 API 标签 UI（预设按钮、协议切换、高级表单） |
| `src/app/api/adventure/route.ts` | 读取 `advancedParams` 传入 AI SDK 调用 |

## 不做

- 不改变主题标签 UI
- 不改变测试连接 API
- 不改变 autofill 防护逻辑

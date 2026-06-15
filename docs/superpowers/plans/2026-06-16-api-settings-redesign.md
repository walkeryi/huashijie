# API 设置布局重设计 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重设计系统设置 API 标签：预设供应商按钮、基础字段、高级分割线、协议兼容切换

**Architecture:** 类型层（types.ts）→ 状态层（game-context.tsx reducer + 持久化）→ UI 层（SystemSettings.tsx 重写 API 标签）→ 传输层（route.ts 读取高级参数传入 AI SDK）

**Tech Stack:** React 19, TypeScript, Next.js, Tailwind CSS, `@lobehub/icons` (ModelIcon)

---

### 文件结构

| 文件 | 职责 | 改动类型 |
|------|------|---------|
| `src/lib/types.ts` | 新增 `Protocol`、`AdvancedParams`、`PresetProvider`；扩展 `GameState`/`GameAction` | 修改 |
| `src/lib/game-context.tsx` | Reducer 处理新 action；扩展 `SavedApiConfig` 持久化高级参数 | 修改 |
| `src/components/SystemSettings.tsx` | 重写 API 标签 UI | 修改 |
| `src/app/api/adventure/route.ts` | 读取 `advancedParams` 传入 SDK 调用 | 修改 |
| `src/lib/__tests__/game-reducer.test.ts` | 新增 action 测试 | 修改 |

---

### Task 1: 类型层 — 新增 Protocol、AdvancedParams、扩展 GameState

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: 在 types.ts 末尾追加新类型定义**

在 `src/lib/types.ts` 的 `GameAction` 联合类型之前，追加：

```ts
// ========== API 高级设置 ==========

export type Protocol = 'openai' | 'anthropic'

export interface AdvancedParams {
  thinking?: 'enabled' | 'disabled'
  reasoning_effort?: 'low' | 'medium' | 'high'
  stream?: boolean
  temperature?: number
  max_tokens?: number
  top_p?: number
  top_k?: number
}

export interface PresetProvider {
  id: string
  name: string
  provider: 'anthropic' | 'openai' | 'deepseek' | 'custom'
  apiBaseURL: string
  defaultModel: string
  protocol: Protocol
  icon: string  // @lobehub/icons 的图标组件名，或用于 ModelIcon 的 model 名
}
```

- [ ] **Step 2: GameState 新增字段**

在 `GameState` interface 中，`customBaseURL` 之后追加：

```ts
protocol: Protocol
providerName: string
apiBaseURL: string
advancedParams: AdvancedParams
```

- [ ] **Step 3: GameAction 新增 action 类型**

在 `GameAction` 联合类型末尾，`SET_SAVE_MODE` 之前追加：

```ts
| { type: 'SET_PROTOCOL'; protocol: Protocol }
| { type: 'SET_PROVIDER_NAME'; name: string }
| { type: 'SET_API_BASE_URL'; url: string }
| { type: 'SET_ADVANCED_PARAMS'; params: Partial<AdvancedParams> }
| { type: 'APPLY_PRESET'; preset: PresetProvider }
```

- [ ] **Step 4: 更新 SAVED_API_CONFIG 的存储类型以包含高级参数**

在 `game-context.tsx` 的 `SavedApiConfig` interface 中追加 `advancedParams` 和 `protocol`。

- [ ] **Step 5: 提交**

```bash
git add src/lib/types.ts src/lib/game-context.tsx
git commit -m "feat(types): 新增 Protocol、AdvancedParams、PresetProvider 类型"
```

---

### Task 2: Reducer — 处理新 Action + 持久化

**Files:**
- Modify: `src/lib/game-context.tsx`

- [ ] **Step 1: 在 reducer 中新增 5 个 case**

在 `gameReducer` 的 switch 中，`SET_CUSTOM_BASE_URL` 的 case 之后追加：

```ts
case 'SET_PROTOCOL':
  return { ...state, protocol: action.protocol }

case 'SET_PROVIDER_NAME':
  return { ...state, providerName: action.name }

case 'SET_API_BASE_URL':
  return { ...state, apiBaseURL: action.url }

case 'SET_ADVANCED_PARAMS':
  return { ...state, advancedParams: { ...state.advancedParams, ...action.params } }

case 'APPLY_PRESET': {
  const { preset } = action
  const defaultAdv: AdvancedParams = preset.protocol === 'anthropic'
    ? { max_tokens: 4096, temperature: 0.7, top_p: 1, top_k: 40 }
    : { thinking: 'enabled', reasoning_effort: 'high', stream: false, temperature: 0.7, max_tokens: 4096, top_p: 1 }
  return {
    ...state,
    provider: preset.provider,
    providerName: preset.name,
    model: preset.defaultModel,
    apiBaseURL: preset.apiBaseURL,
    protocol: preset.protocol,
    advancedParams: defaultAdv,
  }
}
```

- [ ] **Step 2: createInitialState 初始化新字段**

```ts
protocol: 'openai' as Protocol,
providerName: 'DeepSeek',
apiBaseURL: 'https://api.deepseek.com',
advancedParams: { thinking: 'enabled', reasoning_effort: 'high', stream: false, temperature: 0.7, max_tokens: 4096, top_p: 1 },
```

- [ ] **Step 3: 扩展 SavedApiConfig 的保存/加载逻辑**

在 `SavedApiConfig` interface 中追加：

```ts
interface SavedApiConfig {
  apiKey: string
  model: string
  customBaseURL: string
  protocol: Protocol
  providerName: string
  apiBaseURL: string
  advancedParams: AdvancedParams
}
```

更新 `saveAllApiConfigs` 和 `loadApiConfigForProvider` 以包含新字段。

更新 `SET_PROVIDER` action 的处理逻辑，也从 saved config 读取 `providerName`、`apiBaseURL`、`protocol`、`advancedParams`。

- [ ] **Step 4: 运行测试确认无回归**

```bash
npx vitest run
```
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add src/lib/game-context.tsx
git commit -m "feat(reducer): 新增 protocol/providerName/apiBaseURL/advancedParams action 处理"
```

---

### Task 3: SystemSettings — 预设供应商按钮 + 基础字段

**Files:**
- Modify: `src/components/SystemSettings.tsx`

- [ ] **Step 1: 定义预设供应商数据**

在组件文件顶部，`TabType` 之后追加：

```ts
import { ModelIcon } from '@lobehub/icons'

interface PresetDef {
  id: string
  name: string
  provider: GameState['provider']
  apiBaseURL: string
  defaultModel: string
  protocol: 'openai' | 'anthropic'
  modelKey: string  // ModelIcon 用的 model 名
}

const PRESETS: PresetDef[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    provider: 'openai',
    apiBaseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    protocol: 'openai',
    modelKey: 'gpt-4o',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    provider: 'anthropic',
    apiBaseURL: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    protocol: 'anthropic',
    modelKey: 'claude-sonnet-4-6',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    provider: 'deepseek',
    apiBaseURL: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    protocol: 'openai',
    modelKey: 'deepseek-chat',
  },
  {
    id: 'custom',
    name: '自定义',
    provider: 'custom',
    apiBaseURL: '',
    defaultModel: '',
    protocol: 'openai',
    modelKey: '',
  },
]
```

- [ ] **Step 2: 替换当前 API 标签 UI**

将 `tab === 'api'` 分支下的 JSX 替换为：

```tsx
{tab === 'api' && (
  <div className="px-6 py-6 space-y-4">
    {/* 预设供应商 */}
    <div>
      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
        预设供应商
      </label>
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map(p => {
          const active = state.provider === p.provider && state.providerName === p.name
          return (
            <button
              key={p.id}
              onClick={() => actions.dispatch({
                type: 'APPLY_PRESET',
                preset: {
                  id: p.id,
                  name: p.name,
                  provider: p.provider,
                  apiBaseURL: p.apiBaseURL,
                  defaultModel: p.defaultModel,
                  protocol: p.protocol,
                  icon: p.modelKey,
                }
              } as any)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg text-xs transition-all ${
                active
                  ? 'ring-2 ring-[var(--accent)] bg-[var(--bg-card)]'
                  : 'bg-[var(--bg-card)]/50 hover:bg-[var(--bg-card)] border border-[var(--border)]'
              }`}
            >
              {p.modelKey ? (
                <ModelIcon model={p.modelKey} size={28} type="color" />
              ) : (
                <div className="w-7 h-7 flex items-center justify-center text-lg">⚙️</div>
              )}
              <span className="text-[var(--text-primary)] text-[11px] leading-tight">{p.name}</span>
            </button>
          )
        })}
      </div>
    </div>

    {/* 基础字段 */}
    <div>
      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
        供应商名称
      </label>
      <input
        type="text"
        value={state.providerName}
        onChange={e => actions.dispatch({ type: 'SET_PROVIDER_NAME', name: e.target.value })}
        placeholder="例如：OpenAI"
        className="w-full px-4 py-2.5 rounded-lg text-sm"
        style={{
          border: 'var(--border-width) var(--border-style) var(--border)',
          borderRadius: 'var(--border-radius)',
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
        }}
      />
    </div>

    {/* API Key */}
    <div>
      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
        API Key
      </label>
      <div className="relative">
        <input
          type="text"
          value={state.apiKey}
          onChange={handleApiKeyChange}
          onAnimationStart={handleApiKeyAnimationStart}
          placeholder="sk-..."
          autoComplete="off"
          className="huashijie-apikey w-full px-4 py-2.5 pr-10 outline-none text-sm font-mono"
          style={{
            WebkitTextSecurity: showKey ? 'none' : 'disc',
            border: 'var(--border-width) var(--border-style) var(--border)',
            borderRadius: 'var(--border-radius)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
          } as React.CSSProperties}
        />
        <button onClick={() => setShowKey(!showKey)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]/30 transition-colors"
          title={showKey ? '隐藏' : '显示'}>
          {showKey ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          )}
        </button>
      </div>
    </div>

    {/* 请求地址 */}
    <div>
      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
        请求地址
      </label>
      <input
        type="text"
        value={state.apiBaseURL}
        onChange={e => actions.dispatch({ type: 'SET_API_BASE_URL', url: e.target.value })}
        placeholder="https://api.openai.com/v1"
        className="w-full px-4 py-2.5 rounded-lg text-sm"
        style={{
          border: 'var(--border-width) var(--border-style) var(--border)',
          borderRadius: 'var(--border-radius)',
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
        }}
      />
    </div>

    {/* 模型名称 */}
    <div>
      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
        模型名称
      </label>
      <input
        type="text"
        value={state.model}
        onChange={e => actions.setModel(e.target.value)}
        placeholder="例如：gpt-4o"
        className="w-full px-4 py-2.5 rounded-lg text-sm"
        style={{
          border: 'var(--border-width) var(--border-style) var(--border)',
          borderRadius: 'var(--border-radius)',
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
        }}
      />
    </div>
  </div>
)}
```

**重要：** 这两个字段的输入处理需要新增 `useCallback` 包装的 dispatch actions。由于现有 `actions` 对象没有 `dispatch`，需要从 `useGame()` 解构出 `dispatch`。在组件顶部 `const { state, actions } = useGame()` 改为 `const { state, actions, dispatch } = useGame()`。

- [ ] **Step 3: 运行测试和 dev 检查**

```bash
npx vitest run
npm run dev  # 手动检查 UI
```

- [ ] **Step 4: 提交**

```bash
git add src/components/SystemSettings.tsx
git commit -m "feat(ui): 预设供应商按钮 + 基础字段重构"
```

---

### Task 4: SystemSettings — 高级分割线 + 协议切换

**Files:**
- Modify: `src/components/SystemSettings.tsx`

- [ ] **Step 1: 在基础字段和测试连接之间插入高级选项 JSX**

在模型名称输入框之后、连接测试按钮之前插入：

```tsx
{/* 高级分割线 */}
<div className="flex items-center gap-3 pt-2">
  <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
  <span className="text-xs text-[var(--text-secondary)]">高级选项</span>
  <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
</div>

{/* 协议兼容 */}
<div>
  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
    协议兼容
  </label>
  <div className="flex gap-2">
    {(['openai', 'anthropic'] as Protocol[]).map(p => (
      <button
        key={p}
        onClick={() => dispatch({ type: 'SET_PROTOCOL', protocol: p })}
        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
          state.protocol === p
            ? 'ring-2 ring-[var(--accent)] bg-[var(--bg-card)] text-[var(--text-primary)]'
            : 'bg-[var(--bg-card)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
        }`}
      >
        {p === 'openai' ? '🧬 OpenAI 兼容' : '🔷 Anthropic'}
      </button>
    ))}
  </div>
</div>

{/* 协议对应的动态高级参数 */}
{state.protocol === 'openai' ? (
  <>
    <AdvancedSelect
      label="Thinking"
      value={state.advancedParams?.thinking ?? 'enabled'}
      options={['enabled', 'disabled']}
      onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { thinking: v as any } })}
    />
    <AdvancedSelect
      label="Reasoning Effort"
      value={state.advancedParams?.reasoning_effort ?? 'high'}
      options={['low', 'medium', 'high']}
      onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { reasoning_effort: v as any } })}
    />
    <AdvancedToggle
      label="Stream"
      value={state.advancedParams?.stream ?? false}
      onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { stream: v } })}
    />
    <AdvancedNumber
      label="Temperature"
      value={state.advancedParams?.temperature ?? 0.7}
      min={0} max={2} step={0.1}
      onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { temperature: v } })}
    />
    <AdvancedNumber
      label="Max Tokens"
      value={state.advancedParams?.max_tokens ?? 4096}
      min={1} max={128000}
      onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { max_tokens: v } })}
    />
    <AdvancedNumber
      label="Top P"
      value={state.advancedParams?.top_p ?? 1}
      min={0} max={1} step={0.05}
      onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { top_p: v } })}
    />
  </>
) : (
  <>
    <AdvancedNumber
      label="Max Tokens"
      value={state.advancedParams?.max_tokens ?? 4096}
      min={1} max={128000}
      onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { max_tokens: v } })}
    />
    <AdvancedNumber
      label="Temperature"
      value={state.advancedParams?.temperature ?? 0.7}
      min={0} max={1} step={0.1}
      onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { temperature: v } })}
    />
    <AdvancedNumber
      label="Top P"
      value={state.advancedParams?.top_p ?? 1}
      min={0} max={1} step={0.05}
      onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { top_p: v } })}
    />
    <AdvancedNumber
      label="Top K"
      value={state.advancedParams?.top_k ?? 40}
      min={0} max={100}
      onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { top_k: v } })}
    />
  </>
)}
```

- [ ] **Step 2: 创建辅助组件（同文件内）**

在 `SystemSettings` 组件之前追加三个简小组件：

```tsx
function AdvancedSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{
          border: 'var(--border-width) var(--border-style) var(--border)',
          borderRadius: 'var(--border-radius)',
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
        }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function AdvancedToggle({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-colors relative ${
          value ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
            value ? 'left-5' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}

function AdvancedNumber({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{
          border: 'var(--border-width) var(--border-style) var(--border)',
          borderRadius: 'var(--border-radius)',
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
        }}
      />
    </div>
  )
}
```

- [ ] **Step 3: 运行测试和 dev 检查**

```bash
npx vitest run
```

- [ ] **Step 4: 提交**

```bash
git add src/components/SystemSettings.tsx
git commit -m "feat(ui): 高级分割线 + 协议兼容切换 + 动态参数表单"
```

---

### Task 5: Route — 读取 advancedParams 传入 SDK

**Files:**
- Modify: `src/app/api/adventure/route.ts`

- [ ] **Step 1: 从请求体提取新字段**

在 `POST` 函数解构 body 时追加：

```ts
const { ..., advancedParams } = body as {
  ...
  advancedParams?: AdvancedParams
}
```

- [ ] **Step 2: 传入 callOpenAI / callAnthropic**

修改 `callOpenAI` 签名，追加 `advancedParams?: AdvancedParams`：

```ts
async function callOpenAI(
  apiKey: string,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  baseURL?: string,
  model?: string,
  advancedParams?: AdvancedParams,
): Promise<string> {
  const client = new OpenAI({ apiKey, baseURL })
  const createParams: any = {
    model: model || 'gpt-4o',
    max_tokens: advancedParams?.max_tokens ?? 1024,
    messages,
  }
  if (advancedParams?.temperature !== undefined) createParams.temperature = advancedParams.temperature
  if (advancedParams?.top_p !== undefined) createParams.top_p = advancedParams.top_p
  if (advancedParams?.stream !== undefined) createParams.stream = advancedParams.stream

  const response = await client.chat.completions.create(createParams)
  return response.choices[0]?.message?.content ?? ''
}
```

类似地修改 `callAnthropic`：

```ts
async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  model?: string,
  advancedParams?: AdvancedParams,
): Promise<string> {
  const client = new Anthropic({ apiKey })
  const createParams: any = {
    model: model || 'claude-sonnet-4-6',
    max_tokens: advancedParams?.max_tokens ?? 1024,
    system: systemPrompt,
    messages,
  }
  if (advancedParams?.temperature !== undefined) createParams.temperature = advancedParams.temperature
  if (advancedParams?.top_p !== undefined) createParams.top_p = advancedParams.top_p
  if (advancedParams?.top_k !== undefined) createParams.top_k = advancedParams.top_k

  const response = await client.messages.create(createParams)
  const firstBlock = response.content[0]
  if (!firstBlock || firstBlock.type !== 'text') {
    throw new Error('AI 返回了非预期的响应格式')
  }
  return firstBlock.text
}
```

- [ ] **Step 3: 调用处传入 advancedParams**

```ts
if (provider === 'anthropic') {
  text = await callAnthropic(apiKey, systemPrompt, messages, model, advancedParams)
} else {
  text = await callOpenAI(apiKey, messages, baseURL || undefined, model, advancedParams)
}
```

- [ ] **Step 4: game-context.tsx submitAction 发送 advancedParams**

在 `submitAction` 的 fetch body 中追加：

```ts
advancedParams: current.advancedParams,
```

- [ ] **Step 5: 运行测试**

```bash
npx vitest run
```

- [ ] **Step 6: 提交**

```bash
git add src/app/api/adventure/route.ts src/lib/game-context.tsx
git commit -m "feat(api): 读取 advancedParams 传入 AI SDK 调用"
```

---

### Task 6: 测试 — 新 action 和持久化

**Files:**
- Modify: `src/lib/__tests__/game-reducer.test.ts`

- [ ] **Step 1: 新增 action 单元测试**

在测试文件末尾追加：

```ts
describe('高级 API 设置', () => {
  const base = createInitialState()

  test('SET_PROTOCOL 切换协议', () => {
    const s = gameReducer(base, { type: 'SET_PROTOCOL', protocol: 'anthropic' })
    expect(s.protocol).toBe('anthropic')
  })

  test('SET_PROVIDER_NAME 设置供应商名称', () => {
    const s = gameReducer(base, { type: 'SET_PROVIDER_NAME', name: 'MyProvider' })
    expect(s.providerName).toBe('MyProvider')
  })

  test('SET_API_BASE_URL 设置请求地址', () => {
    const s = gameReducer(base, { type: 'SET_API_BASE_URL', url: 'https://example.com' })
    expect(s.apiBaseURL).toBe('https://example.com')
  })

  test('SET_ADVANCED_PARAMS 合并高级参数', () => {
    let s = gameReducer(base, { type: 'SET_ADVANCED_PARAMS', params: { temperature: 0.5 } })
    expect(s.advancedParams?.temperature).toBe(0.5)
    s = gameReducer(s, { type: 'SET_ADVANCED_PARAMS', params: { max_tokens: 2048 } })
    expect(s.advancedParams?.temperature).toBe(0.5) // 保留之前的
    expect(s.advancedParams?.max_tokens).toBe(2048)
  })

  test('APPLY_PRESET OpenAI 预设自动填充所有字段', () => {
    const preset = {
      id: 'openai', name: 'OpenAI', provider: 'openai' as const,
      apiBaseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o',
      protocol: 'openai' as const, icon: 'gpt-4o',
    }
    const s = gameReducer(base, { type: 'APPLY_PRESET', preset })
    expect(s.provider).toBe('openai')
    expect(s.providerName).toBe('OpenAI')
    expect(s.apiBaseURL).toBe('https://api.openai.com/v1')
    expect(s.model).toBe('gpt-4o')
    expect(s.protocol).toBe('openai')
    expect(s.advancedParams?.thinking).toBe('enabled')
    expect(s.advancedParams?.reasoning_effort).toBe('high')
  })

  test('APPLY_PRESET Anthropic 预设', () => {
    const preset = {
      id: 'anthropic', name: 'Anthropic', provider: 'anthropic' as const,
      apiBaseURL: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-6',
      protocol: 'anthropic' as const, icon: 'claude-sonnet-4-6',
    }
    const s = gameReducer(base, { type: 'APPLY_PRESET', preset })
    expect(s.provider).toBe('anthropic')
    expect(s.protocol).toBe('anthropic')
    expect(s.advancedParams?.top_k).toBe(40)
    expect(s.advancedParams?.thinking).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行全部测试**

```bash
npx vitest run
```
Expected: 142 tests passed（原 136 + 新增 6）

- [ ] **Step 3: 提交**

```bash
git add src/lib/__tests__/game-reducer.test.ts
git commit -m "test: 高级API设置 action 单元测试"
```

---

### 完成标准

- [ ] 预设供应商按钮点击后自动填充所有字段
- [ ] 协议切换后高级参数字段动态变化
- [ ] 高级参数持久化到 localStorage
- [ ] 高级参数通过 API 路由传入 AI SDK
- [ ] 140+ 测试全过
- [ ] `npm run dev` UI 验证

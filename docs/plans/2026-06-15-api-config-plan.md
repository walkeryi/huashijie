# API 高级配置 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task.

**Goal:** 用户在前端自由配置 API Key、提供商、模型名和自定义地址，无需预设。

**Architecture:** GameState 新增 `model` 字段，切换提供商时自动填入默认模型。后端接受 model + baseURL 参数。新增 `/api/test-connection` 验证连通性。

**Tech Stack:** Next.js + TypeScript（现有栈）

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/lib/types.ts` | 修改 | 加 model 字段、SET_MODEL action |
| `src/lib/game-context.tsx` | 修改 | setModel callback、API 调用传 model |
| `src/app/api/adventure/route.ts` | 修改 | 用请求中的 model 替换硬编码 |
| `src/app/api/test-connection/route.ts` | 新建 | 测试连接端点 |
| `src/components/WorldCardSelector.tsx` | 修改 | model 输入框、测试连接按钮 |

---

### Task 1: 更新类型定义

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: 添加 model 字段和 SET_MODEL action**

在 GameState 加 `model: string`，在 GameAction 加 SET_MODEL：

```typescript
// GameState 中新增
model: string

// GameAction 中新增
| { type: 'SET_MODEL'; model: string }
```

- [ ] **Step 2: 验证 TypeScript**

```bash
npx tsc --noEmit
```

预期：其他文件报错（GameState 缺 model、reducer 缺 case），这是 RED 阶段

- [ ] **Step 3: 提交**

```bash
git add src/lib/types.ts
git commit -m "feat: add model field and SET_MODEL action to types"
```

---

### Task 2: 更新 game-context

**Files:**
- Modify: `src/lib/game-context.tsx`

- [ ] **Step 1: 添加默认模型常量、SET_MODEL 和 setModel**

在文件顶部添加每个提供商的默认模型映射，在 createInitialState 加 model 字段，在 reducer 加 SET_MODEL case，添加 setModel callback 并传入 context value。

- [ ] **Step 2: 在 submitAction 中传 model**

在 fetch body 中加 `model: current.model`。

- [ ] **Step 3: 验证编译通过**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add src/lib/game-context.tsx
git commit -m "feat: add model support to game context and API calls"
```

---

### Task 3: 更新 API adventure route（接受 model）

**Files:**
- Modify: `src/app/api/adventure/route.ts`

- [ ] **Step 1: 接受 model 字段并使用**

在 POST body 解构中加 `model` 字段。更新 `callAnthropic` 和 `callOpenAI` 函数签名，接受可选 model 参数，传值覆盖默认。

```typescript
// 新增：默认模型
const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  deepseek: 'deepseek-chat',
}

// callAnthropic 加 model 参数
async function callAnthropic(apiKey: string, systemPrompt: string, messages: Anthropic.MessageParam[], model?: string)

// callOpenAI 的 model 参数不要默认值，用外部传入的
```

- [ ] **Step 2: 验证编译并更新测试**

```bash
npx tsc --noEmit
npx vitest run
```

- [ ] **Step 3: 提交**

---

### Task 4: 新建测试连接 API

**Files:**
- Create: `src/app/api/test-connection/route.ts`

- [ ] **Step 1: 编写 RED 测试**

```typescript
// src/app/api/test-connection/__tests__/route.test.ts
import { describe, it, expect } from 'vitest'

describe('POST /api/test-connection', () => {
  it('returns 400 when body is incomplete', async () => {
    // 测试缺少必要字段时返回 400
  })
})
```

- [ ] **Step 2: 实现 endpoint**

```typescript
// POST /api/test-connection
// Body: { apiKey, provider, model?, baseURL? }
// 发一条 "hi" 消息验证连通
// 成功: { ok: true, latency: 123 }
// 失败: { ok: false, error: "..." }
```

根据 provider 调用对应 API，custom/openai/deepseek 用 OpenAI 兼容协议，anthropic 用 Anthropic SDK。

- [ ] **Step 3: 验证测试通过**

```bash
npx vitest run
```

- [ ] **Step 4: 提交**

---

### Task 5: 更新前端 WorldCardSelector

**Files:**
- Modify: `src/components/WorldCardSelector.tsx`

- [ ] **Step 1: 改造 API 设置区域**

替换现有的 API key + provider 为：
- API Key 输入框（保持现有）
- 提供商下拉（保持现有）
- 新增模型名输入框（切换提供商时自动填入默认值）
- customBaseURL 输入框（仅 provider='custom' 时显示）
- 「测试连接」按钮

```tsx
{/* 模型名 — 提供商改变时自动填入默认 */}
<input
  type="text"
  value={state.model}
  onChange={e => actions.setModel(e.target.value)}
  placeholder="模型名"
/>

{/* API 地址 — 仅 custom 显示 */}
{state.provider === 'custom' && (
  <input placeholder="https://api.example.com/v1" />
)}

{/* 测试连接按钮 */}
<button onClick={handleTestConnection}>
  🧪 测试连接
</button>
```

切换提供商时的自动填充：在 provider onChange 中同时调 `actions.setModel(默认值)`。

- [ ] **Step 2: 验证编译并修复测试**

```bash
npx tsc --noEmit
npx vitest run
```

- [ ] **Step 3: 提交**

---

### Task 6: 端到端验证

- [ ] **Step 1: 构建验证**

```bash
npx next build
```

- [ ] **Step 2: 手动测试**

1. 打开 localhost:3000 → 看到完整 API 设置区
2. 切换提供商 → 模型名自动更新
3. 选 custom → API 地址框出现
4. 点击测试连接 → 返回结果

- [ ] **Step 3: 提交**

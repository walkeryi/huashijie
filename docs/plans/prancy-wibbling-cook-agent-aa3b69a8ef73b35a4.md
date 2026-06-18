# 实现计划: NPC 类型定义 — NPCFieldMeta、NPCDef、RuntimeNPCState、预设字段

## 涉及文件

1. `C:\Users\ASUS\Desktop\话世界\src\lib\types.ts` — 类型定义源文件
2. `C:\Users\ASUS\Desktop\话世界\src\lib\game-context.tsx` — 上下文/Reducer（需添加初始值）
3. `C:\Users\ASUS\Desktop\话世界\src\lib\__tests__\game-reducer.test.ts` — 测试文件

---

## Step 1: 在测试文件中追加类型定义测试

**文件**: `src/lib/__tests__/game-reducer.test.ts`

### 1a. 添加 import
在已有 import 之后添加：
```ts
import { NPCFieldMeta, NPCDef, RuntimeNPCState, PRESET_NPC_FIELDS } from '../types'
```

### 1b. 追加测试块
在文件末尾（`describe('gameReducer')` 之后）追加：
```ts
describe('NPCFieldMeta', () => {
  it('12 个静态预设字段符合 schema', () => {
    const fields = PRESET_NPC_FIELDS
    expect(fields).toHaveLength(12)
    fields.forEach(f => {
      expect(f).toHaveProperty('key')
      expect(f).toHaveProperty('label')
      expect(f).toHaveProperty('desc')
      expect(f).toHaveProperty('type')
      expect(f).toHaveProperty('fixed')
      expect(f).toHaveProperty('runtimeRequired')
      expect(f).toHaveProperty('nullable')
      expect(['string','string[]','boolean','number']).toContain(f.type)
    })
  })

  it('静态预设字段不含运行时字段 currentSelfPerception / currentState', () => {
    const keys = PRESET_NPC_FIELDS.map(f => f.key)
    expect(keys).not.toContain('currentSelfPerception')
    expect(keys).not.toContain('currentState')
  })
})
```

---

## Step 2: 运行测试确认失败

```bash
npx vitest run src/lib/__tests__/game-reducer.test.ts
```
预期: 测试 FAIL（PRESET_NPC_FIELDS 未定义）

---

## Step 3: 实现类型定义

### 3a. 替换 `src/lib/types.ts` 中旧的 NPCDef (原第 43-48 行)

**旧代码**:
```ts
export interface NPCDef {
  id: string              // "blacksmith"
  name: string            // "铁匠老王"
  description: string     // 背景描述
  initialAffinity: number // 初始好感 (0-100)
}
```

**新代码** — 替换为 NPCFieldMeta + CustomFieldMeta + 新 NPCDef + RuntimeNPCState + PRESET_NPC_FIELDS（共约 60 行）

**注意**: 新 `NPCDef` 删除了 `name`, `description`, `initialAffinity` 字段，改为 `fields: Record<string, any>`，这会导致 `game-context.tsx` 第 135 行 `n.initialAffinity` 产生 TypeScript 类型错误。但由于 vitest 默认使用 esbuild 转译（不执行类型检查），测试仍可运行通过。后续任务会修复 reducer 逻辑。

### 3b. 在 GameState 接口中添加 `npcRuntime` 字段

在 `src/lib/types.ts` GameState 接口中添加：
```ts
npcRuntime: Record<string, RuntimeNPCState>  // key = npc.id
```

### 3c. 在 `createInitialState()` 中设置初始值

在 `src/lib/game-context.tsx` 的 `createInitialState()` 返回对象中添加：
```ts
npcRuntime: {},
```

### 3d. 确保导出

`NPCFieldMeta`、`CustomFieldMeta`、`NPCDef`、`RuntimeNPCState`、`PRESET_NPC_FIELDS` 均已通过 `export` 关键字导出，无需额外处理。

---

## Step 4: 运行测试确认通过

```bash
npx vitest run src/lib/__tests__/game-reducer.test.ts
```
预期: 所有测试 PASS（原有的 reducer 测试 + 新增的 NPCFieldMeta 测试）

---

## Step 5: Commit

```bash
git add src/lib/types.ts src/lib/__tests__/game-reducer.test.ts src/lib/game-context.tsx
git commit -m "feat(types): NPCFieldMeta/NPCDef/RuntimeNPCState — 12静态+2运行时"
```

---

## 风险/注意事项

1. **TypeScript 类型错误**: 新的 `NPCDef` 缺少 `name` / `description` / `initialAffinity`，会导致 `game-context.tsx` 第 135 行类型错误。但这不影响 vitest 测试运行（esbuild 只转译不检查类型），但编译 (`tsc`) 会报错。此问题预期在后续任务中修复。
2. **WorldCard.npcs 字段**: `WorldCard` 的 `npcs: NPCDef[]` 保持不变，但 `NPCDef` 的结构已变，所有使用 `n.name` / `n.description` / `n.initialAffinity` 的地方都需要后续更新。
3. 测试数量: 原有 10 个测试 + 新增 2 个 = 12 个测试。

# Task 2: 预设剧本 NPC 迁移

## 目标
将 `src/data/world-cards.ts` 中的旧格式 NPC（`{ id, name, description, initialAffinity }`）迁移到新格式（`{ id, isMainCharacter, fields: Record<string, any> }`）。

## 当前状态

### world-cards.ts 现状
- **蒸汽苍穹**（第29-33行）：3个 NPC，旧格式
- **玉京风华**（第70-74行）：3个 NPC，旧格式

### world-cards.test.ts 现状
- 7个测试，全部通过
- 测试未直接引用 NPC 字段（只检查 card id/name/description/attributes），所以不需要修改

### game-context.tsx 现状
- 第136行：`n.initialAffinity` 在类型上不兼容新 NPCDef（`fields.initialAffinity`），但用户说类型错误可暂时忽略

### 类型定义（Task 1 已完成）
- `NPCDef`: `{ id, isMainCharacter, fields: Record<string, any> }`
- `PRESET_NPC_FIELDS`: 12 个静态字段定义
- `RuntimeNPCState`: `{ currentSelfPerception, currentState }`（不放入 fields）

## 步骤

### Step 1: 跑现有测试 ✓（已执行，全部通过）

### Step 2: 迁移蒸汽苍穹 NPC
- 将 3 个旧 NPC 替换为 4 个新格式 NPC（1 主角 + 3 普通 NPC）
- 每个 NPC 包含 `id`, `isMainCharacter`, `fields` 对象
- fields 包含全部 12 个预设字段

### Step 3: 迁移玉京风华 NPC
- 同样格式：1 主角 + 3 普通 NPC
- 字段根据原有 description 和名称映射到 fields 中
- 现有 data 映射:
  - `npc.name` → `fields.name`
  - `npc.description` → `fields.origin` + `fields.dialogueTone`
  - `npc.initialAffinity` → `fields.initialAffinity`

### Step 4: 更新测试
- 测试文件中无旧格式引用，无需修改

### Step 5: 跑全部测试
- `npx vitest run`
- 预期全部通过

### Step 6: Commit
- `git add src/data/world-cards.ts src/data/__tests__/world-cards.test.ts`
- `git commit -m "feat(data): 预设剧本 NPC 迁移到新角色档案格式"`

## 风险
- game-context.tsx 第136行仍有 `n.initialAffinity` 引用，在新类型下会是编译错误，但已被告知可暂时忽略
- 运行时需要更新 game-context.tsx 的 START_GAME handler 才能正确读取 initialAffinity，这是后续任务

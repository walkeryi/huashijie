# Plan: Task 7 - 创作台角色标签 UI

## 目标
修改 `src/components/WorldCreator.tsx`，将旧的 NPC 标签改为角色标签，使用新 NPCDef 格式（`{id, isMainCharacter, fields}`）和 PRESET_NPC_FIELDS。

## 改动清单

### 改动1: 导入 PRESET_NPC_FIELDS
- 在 `import { WorldCard, AttributeDef, NPCDef, StoryBeat } from '@/lib/types'` 中添加 `PRESET_NPC_FIELDS`
- 最终: `import { WorldCard, AttributeDef, NPCDef, StoryBeat, PRESET_NPC_FIELDS } from '@/lib/types'`

### 改动2: Tab 类型和标签
- 第10行: `type Tab = 'world' | 'attrs' | 'npcs' | 'items' | 'beats' | 'preview'` → 将 `'npcs'` 改为 `'characters'`
- 第15行: `{ key: 'npcs', label: 'NPC' }` → `{ key: 'characters', label: '👤角色' }`

### 改动3: Tab 内容渲染
- 第90行: `{tab === 'npcs' && <NPCsTab card={card} update={update} />}` → `{tab === 'characters' && <CharacterTab card={card} update={update} />}`

### 改动4: 替换 NPCsTab 函数 (第165-199行)
- 删除旧的 `NPCsTab` 函数（使用旧格式 `{id, name, description, initialAffinity}`）
- 添加新的 `CharacterTab` 函数，支持:
  - 主角/配角子标签 (`main` / `side`)
  - 主角创建（`ensureMainExists`）
  - 配角添加/删除
  - 按 PRESET_NPC_FIELDS 渲染所有预设字段（隐藏 isMainCharacter）
  - 自定义字段添加表单
  - 新 NPCDef 格式: `npc.fields[field.key]` 访问字段值

### 不修改的文件
- `src/lib/types.ts` — 已经是新格式，无需改动
- `src/lib/custom-cards.ts` — `createEmptyCard` 返回 `npcs: []`，兼容新格式
- `src/lib/game-context.tsx` — 已经使用 `n.fields.initialAffinity` 新格式
- BeatsTab — `npc.name` 在新格式下应为 `npc.fields.name`，但不在本任务范围内

### 验证
- `npx tsc --noEmit` — 类型检查通过
- `npx vitest run` — 测试通过
- Commit: `feat(creator): 角色标签+主角/配角子标签+自定义字段`

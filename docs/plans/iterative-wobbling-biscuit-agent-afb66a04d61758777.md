# Task 1: 类型定义 — Implementation Plan

## Goal
Add save-mode types, fields, and action to `src/lib/types.ts`, verify compilation, and commit.

## Changes to `src/lib/types.ts`

### Step 1 — Append new types at end of file (after line 134)

After the last line of the file (`| { type: 'INIT_NPC_AFFINITIES'; affinities: Record<string, number> }`), append:

```typescript

// ========== 存档模式 ==========

export type SaveMode = 'offline' | 'online'

/** 存储模式配置，持久化在 localStorage key: 'adventure_save_config' */
export interface SaveModeConfig {
  mode: SaveMode
  accountName: string
}

/** 存档元数据（列表用，不含对话历史和 apiKey） */
export interface SaveMeta {
  slot: number
  id: string
  slotName: string
  timestamp: number
  worldCardId: string
  playerName: string
}
```

### Step 2 — Add fields to `GameState` interface

Current `GameState` ends at line 118 with `npcAffinities: Record<string, number>` followed by `}`. Insert these two lines before the closing `}`:

```typescript
  saveMode: SaveMode
  accountName: string
```

### Step 3 — Add action to `GameAction` union type

Current `GameAction` ends at line 134 with:
```
  | { type: 'INIT_NPC_AFFINITIES'; affinities: Record<string, number> }
```

Append after that line:
```typescript
  | { type: 'SET_SAVE_MODE'; mode: SaveMode; accountName: string }
```

## Verification

```bash
npx tsc --noEmit
```

## Commit

```bash
git add src/lib/types.ts
git commit -m "feat: 新增 SaveMode、SaveMeta、在线模式相关类型"
```

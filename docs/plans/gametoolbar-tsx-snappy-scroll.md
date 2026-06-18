# 修复审查发现的 HIGH/MEDIUM 问题

## 背景
Workflow 审查发现 7 个确认问题，需修复高危和中等问题。

## 修复计划

### 1. 🔴 `actions.saveGame` 空 stub（game-context.tsx）
- 在 `saveGame` 实现中调用 `saveService.saveToSlot()`
- 同步补全 `deleteGame` 和 `refreshSaves`

### 2. 🔴 `useGame()` 每次 render 新对象（game-context.tsx）
- 对 `state` 和 `actions` 加 `useMemo`，防止 Context 拆分收益被抵消

### 3. 🔴 useEffect cleanup abort 反模式（GameScreen.tsx）
- 移除 cleanup 中的 abort，改为在 submitAction 内部管理

### 4. 🔴 `save-system.md` 文档归属错误
- StatusPanel → GameToolbar 替换

### 5. 🟡 `'use client'` 边界列表不全（react-patterns.md）
- 补全 8 个缺失组件

### 6. 🟡 submitAction useCallback deps 过宽（GameScreen.tsx）
- 依赖改为具体字段而非整个 state 对象

## 涉及文件
- src/lib/game-context.tsx
- src/components/GameScreen.tsx
- docs/as-built/save-system.md
- docs/as-built/react-patterns.md

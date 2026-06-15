# 创作台 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** 标签式表单界面，玩家创建自定义世界卡（存 localStorage，首页展示）。

**Architecture:** `/creator` 新页面 → WorldCreator 组件（6 标签表单）→ custom-cards.ts（localStorage CRUD）→ 首页合并展示。

---

### Task 1: custom-cards 存储层
- Create: `src/lib/custom-cards.ts`

### Task 2: WorldCreator 组件
- Create: `src/components/WorldCreator.tsx`

### Task 3: 页面 + 首页集成
- Create: `src/app/creator/page.tsx`
- Modify: `src/components/WorldCardSelector.tsx` — 展示自定义卡
- Modify: `src/app/page.tsx` — 入口按钮

### Task 4: 验证
- tsc + vitest + build

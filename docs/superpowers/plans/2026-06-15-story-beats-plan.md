# 故事节拍系统 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** 在世界卡中添加节拍链，prompt 注入节拍进度，AI 在节拍框架内叙事。

**Architecture:** StoryBeat 类型定义 → 预设卡加节拍数据 → prompt 末尾注入进度 + 规则。

**Tech Stack:** 现有栈（不变）

---

### Task 1: 类型 + 世界卡 + prompt

**Files:**
- Modify: `src/lib/types.ts` — 加 StoryBeat 类型，WorldCard 加 storyBeats
- Modify: `src/data/world-cards.ts` — 两张卡各加节拍链
- Modify: `src/app/api/adventure/route.ts` — prompt 注入节拍进度
- Modify: 测试文件 — 补 storyBeats 空数组

### Task 2: 验证
- tsc + vitest + build

---
name: technical-architecture
description: "项目技术架构全貌：技术栈选型、RSC+客户端岛屿架构、三层 Context 状态管理、SSE 流数据管道、路由体系、样式方案、测试策略"
---

# 技术架构

## 技术栈总览

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | Next.js (App Router) | 16.2.9 | 全栈框架，RSC + 客户端岛屿混合渲染 |
| 运行时 | React | 19.2.4 | UI 组件，Server Components + Client Components |
| 语言 | TypeScript | ^5 | 严格模式（`strict: true`），联合类型约束枚举 |
| 样式 | Tailwind CSS | ^4 | `@tailwindcss/postcss` 插件，零 JS 运行时主题切换 |
| AI SDK | Vercel AI SDK (`ai`) | ^6.0.206 | `streamText()` + Tool Use 协议，SSE 流式输出 |
| AI 提供商 | `@ai-sdk/anthropic` / `@ai-sdk/openai` / `@ai-sdk/openai-compatible` | ^3 | 多 provider 工厂函数，按协议分叉 |
| 数据校验 | Zod | ^4.4.3 | Tool Use schema 定义，v4 语法（record 双参数） |
| 图标 | `@lobehub/icons` | ^5.10.0 | AI 品牌图标（ModelIcon） |
| 测试 | Vitest | ^4.1.8 | 单元测试 + 组件测试 |
| 测试工具 | `@testing-library/react` + `jsdom` | ^16 / ^29 | 组件渲染 + DOM 断言 |
| 构建 | Turbopack | Next.js 内置 | 开发热更新（Fast Refresh） |
| 包管理 | npm | — | `package-lock.json` |

## 项目架构

### 总体模式：RSC 骨架 + 客户端岛屿

项目采用 Next.js App Router 的 **服务端组件（RSC）作为页面骨架，客户端组件作为交互岛屿** 的混合架构：

```
请求 → layout.tsx (RSC，SSR 主题 Cookie)
      → page.tsx (RSC，轻量页面壳)
        → 'use client' 岛屿 (交互逻辑、浏览器 API、状态管理)
```

**RSC 页面文件**（服务端渲染，无 `'use client'`）：
- `src/app/layout.tsx` — 根布局，SSR 注入 `data-theme`，挂载 `GameProvider`
- `src/app/page.tsx` — 首页，渲染 `HomeIsland`
- `src/app/game/page.tsx` — 游戏页，渲染 `GameScreen`
- `src/app/guide/page.tsx` — 玩家创作指南，纯静态文档页

**客户端岛屿**（`'use client'`，可访问浏览器 API）：
- `GameScreen.tsx` — SSE 流消费、EventBus、AbortController 生命周期
- `DialogueBox.tsx` — RAF 打字机动画、命令式 DOM 操作
- `HomeIsland.tsx` — 菜单交互、世界卡选择、游戏启动
- `SystemSettings.tsx` — API 配置面板、预设管理
- `OptionsPanel.tsx` — 选项按钮、自由文本输入
- `WorldCreator.tsx` — 世界卡创作台（6 标签页）
- `StatusPanel.tsx` — 侧边栏（属性/NPC/物品/旗标）
- `GameToolbar.tsx` — 游戏工具栏（存档/加载）
- `WorldCardSelector.tsx` — 世界卡选择器
- `NPCPanel.tsx` / `FlagPanel.tsx` / `InventoryPanel.tsx` — 信息弹窗
- `AccountButton.tsx` / `GlobalButtons.tsx` — 全局 UI 按钮
- `src/lib/*-context.tsx` — 所有 Context Provider

### 架构分层

```
┌──────────────────────────────────────────────────────┐
│  UI 层 (Components)                                  │
│  HomeIsland / GameScreen / WorldCreator / Settings   │
├──────────────────────────────────────────────────────┤
│  状态管理层 (Context)                                 │
│  AppConfigContext / PlayerStateContext / GamePlay     │
├──────────────────────────────────────────────────────┤
│  业务逻辑层 (Lib)                                     │
│  event-bus / theme / affinity / save-service         │
├──────────────────────────────────────────────────────┤
│  数据通路层 (API)                                     │
│  /api/adventure (SSE)  /api/saves/* (REST)          │
├──────────────────────────────────────────────────────┤
│  外部服务                                            │
│  AI Providers (Anthropic/OpenAI/DeepSeek/Custom)     │
└──────────────────────────────────────────────────────┘
```

## 目录结构

```
话世界/
├── src/
│   ├── app/                      # Next.js App Router 页面与 API 路由
│   │   ├── layout.tsx            # 根布局（RSC）：SSR theme cookie + GameProvider
│   │   ├── page.tsx              # 首页（RSC）：→ HomeIsland
│   │   ├── globals.css           # Tailwind v4 入口 + 4 套主题变量 + 全局样式
│   │   ├── game/page.tsx         # 游戏页（RSC）：→ GameScreen
│   │   ├── guide/page.tsx        # 创作指南（RSC）：纯静态文档
│   │   ├── creator/page.tsx      # 创作台（'use client'）：→ WorldCreator
│   │   └── api/                  # API 路由
│   │       ├── adventure/        # POST — AI 对话主接口（SSE 流）
│   │       ├── test-connection/  # POST — AI 连接测试
│   │       └── saves/            # 存档 REST API（6 条路由）
│   │           ├── register/     # 注册
│   │           ├── login/        # 登录
│   │           ├── save/         # 保存
│   │           ├── load/         # 加载
│   │           ├── delete/       # 删除
│   │           └── list/         # 列表
│   ├── components/               # 可复用 UI 组件（全部 'use client'）
│   │   ├── GameScreen.tsx        # 游戏主屏幕：SSE 流 + EventBus
│   │   ├── DialogueBox.tsx       # 打字机文本渲染（RAF 驱动）
│   │   ├── HomeIsland.tsx        # 首页：世界选择 + 游戏启动
│   │   ├── OptionsPanel.tsx      # 选项按钮 + 自由文本输入
│   │   ├── StatusPanel.tsx       # 侧边栏：属性/NPC/物品/旗标
│   │   ├── GameToolbar.tsx       # 游戏工具栏
│   │   ├── SystemSettings.tsx    # API 设置面板
│   │   ├── WorldCardSelector.tsx # 世界卡选择
│   │   ├── WorldCreator.tsx      # 世界卡创作台（6 标签页）
│   │   ├── NPCPanel.tsx          # NPC 关系弹窗
│   │   ├── FlagPanel.tsx         # 旗标弹窗
│   │   ├── InventoryPanel.tsx    # 物品栏弹窗
│   │   ├── AccountButton.tsx     # 账户登录
│   │   └── GlobalButtons.tsx     # 全局按钮组
│   ├── lib/                      # 业务逻辑 + 状态管理 + 工具
│   │   ├── types.ts              # 所有 TypeScript 类型定义
│   │   ├── game-context.tsx       # 向后兼容层：GameProvider + useGame()
│   │   ├── app-config-context.tsx # AppConfigContext（API 配置）
│   │   ├── player-state-context.tsx # PlayerStateContext（游戏状态）
│   │   ├── game-play-context.tsx  # GamePlayContext（对话/加载/错误）
│   │   ├── event-bus.ts          # 模块级事件总线（SSE → 打字机）
│   │   ├── theme.ts              # 主题/字号管理（三路写入）
│   │   ├── tool-schema.ts        # AI Tool Use 的 Zod schema
│   │   ├── create-model-instance.ts # Provider 工厂函数
│   │   ├── save-service.ts       # 统一存档服务（在线/离线路由）
│   │   ├── storage.ts            # 本地存储抽象
│   │   ├── local-storage.ts      # localStorage 操作
│   │   ├── online-storage.ts     # 云端存档 API 调用
│   │   ├── server-save-utils.ts  # 服务端存档工具（MD5 哈希等）
│   │   ├── affinity.ts           # NPC 好感度计算
│   │   ├── favorability.ts       # NPC 好感度概率模型
│   │   ├── custom-cards.ts       # 自定义世界卡 CRUD
│   │   ├── app-config-context.tsx # API 配置 Context
│   │   └── __tests__/            # 单元测试
│   ├── data/                     # 静态数据
│   │   ├── world-cards.ts        # 预设世界卡（蒸汽苍穹/玉京风华）
│   │   └── __tests__/
│   └── components/__tests__/     # 组件测试
├── docs/                         # 项目文档
│   ├── as-built/                 # 业务文档 + 技术参考
│   └── superpowers/              # 设计文档与计划
├── package.json
├── tsconfig.json                 # TypeScript 严格模式 + @/* 别名
├── next.config.ts                # Next.js 配置
├── vitest.config.ts              # 测试配置（jsdom + @ 别名）
├── postcss.config.mjs            # Tailwind v4 PostCSS 插件
├── eslint.config.mjs             # ESLint 配置
└── CLAUDE.md                     # 项目指南（命令/规范/文档约束）
```

## 核心数据流

### AI 对话流水线（SSE 流）

```
用户输入文本
  │
  ▼
GameScreen.submitAction()
  │ 构建 Messages（最近 12 条 + 初始场景）
  │ 注入 System Prompt（世界设定 + 属性 + NPC + 物品 + 旗标 + 节拍链）
  ▼
fetch('/api/adventure', { method: 'POST', body: JSON.stringify(payload) })
  │
  ▼
/api/adventure/route.ts (Edge Runtime)
  │ streamText({ system, messages, tools: { update_state }, stopWhen: stepCountIs(2) })
  │ 第 1 步：AI 输出叙述文本（200-400 字）→ SSE text-delta
  │ 第 2 步：AI 调用 update_state tool → SSE tool-input-available
  ▼
客户端 SSE 解析器（本地实现的 readDataStream）
  │ 解析 text-delta → 推入 sharedEventBus.buffer
  │ 解析 tool-input-available → 解析 options/attributeChanges/...
  ▼
sharedEventBus (模块级单例)
  │ GameScreen 写入 → DialogueBox 读取
  │
  ├─→ DialogueBox：RAF 驱动逐字打字（requestAnimationFrame + DOM textContent）
  └─→ GameScreen：更新 state（options、属性变化、NPC 好感）
```

### 关键设计点

- **两轮往返**：`stopWhen: stepCountIs(2)` 确保 AI 输出叙述后立即调用 tool 并停止，不回环
- **模块级 EventBus**：`sharedEventBus` 是文件级单例，GameScreen 和 DialogueBox 通过它通信，不经过 React state
- **打字机脱离 React**：DialogueBox 的逐字动画走 RAF + `textContent` 命令式操作，不触发任何 setState
- **AbortController**：每轮请求前 abort 上一轮，防止过期响应覆盖新状态
- **降级兜底**：AI 未调用 tool 时，客户端注入默认"继续冒险"选项

## 状态管理架构

三个独立 Context，按变更频率物理隔离（详见 `state-management.md`）：

| Context | 变更频率 | 职责 |
|---------|---------|------|
| AppConfigContext | 用户手动操作 | API key、provider、model、saveMode、高级参数 |
| PlayerStateContext | 每次 AI 响应 | screen、worldCard、playerState、options、NPC 状态 |
| GamePlayContext | 用户交互 + AI 流结束 | dialogueHistory、isLoading、error |

`game-context.tsx` 作为向后兼容层，`GameProvider` 嵌套三层 Provider，`useGame()` 合并为旧 API。

## 路由体系

### 页面路由（App Router）

| 路径 | 渲染模式 | 组件 | 说明 |
|------|---------|------|------|
| `/` | RSC 壳 + 客户端岛屿 | `HomeIsland` | 首页：世界选择、游戏启动、菜单 |
| `/game` | RSC 壳 + 客户端岛屿 | `GameScreen` | 游戏主屏幕：AI 对话 |
| `/guide` | 纯 RSC | 内联组件 | 玩家创作指南（静态文档） |
| `/creator` | 客户端岛屿 | `WorldCreator` | 世界卡创作台 |

### API 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/adventure` | POST | AI 对话主接口，SSE 流式响应 |
| `/api/test-connection` | POST | 测试 AI provider 连接 |
| `/api/saves/register` | POST | 注册云端账户 |
| `/api/saves/login` | POST | 登录云端账户 |
| `/api/saves/save` | POST | 上传存档到云端 |
| `/api/saves/load` | POST | 从云端加载存档 |
| `/api/saves/delete` | POST | 删除云端存档 |
| `/api/saves/list` | POST | 列举云端存档列表 |

## 样式方案

### Tailwind v4 + CSS 主题变量

- **构建**：`@tailwindcss/postcss` 插件（Tailwind v4），无需 `tailwind.config.js`
- **主题**：4 套主题变量块（`globals.css`），通过 `data-theme` 属性切换，零 JS 运行时
- **SSR 同步**：`layout.tsx` 异步读取 cookie → `getThemeCookie()` → 注入 `<html data-theme={...}>`
- **三路写入**：`setTheme()` 同时更新 DOM 属性、localStorage、cookie
- **字号**：独立于主题管理，`fontSizes` 映射表 + `applyFontSize()` 函数

### 组件样式原则

- 组件使用 Tailwind 原子类，不定义独立样式文件
- 主题色通过 CSS 变量引用：`text-[var(--text-primary)]`、`bg-[var(--bg-card)]`、`border-[var(--border)]`
- 强调色：`text-[var(--accent)]`

## 测试策略

| 层级 | 工具 | 位置 | 说明 |
|------|------|------|------|
| 单元测试 | Vitest | `src/lib/__tests__/` | 业务逻辑：reducer、好感度、EventBus |
| 组件测试 | Vitest + Testing Library + jsdom | `src/components/__tests__/` | 组件渲染 + 交互断言 |
| API 测试 | Vitest | `src/app/api/**/__tests__/` | API 路由逻辑 |

**配置要点**：
- `vitest.config.ts` 通过 `@vitejs/plugin-react` 支持 JSX 转换
- `jsdom` 环境模拟浏览器 DOM
- `@` 别名映射到 `./src`（与 `tsconfig.json` 保持一致）

## 构建与运行

| 命令 | 说明 |
|------|------|
| `npm run dev` | Turbopack 开发服务器（`http://localhost:3000`） |
| `npm run build` | 生产构建（`next build`） |
| `npm run start` | 生产服务器（`next start`） |
| `npm run test` | 全部测试（`vitest run`，单次） |
| `npm run test:watch` | 测试监听模式（`vitest`） |
| `npm run lint` | ESLint 代码检查 |
| `npx tsc --noEmit` | TypeScript 类型检查 |

## 边界

本文件覆盖项目的技术选型、架构模式、目录结构、数据流路径和构建配置的全貌。

不覆盖：
- 各业务模块的具体逻辑（见对应 as-built 文档）
- React/Next.js 框架陷阱与最佳实践（见 `react-patterns.md`）
- 开发规范与组件拆分原则（见 `CLAUDE.md`）
- 具体功能的设计方案（见 `docs/superpowers/` 下的 spec 和 plan）

## 相关文档

→ ai-engine.md：AI 引擎的 Provider 选择、Tool Use 协议、SSE 流处理、API 配置面板
→ state-management.md：三层 Context 架构详解、reducer 守卫模式、向后兼容设计
→ event-bus-typewriter.md：EventBus 单例契约、RAF 打字机动画、SSE 解析器、降级兜底
→ theme-system.md：CSS data-theme 切换、SSR Cookie 同步、三路写入、字号管理
→ save-system.md：本地/云端存档、统一存档服务、6 条 REST API 路由
→ world-card-system.md：WorldCard 类型定义、预设卡、创作台、NPC 字段体系
→ npc-affinity-system.md：NPC 好感度等级、条件解析、概率模型
→ game-options-conditions.md：选项条件评估、六种运算符、延迟动画、自由文本输入
→ react-patterns.md：React 19 / Next.js 16 框架陷阱与最佳实践

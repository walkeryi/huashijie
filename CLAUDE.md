# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 沟通原则

- **不要随意推测论断，请查明事实后再诊断；事实不足时需要如实告诉我。**

## 常用命令

```bash
npm run dev          # 开发服务器 (Turbopack, http://localhost:3000)
npm run build        # 生产构建
npm run test         # 全部测试 (vitest run)
npm run test:watch   # 监听模式
npx vitest run path  # 单文件测试
npm run lint         # ESLint
npx tsc --noEmit     # 类型检查
```

## 文档约束

修改代码时必须遵守以下规则：

1. **业务文档完整性** — 修改代码涉及已有 as-built 文档覆盖的模块时，必须同步更新对应文档。
2. **文档按业务分类** — 一个完整的业务领域 = 一篇文档。不按文件模块切分，不跨业务拼凑。
3. **新增业务领域** — 新模块涉及 ≥3 个文件或 ≥2 个组件时，必须先创建对应的 as-built 业务文档。
4. **交叉引用** — 每篇业务文档末尾必须有"相关文档"章节，使用 `→ doc-name.md：关联说明` 格式引用其他业务文档。
5. **边界声明** — 每篇业务文档必须声明覆盖范围（本文件负责什么）和边界（不负责什么）。
6. **技术规范分离** — 框架陷阱、版本差异、构建配置等非业务内容归入 react-patterns.md（技术参考），不混入业务文档。
7. **UI 归属** — 组件的业务逻辑跟随所属领域文档，纯表现细节（className、布局、动画参数）不写入业务文档。
8. **废弃标记** — 函数/组件删除时在文档中标记 `[已删除]`，保留历史上下文，不直接抹去记录。

## 开发规范

开发新功能时必须遵守以下核心规范：

1. **逻辑与视图分离** — 数据获取、业务逻辑抽为自定义 Hook（如 `useWeather(city)`），组件只负责渲染，两者可独立修改和测试。
2. **单一职责** — 每个文件只做一件事，按变化频率和功能边界拆分，避免上帝组件。（详见「组件拆分原则」）
3. **状态最小化** — 只存不可计算的原始状态，可推导的值在渲染时计算，不存冗余 State。
4. **穷尽边界状态** — 异步/外部数据必须显式处理 Loading、Error、Empty 三态，Error Boundary 兜底，禁止白屏或未捕获异常。
5. **类型安全** — TypeScript 严格定义 Props/State/API 结构，用联合类型约束枚举值，杜绝 `any`。
6. **副作用清理** — 卸载时清理定时器、监听器和未完成请求；高频事件必须防抖/节流。

## 组件拆分原则

组件拆分应遵循**单一职责 + 变化频率 + 编程范式**三原则，而非按视觉位置或行数机械合并：

- **编程范式差异必须拆分** — 例如 DialogueBox 的 RAF 打字机动画（命令式 DOM 操作）与 GameScreen 的声明式渲染属于不同范式，必须独立。
- **变化频率一致可合并** — 纯展示组件若变化同步且无独立状态机，可合并（如 OptionsPanel、StatusPanel 等可合并为 GameHUD）。
- **不以行数或布局位置决定拆分** — 关键看职责边界和变更耦合度。

<!-- BUSINESS_LOGIC_INSTRUCTIONS:START -->
<business_logic_instructions>
当需要理解项目业务逻辑时，先检查下方业务文档列表中是否有相关文档。
根据 task 涉及的代码区域，匹配描述判断是否需要读取正文。

如何读取：
- 每篇文档头部有 YAML Frontmatter（name + description），是元数据的权威来源
- 使用 Read 工具读取对应文件路径
- 不要重复读取已读过的文档
- 优先用下方的描述判断相关性，仅在需要细节时才读取正文

技术规范问题（React/Next.js 框架行为）则查看技术参考列表。
</business_logic_instructions>
<!-- BUSINESS_LOGIC_INSTRUCTIONS:END -->

<!-- BUSINESS_DOCS_LIST:START -->
## 业务文档

- ai-engine: Provider 选择规则（anthropic/deepseek/openai/custom 的工厂函数和 SDK 包）、Tool Use 协议（update_state schema）、SSE 流处理（streamText/generateText）、/api/adventure 和 /api/test-connection 的路由内部逻辑、SystemSettings API 配置面板（预设切换/自定义预设/协议兼容）、AI SDK v6 API 差异 → docs/business/ai-engine.md
- event-bus-typewriter: sharedEventBus 模块级单例（GameScreen 写入、DialogueBox 读取的契约）、RAF 驱动的逐字打字动画（buffer + charIndex + requestAnimationFrame）、客户端 SSE 解析器（readDataStream 本地实现）、AbortController 生命周期、降级兜底（AI 未调用 tool 时注入默认选项） → docs/business/event-bus-typewriter.md
- game-options-conditions: GameOption 类型（6种条件字段）、OptionsPanel 的 evalCondition/checkOption（六种运算符+AND逻辑）、不可用选项的灰色+删除线渲染、800ms 延迟淡入动画、自由文本输入（200字符限制）、StoryBeat.preconditions 共用同一条件评估体系 → docs/business/game-options-conditions.md
- npc-affinity-system: 好感度等级体系（7级）、条件解析（6种运算符）、概率模型（性格系数9标签/请求等级5级/情境系数6种/仁慈模式）、冷却期规则、综合公式。覆盖 src/lib/affinity.ts 和 src/lib/favorability.ts → docs/business/npc-affinity-system.md
- save-system: 存档系统完整业务：本地存档（localStorage 3槽位+自动存档+JSON序列化）、云端存档（REST API + apiKey安全策略 + 密码管理）、服务端文件存储（MD5哈希 + JSON索引 + 账户验证）、统一存档服务（在线/离线路由 + 2秒防抖 + 失败回退 + 本地到云端迁移）、6条 /api/saves/* 路由、AccountButton 登录UI、StatusPanel 乐观更新存档UI → docs/business/save-system.md
- state-management: 三层 Context 架构（AppConfigContext / PlayerStateContext / GamePlayContext）、拆分原因和消费者关系、UPDATE_STATE reducer 的 optional 字段守卫模式、向后兼容的 useGame() 和 GameProvider、debouncedAutoSave 防抖逻辑、AppConfigContext 的 localStorage 持久化与历史数据迁移 → docs/business/state-management.md
- theme-system: CSS data-theme 属性切换（零 JS 运行时）、globals.css 中的四个主题变量块、SSR Cookie 同步（layout.tsx async cookies → getThemeCookie）、setTheme() 三路写入（DOM / localStorage / cookie）、字号管理（applyFontSize / FontSize / fontSizes 映射表） → docs/business/theme-system.md
- world-card-system: 世界卡完整业务：WorldCard 类型定义（15个字段+AttributeDef+NPCDef+StoryBeat）、2张预设世界卡（蒸汽苍穹/玉京风华）、自定义卡 localStorage CRUD、NPC 字段体系（12个核心字段+自定义字段+isCoreField检查）、StoryBeat 节拍链（preconditions+effects+unlocks）、WorldCreator 创作台（6标签页：世界观/属性/角色/物品&旗标/节拍链/预览）、HomeIsland 世界选择与游戏启动（START_GAME 初始化） → docs/business/world-card-system.md
<!-- BUSINESS_DOCS_LIST:END -->

<!-- TECH_REFS_LIST:START -->
## 技术参考

- context-management: LLM 对话上下文管理：多层架构（system prompt / 结构化记忆槽 / 窗口裁剪 / fallback）、设计决策记录、放弃的方案、未来规划 → docs/as-built/context-management.md
- deployment: 生产环境部署：阿里云 ECS（宝塔面板）、GitHub 仓库、Node.js + PM2 + Nginx、更新流程、常见问题 → docs/as-built/deployment.md
- react-patterns: React 19 and Next.js 16 specific patterns, Strict Mode pitfalls, async cookies, useRef, useOptimistic, RSC boundaries → docs/as-built/react-patterns.md
- technical-architecture: 项目技术架构全貌：技术栈选型、RSC+客户端岛屿架构、三层 Context 状态管理、SSE 流数据管道、路由体系、样式方案、测试策略 → docs/as-built/technical-architecture.md
<!-- TECH_REFS_LIST:END -->

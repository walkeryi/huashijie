# 业务文档体系补全方案

## Context

当前 docs/as-built/ 有 5 篇文档，覆盖约 40% 的业务逻辑。主要问题：
- 6 个业务系统完全无文档（存档、好感度、世界卡、选项条件、字号、UI 面板）
- 文档间零交叉引用，改一个模块时无法追溯影响链
- 文档按文件模块切分而非业务领域，导致碎片化
- CLAUDE.md 缺少"修改代码 → 同步文档"的自动约束规则

## 核心原则

**一个完整的业务领域 = 一篇文档。文件不跨文档，文档不跨业务。**

与此冲突的内容必须纠正：react-patterns.md 不是业务文档（是技术规范），从业务索引中分离出去。

## 最终文档体系（8 业务 + 1 技术参考）

```
docs/as-built/
├── ai-engine.md                  (更新) AI 引擎
├── state-management.md           (更新) 状态管理
├── event-bus-typewriter.md       (更新) 打字机与事件流
├── theme-system.md               (更新) 主题与字号系统
├── save-system.md                (新增) 存档系统
├── world-card-system.md          (新增) 世界卡系统
├── npc-affinity-system.md        (新增) NPC 好感度系统
├── game-options-conditions.md    (新增) 游戏选项与条件系统
└── react-patterns.md             (保留) 技术规范参考
```

## 实施步骤

### 第一阶段：CLAUDE.md 约束规则（最先做）

在 CLAUDE.md 中新增以下约束：

```xml
## 文档约束

1. **业务文档完整性**：修改代码涉及已有文档覆盖的模块时，必须同步更新文档。

2. **文档按业务分类**：一个完整的业务领域 = 一篇文档。不按文件模块切分。

3. **新增业务领域**：新模块涉及 ≥3 个文件或 ≥2 个组件时，必须先创建业务文档。

4. **交叉引用**：文档末尾必须有"相关文档"章节，使用 `→ doc-name.md：关联说明` 格式。

5. **边界声明**：每篇文档必须声明覆盖范围和不覆盖的内容。

6. **技术规范分离**：框架陷阱、版本差异等非业务内容归入 react-patterns.md。

7. **UI 归属**：组件的业务逻辑跟随所属领域文档，纯表现细节不写入。

8. **废弃标记**：删除函数/组件时在文档中标记废弃，不直接抹去记录。
```

同时修正现有拼写错误（`deadbounceAutoSave` → `debouncedAutoSave`），将 react-patterns 从 `<available_business_logic>` 移到独立的 `<available_technical_references>` 区段。

### 第二阶段：新增 4 篇业务文档（可并行）

| # | 文档 | 覆盖范围 | 工作量 |
|---|------|---------|--------|
| 1 | **save-system.md** | local-storage.ts + online-storage.ts + server-save-utils.ts + save-service.ts + 6条 /api/saves/* 路由 + AccountButton.tsx + StatusPanel 存档UI | 大 |
| 2 | **world-card-system.md** | types.ts 中 WorldCard 等类型 + world-cards.ts + custom-cards.ts + WorldCreator.tsx（6标签页）+ WorldCardSelector.tsx + HomeIsland 启动逻辑 | 大 |
| 3 | **npc-affinity-system.md** | affinity.ts（概率模型+性格系数+冷却期）+ favorability.ts（7级等级+条件解析+标签） | 中 |
| 4 | **game-options-conditions.md** | GameOption 类型 + OptionsPanel.tsx 的 evalCondition/checkOption + 六种条件检查 + 800ms 延迟 + 自由输入 + StoryBeat.preconditions 共用条件体系 | 中 |

### 第三阶段：更新 4 篇已有文档（可并行）

| # | 文档 | 更新内容 | 工作量 |
|---|------|---------|--------|
| 5 | **theme-system.md** | 补充字号管理（applyFontSize/loadFontSize/saveFontSize/FontSize/fontSizes） | 小 |
| 6 | **state-management.md** | 展开 AppConfigContext（持久化/迁移/污染检测）+ GamePlayContext（dialogueHistory/isLoading）+ 交叉引用新增文档 | 中 |
| 7 | **ai-engine.md** | 补 API 配置面板逻辑（PRESETS/自定义预设/协议兼容）+ 连接测试全链路 + 自动填充检测 + 交叉引用 | 中 |
| 8 | **event-bus-typewriter.md** | 补 SSE 解析器实现细节（AsyncGenerator/分帧解析）+ 交叉引用新增文档 | 小 |

### 第四阶段：收尾

- 删除 types.ts 中的死代码 `AIResponse` 接口
- 运行 `npm test` 确认无回归

## 交叉引用关系（关键）

每篇文档末尾"相关文档"章节的最低要求：

| 文档 | 必须引用 |
|------|---------|
| ai-engine | state-management, save-system, world-card-system |
| state-management | save-system, game-options-conditions |
| event-bus-typewriter | state-management, game-options-conditions, save-system |
| theme-system | （独立，无强依赖） |
| save-system | state-management, ai-engine |
| world-card-system | ai-engine, npc-affinity-system, game-options-conditions |
| npc-affinity-system | world-card-system, game-options-conditions, state-management |
| game-options-conditions | npc-affinity-system, event-bus-typewriter, state-management, world-card-system |

## 验证

- [ ] CLAUDE.md 约束规则可被 grep 到
- [ ] 4 篇新文档的 frontmatter（name + description）完备
- [ ] 8 篇文档间交叉引用无断链
- [ ] react-patterns 已从业务索引中分离
- [ ] deadbounceAutoSave 拼写已修正
- [ ] npm test 全部通过

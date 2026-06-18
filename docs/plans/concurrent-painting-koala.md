# 渐进式披露文档体系

**Context:** 当前 CLAUDE.md 把所有架构细节塞在一个文件里，每会话全量加载。按用户指定的 Metadata + Content 两层结构重构。

## 文件结构

```
CLAUDE.md                          # 命令 + <available_business_logic> 索引
docs/as-built/
├── ai-engine.md                   # AI 引擎：Provider 选择、Tool Use、SSE 流
├── state-management.md            # 状态管理：三层 Context、Reducer、Optional 守卫
├── event-bus-typewriter.md        # 打字机：EventBus 单例、RAF 循环、SSE 解析
├── theme-system.md                # 主题系统：CSS data-theme、Cookie SSR 同步
└── react-patterns.md              # React 19 / Next 16 陷阱和注意事项
```

## 每份文档格式

```markdown
---
name: ai-engine
description: "Provider selection rules for anthropic/deepseek/openai/custom, Tool Use protocol, SSE stream handling in /api/adventure and /api/test-connection"
---

# 正文（Markdown）
```

## CLAUDE.md 结构

1. 标准前缀
2. 常用命令
3. `<business_logic_instructions>` — 指导 Agent 如何按需加载
4. `<available_business_logic>` — 索引清单（name + description + location）

## 实施步骤

1. 写 `docs/as-built/ai-engine.md`
2. 写 `docs/as-built/state-management.md`
3. 写 `docs/as-built/event-bus-typewriter.md`
4. 写 `docs/as-built/theme-system.md`
5. 写 `docs/as-built/react-patterns.md`
6. 重构 CLAUDE.md

# 文件夹结构重构 — 最多三级

## 目标

项目文件夹从当前最深 5 级压缩到最多 3 级（相对项目根目录）。

## 当前最深路径

```
src/app/api/adventure/choices/route.ts   ← 5 级
src/app/api/saves/save/route.ts          ← 5 级
src/components/__tests__/                ← 3 级（测试迁移后消失）
docs/superpowers/plans/                  ← 3 级
```

## 重构方案

### 一、API 路由合并（核心改动）

**Adventure** — 合并为单一路由，根据 `body.stage` 内部分发：

```
删除: src/app/api/adventure/{plan,narrate,choices,extract-facts}/route.ts
      src/app/api/adventure/__tests__/

新增: src/app/api/adventure/route.ts           ← 3 级
      src/lib/adventure-plan.ts                ← 业务逻辑
      src/lib/adventure-narrate.ts             ← 业务逻辑
      src/lib/adventure-choices.ts             ← 业务逻辑
      src/lib/adventure-extract-facts.ts       ← 业务逻辑
```

route.ts 分发逻辑：读取 `body.stage`，路由到对应的 lib 处理函数。

客户端 GameScreen.tsx 改动：
- 4 处 fetch URL 从 `/api/adventure/{stage}` → `/api/adventure`
- 每个请求体追加 `stage: "plan" | "narrate" | "choices" | "extract-facts"`

**Saves** — 合并为单一路由，根据 `body.action` 内部分发：

```
删除: src/app/api/saves/{save,load,list,delete,login,register}/route.ts

新增: src/app/api/saves/route.ts              ← 3 级
```

6 个 handler 逻辑简单（每个 ~20 行），合并到一个文件。分发依据 `body.action`。

客户端 online-storage.ts 改动：
- `apiCall('/register', ...)` → `apiCall('register', ...)`（action 参数化）

### 二、测试集中到 tests/

```
删除: src/__tests__/
      src/components/__tests__/
      src/lib/__tests__/
      src/data/__tests__/
      src/app/api/adventure/__tests__/

新增: tests/
      tests/components/  — SystemSettings.test.tsx
      tests/lib/         — affinity, event-bus, favorability, game-reducer, storage
      tests/data/        — world-cards.test.ts
      tests/api/         — adventure route.test.ts
```

vitest.config.ts 无需改动（glob 模式 `**/*.test.*` 自动匹配）。

测试文件内部的 import 路径 `@/lib/...`、`@/components/...` 不变。

### 三、docs 扁平化

```
删除: docs/as-built/
      docs/business/
      docs/superpowers/

移动: 所有 .md → docs/
```

最终 docs/ 下 32 个 .md 文件平铺。文档间交叉引用 `→ xxx.md` 不需改（已在同一目录）。

### 四、清理空目录

- `src/app/api/adventure/choices/` 等目录删除（路由合并后）
- `src/app/api/saves/save/` 等目录删除

## 影响范围

| 类型 | 文件数 | 改动 |
|------|--------|------|
| API 路由文件 | 10 删, 2 增 | adventure (4→1), saves (6→1) |
| lib 业务逻辑 | 4 增 | 提取 adventure handler |
| 客户端 fetch | 2 改 | GameScreen.tsx, online-storage.ts |
| 测试文件 | 8 移 | src/*/__tests__ → tests/ |
| 文档 | 32 移 | 全部放 docs/ |
| import 引用 | ~0 改 | `@/` 别名不受影响 |

## 验收

- `find . -type d -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.next/*'` 深度检查
- `npx tsc --noEmit` 通过
- `npm run lint` 通过
- `npm run test` 130 tests 通过
- `npm run dev` 启动成功，手动测试游戏循环

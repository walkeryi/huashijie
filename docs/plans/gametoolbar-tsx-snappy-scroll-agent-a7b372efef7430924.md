# React 19 模式审查计划

## 审查范围
6 个文件，对照 `docs/as-built/react-patterns.md` 的 5 项规范逐项核查。

## 发现的问题（共 5 项）

### 1. [HIGH] GameScreen.tsx:201-203 — useEffect cleanup 中 abort（违反规范）
### 2. [HIGH] game-context.tsx:18-40 + 所有消费组件 — useGame() 聚合层未 memoize，三层 Context 拆分失效
### 3. [MEDIUM] GameScreen.tsx:50-198 — submitAction 在每次 re-render 时重建
### 4. [LOW] DialogueBox.tsx:126-136 — 打字机中断时当前帧内容丢失（设计边界）
### 5. [LOW] GameScreen.tsx:214-225 — 首帧 useEffect 依赖过宽

## 规范符合性总结
- useRef 初始值：✅ 全部正确
- useEffect abort 反模式：❌ GameScreen 违反
- useOptimistic 在 transition 内：✅ GameToolbar 正确
- 不必要 re-render：❌ useGame() 聚合使 Context 拆分失效
- RSC/client 边界：✅ 正确

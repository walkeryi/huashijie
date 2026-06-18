# 代码审查计划

## 背景
用户请求对当前工作区变更进行代码审查。审查范围是 `git diff HEAD` 输出的未提交修改，涉及 AI provider 适配、EventBus 单例化、PlayerState reducer 可选字段化、调试日志增强等。

## 审查方法
按已启动的 `code-review` skill（medium effort）执行：
1. **Phase 0** — 已收集 `git diff HEAD`。
2. **Phase 1** — 运行 7 个 finder 角度：
   - A: 逐行 diff 扫描（条件、null、await、错误处理等）
   - B: 删除行为审计（原 anthropic/openai SDK 调用、AbortController cleanup 等）
   - C: 跨文件追踪（调用方是否受新可选字段 / 新返回值影响）
   - Reuse / Simplification / Efficiency / Altitude 各一个角度
3. **Phase 2** — 去重并用 verifier 确认每个候选。
4. 输出 JSON 数组（最多 10 条），按严重度排序。

## 关键文件
- `src/app/api/adventure/route.ts`
- `src/app/api/test-connection/route.ts`
- `src/components/GameScreen.tsx`
- `src/components/DialogueBox.tsx`
- `src/lib/event-bus.ts`
- `src/lib/player-state-context.tsx`
- `src/lib/types.ts`
- `src/components/SystemSettings.tsx`
- `src/components/__tests__/SystemSettings.test.tsx`
- `package.json` / `package-lock.json`

## 验证
最终返回 JSON findings，不涉及工作区修改（未使用 `--fix`）。

# 架构重构：静态系统提示词 + 动态状态简报

## 已完成

`src/app/api/adventure/route.ts`：
- `buildSystemPrompt(worldCard)` — 只接受 worldCard，返回静态规则
- `buildStateSummary(worldCard, playerState, npcAffinities)` — 一行紧凑状态简报
- `buildMessages(dialogueHistory, worldCard, stateSummary)` — 最后一条用户消息末尾附状态简报 + 工具提醒
- 去掉 `slice(-12)` 截断
- 去掉 `sanitizePlayerName`（不再需要）
- 去掉 `npcRuntime` 参与提示词（从未使用）

## 待完成

### 1. 测试文件 `src/app/api/adventure/__tests__/route.test.ts`

旧测试调用 `buildSystemPrompt(card, player, {})`，新 API 只有 `buildSystemPrompt(card)`。

需要：
- `buildSystemPrompt` 的一组测试：世界设定、工具指令、叙述规则 → 调用改为 `buildSystemPrompt(card)`
- 删除"玩家名"测试（系统提示词不再含玩家名）
- 删除"sanitize player name"测试（该函数已删除）
- 删除"物品栏"测试（移到了 stateSummary）
- 删除"旗标"测试（移到了 stateSummary）
- 删除"NPC 关系"测试（移到了 stateSummary）
- 新增 `buildStateSummary` 的一组测试：属性值、NPC 好感度、物品、旗标、主角色过滤、紧凑单行

### 2. 运行测试验证

```bash
npx vitest run
```

### 3. 重启 dev server，浏览器测试

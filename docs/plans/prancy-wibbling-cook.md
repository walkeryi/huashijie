# 角色字段三分类 — UI 改进

## 改动

仅改 `src/components/WorldCreator.tsx` 的 CharacterTab 组件。

### 字段三分类

| 分类 | 包含字段 | 可编辑名称 | 可编辑说明 | 可删除 |
|------|---------|-----------|-----------|--------|
| 🔒 核心 | id, name, gender, origin, dialogueTone | ❌ | ❌ | ❌ |
| 📌 固定 | birthday, dialogueExamples, personalityTags, appearance, currentAttire, initialAffinity | ❌ | ✅ | ✅ |
| ✨ 自定义 | 玩家添加的字段 | ✅ | ✅ | ✅ |

### 字段行外观

每行统一结构：
```
[字段名]  [🔒/📌/✨标签]  [说明文本]  [值输入]  [✕删除]
```

- 核心：名称固定、说明固定、无删除
- 固定：名称固定、说明可编辑、有删除
- 自定义：名称可编辑、说明可编辑、有删除

### 底部两个空添加槽

固定两个空位，每个包含：
- 字段名称 input
- 说明或填写示例 input  
- 添加按钮（填好点添加→加入角色→空位重置）

### 验证

- `npx vitest run` 全部通过
- `npm run dev` 创作台角色标签 UI 正确

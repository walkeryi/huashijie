# 计划：编写 npc-affinity-system.md 业务文档

## 目标
根据已读取的 4 个源文件，编写 `docs/as-built/npc-affinity-system.md`，覆盖 NPC 好感度系统的完整业务逻辑。

## 文档结构

1. **Frontmatter** — name + description
2. **等级体系** — 7 级 AffinityTier（hatred→intimate），阈值范围，中文标签，getAffinityTier 从高到低匹配顺序
3. **条件解析** — parseAffinityCondition（6 种运算符 regex），checkAffinityCondition，checkAllAffinityConditions 批量 AND
4. **钳制与批量更新** — clampAffinity [-100,100]，applyAffinityChanges 只处理已存在 NPC，不修改原始对象
5. **概率模型详解**：
   - mapAffinityToBaseProbability（7 段映射表）
   - 性格系数（9 标签，取最小值规则）
   - 请求等级（5 级系数表）
   - 情境系数（6 种情境表）
   - 仁慈模式（affinity >= 80 保护）
   - 综合公式 computeComplianceProbability + 最终钳制 [0.02, 0.98]
6. **冷却期** — 3 天阈值，变化绝对值 >= 20，减半规则
7. **变化量计算** — computeAffinityChange，5 种事件类型
8. **关键设计决策**
9. **边界声明**
10. **相关文档** — 3 个交叉引用

## 已读取的文件
- `src/lib/affinity.ts` — 概率模型核心
- `src/lib/favorability.ts` — 等级体系、条件解析、批量更新
- `src/lib/__tests__/affinity.test.ts` — 测试用例验证边界条件
- `src/lib/__tests__/favorability.test.ts` — 测试用例验证边界条件

## 编写步骤
1. 整合所有源文件的信息，确保文档精确反映代码实现
2. 写入到 `C:\Users\ASUS\Desktop\话世界\docs\as-built\npc-affinity-system.md`
3. 确认文档包含要求的所有章节和交叉引用

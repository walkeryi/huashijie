# 修复计划：按 spec 创建 affinity.ts 概率函数模块

## 背景
Task 3 实施者错误地创建了 `src/lib/favorability.ts`（钳制/分类/条件解析工具），而不是 spec 要求的 `src/lib/affinity.ts`（5个概率计算函数）。现有 `favorability.ts` 中的有用函数（clampAffinity, getAffinityTier, parseAffinityCondition 等）全部保留。

## 步骤

### 1. 创建 `src/lib/affinity.ts`
按照 spec 粘贴的代码，创建 5 个函数：
- `mapAffinityToBaseProbability(affinity)` — 好感度到基础概率的映射
- `personalityComplianceCoefficient(personalityTags)` — 性格系数（取最不配合的性格标签的系数）
- `computeComplianceProbability(input: ComplianceInput)` — 核心合规概率公式
- `computeAffinityChange(event: AffinityChangeEvent)` — 好感度变化计算
- `applyCooldown(change, lastMajorEventDay, currentDay)` — 冷却期减半

常量表：
- `PERSONALITY_COEFFICIENTS`: 顺从/温和/忠诚=1.3, 正直/勇敢=1.0, 谨慎/多疑=0.85, 叛逆/傲慢=0.6
- `REQUEST_COEFFICIENTS`: trivial=1.2, normal=1.0, important=0.8, major=0.5, extreme=0.2
- `SITUATION_COEFFICIENTS`: private=1.0, public=0.7, aligned=1.3, saved=1.5, coerced=0.5, lifeThreatened=0.3

亲和度 >= 80 时，request 和 situation 系数不会降到 1.0 以下（仁慈模式）。
最终概率钳制在 [0.02, 0.98]。

### 2. 创建 `src/lib/__tests__/affinity.test.ts`
包含所有 5 个函数的测试用例：
- `mapAffinityToBaseProbability`: 各个区间的边界值和中间值
- `personalityComplianceCoefficient`: 各种性格标签组合，空数组返回 1.0
- `computeComplianceProbability`: 组合测试，边界测试，仁慈模式测试
- `computeAffinityChange`: 不同类型的事件，正负号验证
- `applyCooldown`: 冷却期内外行为，边界值测试

### 3. 运行测试
执行 `npx vitest run`，确认所有测试（包括已有的 favorability.test.ts）全部 PASS。

### 4. Commit
提交消息格式参考项目历史。

## 文件变更清单
| 操作 | 文件路径 |
|------|---------|
| 创建 | `src/lib/affinity.ts` |
| 创建 | `src/lib/__tests__/affinity.test.ts` |

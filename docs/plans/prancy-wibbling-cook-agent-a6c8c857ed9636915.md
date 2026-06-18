# 计划: Task 3 — 好感度算法模块

## 目标
在 `src/lib/affinity.ts` 中实现好感度算法模块，包含：
1. `mapAffinityToBaseProbability` — 好感度映射为基础概率
2. `personalityComplianceCoefficient` — 人格标签映射为顺从系数
3. `computeComplianceProbability` — 综合计算顺从概率
4. `computeAffinityChange` — 好感度变化计算
5. `applyCooldown` — 冷却时间衰减

## 步骤

### Step 1: 创建测试文件
- 文件: `src/lib/__tests__/affinity.test.ts`
- 内容: 见任务描述中的测试代码

### Step 2: 跑测试确认失败
- 命令: `npx vitest run src/lib/__tests__/affinity.test.ts`
- 预期: 测试失败（因为尚无实现文件）

### Step 3: 创建实现文件
- 文件: `src/lib/affinity.ts`
- 内容: 见任务描述中的实现代码

### Step 4: 跑测试确认通过
- 命令: `npx vitest run src/lib/__tests__/affinity.test.ts`
- 预期: 所有测试通过

### Step 5: Commit
- 命令: `git add src/lib/affinity.ts src/lib/__tests__/affinity.test.ts` + `git commit -m "feat(affinity): 好感度概率算法+映射表+变化规则"`

## 依赖项检查
- vitest 已在 package.json 中配置
- 项目已有 `src/lib/__tests__/` 目录结构
- 无误

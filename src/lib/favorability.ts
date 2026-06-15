// ========== 好感度算法模块 ==========

/** 好感度最小值 */
export const AFFINITY_MIN = -100 as const

/** 好感度最大值 */
export const AFFINITY_MAX = 100 as const

/**
 * 好感度等级
 * - hatred:     -100 ~ -80  仇恨
 * - dislike:    -79  ~ -41  厌恶
 * - cold:       -40  ~ -1   冷淡
 * - neutral:    0           中立
 * - friendly:   1    ~ 20   友善
 * - warm:       21   ~ 60   友好
 * - intimate:   61   ~ 100  亲密
 */
export type AffinityTier =
  | 'hatred'
  | 'dislike'
  | 'cold'
  | 'neutral'
  | 'friendly'
  | 'warm'
  | 'intimate'

/** 各等级对应的中文标签 */
const TIER_LABELS: Record<AffinityTier, string> = {
  hatred: '仇恨',
  dislike: '厌恶',
  cold: '冷淡',
  neutral: '中立',
  friendly: '友善',
  warm: '友好',
  intimate: '亲密',
}

/** 等级阈值下限（包含） */
const TIER_THRESHOLDS: { min: number; tier: AffinityTier }[] = [
  { min: -100, tier: 'hatred' },
  { min: -79, tier: 'dislike' },
  { min: -40, tier: 'cold' },
  { min: 0, tier: 'neutral' },
  { min: 1, tier: 'friendly' },
  { min: 21, tier: 'warm' },
  { min: 61, tier: 'intimate' },
]

/**
 * 将好感度值钳制在 [-100, 100] 范围内
 */
export function clampAffinity(value: number): number {
  return Math.max(AFFINITY_MIN, Math.min(value, AFFINITY_MAX))
}

/**
 * 根据好感度值返回对应的等级
 */
export function getAffinityTier(affinity: number): AffinityTier {
  const clamped = clampAffinity(affinity)
  // 从高到低匹配
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (clamped >= TIER_THRESHOLDS[i].min) {
      return TIER_THRESHOLDS[i].tier
    }
  }
  return 'hatred'
}

/**
 * 返回好感度等级的中文标签
 */
export function getAffinityLabel(affinity: number): string {
  return TIER_LABELS[getAffinityTier(affinity)]
}

/**
 * 批量应用好感度变化，结果自动钳制在合法范围内
 * 只处理 base 中已存在的 key，忽略未知 NPC 的变化
 */
export function applyAffinityChanges(
  base: Record<string, number>,
  changes: Record<string, number>,
): Record<string, number> {
  const result = { ...base }
  for (const [key, delta] of Object.entries(changes)) {
    if (key in result) {
      result[key] = clampAffinity(result[key] + delta)
    }
  }
  return result
}

/**
 * 解析好感度条件字符串，例如 ">= 40" → { operator: '>=', value: 40 }
 * 支持运算符：>=, <=, >, <, ==, !=
 */
export function parseAffinityCondition(condition: string): { operator: string; value: number } {
  const trimmed = condition.trim()
  const match = trimmed.match(/^(!=|>=|<=|>|<|==)\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) {
    throw new Error(`Invalid affinity condition format: "${condition}"`)
  }
  return { operator: match[1], value: Number(match[2]) }
}

/**
 * 检查单个好感度值是否满足条件字符串
 */
export function checkAffinityCondition(affinity: number, condition: string): boolean {
  const { operator, value } = parseAffinityCondition(condition)
  switch (operator) {
    case '>=': return affinity >= value
    case '<=': return affinity <= value
    case '>':  return affinity > value
    case '<':  return affinity < value
    case '==': return affinity === value
    case '!=': return affinity !== value
    default:   return false
  }
}

/**
 * 批量检查多个 NPC 的好感度条件
 * 所有条件均通过返回 true，任一不通过返回 false
 * 如果检查的 NPC 不在 affinities 中则视为不通过
 */
export function checkAllAffinityConditions(
  affinities: Record<string, number>,
  checks: Record<string, string>,
): boolean {
  for (const [npcId, condition] of Object.entries(checks)) {
    if (!(npcId in affinities)) return false
    if (!checkAffinityCondition(affinities[npcId], condition)) return false
  }
  return true
}

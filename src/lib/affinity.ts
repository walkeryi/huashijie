// ========== 好感度概率算法模块 ==========

/**
 * 将好感度值映射为基础依从概率
 * 好感度越高，基础概率越高
 */
export function mapAffinityToBaseProbability(affinity: number): number {
  const clamped = Math.max(-100, Math.min(100, affinity))
  if (clamped >= 80) return 0.95
  if (clamped >= 60) return 0.85
  if (clamped >= 40) return 0.70
  if (clamped >= 20) return 0.55
  if (clamped >= 0) return 0.40
  if (clamped >= -50) return 0.20
  return 0.05
}

/** 各性格标签对应的依从系数 */
const PERSONALITY_COEFFICIENTS: Record<string, number> = {
  '顺从': 1.3, '温和': 1.3, '忠诚': 1.3,
  '正直': 1.0, '勇敢': 1.0,
  '谨慎': 0.85, '多疑': 0.85,
  '叛逆': 0.6, '傲慢': 0.6,
}

/**
 * 计算性格依从系数
 * 取所有性格标签中最小的系数（最不配合的性格起决定作用）
 * 空数组返回 1.0
 */
export function personalityComplianceCoefficient(personalityTags: string[]): number {
  if (personalityTags.length === 0) return 1.0
  let min = 1.0
  for (const tag of personalityTags) {
    const c = PERSONALITY_COEFFICIENTS[tag]
    if (c !== undefined && c < min) min = c
  }
  return min
}

/** 请求等级对应的系数 */
const REQUEST_COEFFICIENTS: Record<string, number> = {
  trivial: 1.2, normal: 1.0, important: 0.8, major: 0.5, extreme: 0.2,
}

/** 情境对应的系数 */
const SITUATION_COEFFICIENTS: Record<string, number> = {
  private: 1.0, public: 0.7, aligned: 1.3, saved: 1.5, coerced: 0.5, lifeThreatened: 0.3,
}

export interface ComplianceInput {
  affinity: number
  personalityTags: string[]
  requestLevel: 'trivial' | 'normal' | 'important' | 'major' | 'extreme'
  situation: 'private' | 'public' | 'aligned' | 'saved' | 'coerced' | 'lifeThreatened'
}

/**
 * 计算综合依从概率
 * 核心公式：base * personality * request * situation
 * 好感度 >= 80 时启用仁慈模式：request 和 situation 系数不会低于 1.0
 * 最终概率钳制在 [0.02, 0.98]
 */
export function computeComplianceProbability(input: ComplianceInput): number {
  const base = mapAffinityToBaseProbability(input.affinity)
  const personality = personalityComplianceCoefficient(input.personalityTags)
  let request = REQUEST_COEFFICIENTS[input.requestLevel] ?? 1.0
  let situation = SITUATION_COEFFICIENTS[input.situation] ?? 1.0
  if (input.affinity >= 80) {
    if (request < 1.0) request = 1.0
    if (situation < 1.0) situation = 1.0
  }
  const raw = base * personality * request * situation
  return Math.max(0.02, Math.min(0.98, raw))
}

export interface AffinityChangeEvent {
  type: 'dialogue' | 'wishFulfilled' | 'betrayal' | 'saved' | 'warningIgnored'
  magnitude: number
}

/**
 * 计算好感度变化值
 * dialogue / wishFulfilled / saved 为正变化
 * betrayal / warningIgnored 为负变化
 */
export function computeAffinityChange(event: AffinityChangeEvent): number {
  switch (event.type) {
    case 'dialogue': return event.magnitude
    case 'wishFulfilled': return event.magnitude
    case 'betrayal': return -event.magnitude
    case 'saved': return event.magnitude
    case 'warningIgnored': return -event.magnitude
    default: return 0
  }
}

/**
 * 应用冷却期规则
 * 如果上次重大事件距今不超过 3 天，且变化绝对值 >= 20，则将变化减半
 */
export function applyCooldown(change: number, lastMajorEventDay: number | null, currentDay: number): number {
  if (lastMajorEventDay !== null && Math.abs(change) >= 20 && (currentDay - lastMajorEventDay) <= 3) {
    return Math.round(change / 2)
  }
  return change
}

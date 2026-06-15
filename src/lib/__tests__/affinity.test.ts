import { describe, it, expect } from 'vitest'
import {
  mapAffinityToBaseProbability,
  personalityComplianceCoefficient,
  computeComplianceProbability,
  computeAffinityChange,
  applyCooldown,
} from '../affinity'

describe('mapAffinityToBaseProbability', () => {
  it('returns 0.95 for affinity >= 80', () => {
    expect(mapAffinityToBaseProbability(80)).toBe(0.95)
    expect(mapAffinityToBaseProbability(90)).toBe(0.95)
    expect(mapAffinityToBaseProbability(100)).toBe(0.95)
  })

  it('returns 0.85 for affinity 60~79', () => {
    expect(mapAffinityToBaseProbability(60)).toBe(0.85)
    expect(mapAffinityToBaseProbability(70)).toBe(0.85)
    expect(mapAffinityToBaseProbability(79)).toBe(0.85)
  })

  it('returns 0.70 for affinity 40~59', () => {
    expect(mapAffinityToBaseProbability(40)).toBe(0.70)
    expect(mapAffinityToBaseProbability(50)).toBe(0.70)
    expect(mapAffinityToBaseProbability(59)).toBe(0.70)
  })

  it('returns 0.55 for affinity 20~39', () => {
    expect(mapAffinityToBaseProbability(20)).toBe(0.55)
    expect(mapAffinityToBaseProbability(30)).toBe(0.55)
    expect(mapAffinityToBaseProbability(39)).toBe(0.55)
  })

  it('returns 0.40 for affinity 0~19', () => {
    expect(mapAffinityToBaseProbability(0)).toBe(0.40)
    expect(mapAffinityToBaseProbability(10)).toBe(0.40)
    expect(mapAffinityToBaseProbability(19)).toBe(0.40)
  })

  it('returns 0.20 for affinity -50~-1', () => {
    expect(mapAffinityToBaseProbability(-50)).toBe(0.20)
    expect(mapAffinityToBaseProbability(-25)).toBe(0.20)
    expect(mapAffinityToBaseProbability(-1)).toBe(0.20)
  })

  it('returns 0.05 for affinity < -50', () => {
    expect(mapAffinityToBaseProbability(-51)).toBe(0.05)
    expect(mapAffinityToBaseProbability(-80)).toBe(0.05)
    expect(mapAffinityToBaseProbability(-100)).toBe(0.05)
  })

  it('clamps values above 100 to 100', () => {
    expect(mapAffinityToBaseProbability(150)).toBe(0.95)
  })

  it('clamps values below -100 to -100', () => {
    expect(mapAffinityToBaseProbability(-200)).toBe(0.05)
  })
})

describe('personalityComplianceCoefficient', () => {
  it('returns 1.0 for empty tags', () => {
    expect(personalityComplianceCoefficient([])).toBe(1.0)
  })

  it('returns 1.0 for compliant-only personalities (温和, only reduces from 1.0)', () => {
    expect(personalityComplianceCoefficient(['温和'])).toBe(1.0)
  })

  it('returns 1.0 for compliant-only personalities (顺从)', () => {
    expect(personalityComplianceCoefficient(['顺从'])).toBe(1.0)
  })

  it('returns 1.0 for neutral personalities (正直)', () => {
    expect(personalityComplianceCoefficient(['正直'])).toBe(1.0)
  })

  it('returns 0.85 for cautious personalities (谨慎)', () => {
    expect(personalityComplianceCoefficient(['谨慎'])).toBe(0.85)
  })

  it('returns 0.6 for resistant personalities (叛逆)', () => {
    expect(personalityComplianceCoefficient(['叛逆'])).toBe(0.6)
  })

  it('returns the minimum coefficient among multiple tags', () => {
    expect(personalityComplianceCoefficient(['顺从', '叛逆'])).toBe(0.6)
    expect(personalityComplianceCoefficient(['正直', '温和'])).toBe(1.0)
    expect(personalityComplianceCoefficient(['谨慎', '多疑', '傲慢'])).toBe(0.6)
  })

  it('ignores unknown tags', () => {
    expect(personalityComplianceCoefficient(['未知性格'])).toBe(1.0)
  })

  it('handles mix of known and unknown tags', () => {
    expect(personalityComplianceCoefficient(['未知', '傲慢'])).toBe(0.6)
  })
})

describe('computeComplianceProbability', () => {
  it('combines base, personality, request, and situation factors', () => {
    // affinity=50 → base=0.70, personality=['正直'] → 1.0, request='normal' → 1.0, situation='private' → 1.0
    expect(computeComplianceProbability({
      affinity: 50,
      personalityTags: ['正直'],
      requestLevel: 'normal',
      situation: 'private',
    })).toBe(0.70)
  })

  it('applies request and situation modifiers', () => {
    // affinity=0 → base=0.40, personality=1.0, request='trivial' → 1.2, situation='aligned' → 1.3
    // 0.40 * 1.0 * 1.2 * 1.3 = 0.624
    const result = computeComplianceProbability({
      affinity: 0,
      personalityTags: [],
      requestLevel: 'trivial',
      situation: 'aligned',
    })
    expect(result).toBeCloseTo(0.40 * 1.2 * 1.3, 5)
  })

  it('reduces probability for extreme requests', () => {
    const normal = computeComplianceProbability({
      affinity: 50,
      personalityTags: [],
      requestLevel: 'normal',
      situation: 'private',
    })
    const extreme = computeComplianceProbability({
      affinity: 50,
      personalityTags: [],
      requestLevel: 'extreme',
      situation: 'private',
    })
    expect(extreme).toBeLessThan(normal)
  })

  it('reduces probability in public situations', () => {
    const private_sit = computeComplianceProbability({
      affinity: 0,
      personalityTags: [],
      requestLevel: 'normal',
      situation: 'private',
    })
    const public_sit = computeComplianceProbability({
      affinity: 0,
      personalityTags: [],
      requestLevel: 'normal',
      situation: 'public',
    })
    expect(public_sit).toBeLessThan(private_sit)
  })

  it('increases probability in saved situations', () => {
    const result = computeComplianceProbability({
      affinity: 20,
      personalityTags: [],
      requestLevel: 'normal',
      situation: 'saved',
    })
    expect(result).toBeGreaterThan(0.55)
  })

  it('mercy mode: affinity >= 80 prevents request/situation penalty', () => {
    // affinity=80 → base=0.95, request='extreme' normally 0.2 but mercy makes it 1.0
    // situation='coerced' normally 0.5 but mercy makes it 1.0
    const result = computeComplianceProbability({
      affinity: 80,
      personalityTags: [],
      requestLevel: 'extreme',
      situation: 'coerced',
    })
    // 0.95 * 1.0 * 1.0 * 1.0 = 0.95
    expect(result).toBe(0.95)
  })

  it('mercy mode does not boost affinity below 80', () => {
    const result = computeComplianceProbability({
      affinity: 79,
      personalityTags: [],
      requestLevel: 'extreme',
      situation: 'coerced',
    })
    // 0.85 * 1.0 * 0.2 * 0.5 = 0.085
    expect(result).toBeLessThan(0.10)
  })

  it('clamps probability to minimum 0.02', () => {
    // Very low affinity + resistant personality + extreme request + coerced = very low probability
    const result = computeComplianceProbability({
      affinity: -100,
      personalityTags: ['叛逆'],
      requestLevel: 'extreme',
      situation: 'coerced',
    })
    expect(result).toBe(0.02)
  })

  it('clamps probability to maximum 0.98', () => {
    const result = computeComplianceProbability({
      affinity: 60,
      personalityTags: ['顺从'],
      requestLevel: 'trivial',
      situation: 'saved',
    })
    expect(result).toBeLessThanOrEqual(0.98)
  })
})

describe('computeAffinityChange', () => {
  it('returns positive magnitude for dialogue', () => {
    expect(computeAffinityChange({ type: 'dialogue', magnitude: 5 })).toBe(5)
  })

  it('returns positive magnitude for wishFulfilled', () => {
    expect(computeAffinityChange({ type: 'wishFulfilled', magnitude: 15 })).toBe(15)
  })

  it('returns negative magnitude for betrayal', () => {
    expect(computeAffinityChange({ type: 'betrayal', magnitude: 30 })).toBe(-30)
  })

  it('returns positive magnitude for saved', () => {
    expect(computeAffinityChange({ type: 'saved', magnitude: 25 })).toBe(25)
  })

  it('returns negative magnitude for warningIgnored', () => {
    expect(computeAffinityChange({ type: 'warningIgnored', magnitude: 10 })).toBe(-10)
  })

  it('handles zero magnitude', () => {
    expect(computeAffinityChange({ type: 'dialogue', magnitude: 0 })).toBe(0)
  })
})

describe('applyCooldown', () => {
  it('reduces change by half when within cooldown (<= 3 days) and change >= 20', () => {
    // change=20, last event on day 1, current day 4 → within 3 days
    expect(applyCooldown(20, 1, 4)).toBe(10)
    expect(applyCooldown(30, 2, 5)).toBe(15)
  })

  it('does not apply cooldown for small changes (< 20)', () => {
    expect(applyCooldown(10, 1, 4)).toBe(10)
    expect(applyCooldown(-10, 1, 4)).toBe(-10)
  })

  it('does not apply cooldown when outside the 3-day window', () => {
    // day 1 to day 5 = 4 days > 3
    expect(applyCooldown(20, 1, 5)).toBe(20)
  })

  it('does not apply cooldown when lastMajorEventDay is null', () => {
    expect(applyCooldown(20, null, 5)).toBe(20)
  })

  it('applies cooldown at exactly 3-day boundary', () => {
    // day 2 to day 5 = 3 days, within cooldown
    expect(applyCooldown(20, 2, 5)).toBe(10)
  })

  it('rounds the halved value', () => {
    expect(applyCooldown(21, 1, 3)).toBe(11) // 21/2 = 10.5 → round → 11
    expect(applyCooldown(23, 1, 3)).toBe(12) // 23/2 = 11.5 → round → 12
  })

  it('handles negative changes within cooldown', () => {
    // -20 / 2 = -10
    expect(applyCooldown(-20, 1, 4)).toBe(-10)
  })
})

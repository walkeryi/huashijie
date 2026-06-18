import { describe, it, expect } from 'vitest'
import {
  AFFINITY_MIN,
  AFFINITY_MAX,
  clampAffinity,
  getAffinityTier,
  getAffinityLabel,
  applyAffinityChanges,
  parseAffinityCondition,
  checkAffinityCondition,
  checkAllAffinityConditions,
} from '../favorability'

describe('constants', () => {
  it('AFFINITY_MIN is -100', () => {
    expect(AFFINITY_MIN).toBe(-100)
  })

  it('AFFINITY_MAX is 100', () => {
    expect(AFFINITY_MAX).toBe(100)
  })
})

describe('clampAffinity', () => {
  it('returns the value when within range', () => {
    expect(clampAffinity(0)).toBe(0)
    expect(clampAffinity(50)).toBe(50)
    expect(clampAffinity(-50)).toBe(-50)
  })

  it('clamps to AFFINITY_MIN when below', () => {
    expect(clampAffinity(-200)).toBe(-100)
    expect(clampAffinity(-101)).toBe(-100)
  })

  it('clamps to AFFINITY_MAX when above', () => {
    expect(clampAffinity(200)).toBe(100)
    expect(clampAffinity(101)).toBe(100)
  })

  it('handles boundary values', () => {
    expect(clampAffinity(-100)).toBe(-100)
    expect(clampAffinity(100)).toBe(100)
  })

  it('handles floating point numbers', () => {
    expect(clampAffinity(50.5)).toBe(50.5)
    expect(clampAffinity(150.7)).toBe(100)
  })
})

describe('getAffinityTier', () => {
  it('returns "hatred" for affinity <= -80', () => {
    expect(getAffinityTier(-100)).toBe('hatred')
    expect(getAffinityTier(-80)).toBe('hatred')
    expect(getAffinityTier(-90)).toBe('hatred')
  })

  it('returns "dislike" for affinity -79 ~ -41', () => {
    expect(getAffinityTier(-79)).toBe('dislike')
    expect(getAffinityTier(-60)).toBe('dislike')
    expect(getAffinityTier(-41)).toBe('dislike')
  })

  it('returns "cold" for affinity -40 ~ -1', () => {
    expect(getAffinityTier(-40)).toBe('cold')
    expect(getAffinityTier(-20)).toBe('cold')
    expect(getAffinityTier(-1)).toBe('cold')
  })

  it('returns "neutral" for affinity 0', () => {
    expect(getAffinityTier(0)).toBe('neutral')
  })

  it('returns "friendly" for affinity 1 ~ 20', () => {
    expect(getAffinityTier(1)).toBe('friendly')
    expect(getAffinityTier(10)).toBe('friendly')
    expect(getAffinityTier(20)).toBe('friendly')
  })

  it('returns "warm" for affinity 21 ~ 60', () => {
    expect(getAffinityTier(21)).toBe('warm')
    expect(getAffinityTier(40)).toBe('warm')
    expect(getAffinityTier(60)).toBe('warm')
  })

  it('returns "intimate" for affinity 61 ~ 100', () => {
    expect(getAffinityTier(61)).toBe('intimate')
    expect(getAffinityTier(80)).toBe('intimate')
    expect(getAffinityTier(100)).toBe('intimate')
  })
})

describe('getAffinityLabel', () => {
  it('returns Chinese labels for each tier', () => {
    expect(getAffinityLabel(-100)).toBe('仇恨')
    expect(getAffinityLabel(-60)).toBe('厌恶')
    expect(getAffinityLabel(-20)).toBe('冷淡')
    expect(getAffinityLabel(0)).toBe('中立')
    expect(getAffinityLabel(10)).toBe('友善')
    expect(getAffinityLabel(40)).toBe('友好')
    expect(getAffinityLabel(80)).toBe('亲密')
  })
})

describe('applyAffinityChanges', () => {
  it('applies positive changes', () => {
    const result = applyAffinityChanges({ npc1: 0, npc2: 50 }, { npc1: 30, npc2: 10 })
    expect(result).toEqual({ npc1: 30, npc2: 60 })
  })

  it('applies negative changes', () => {
    const result = applyAffinityChanges({ npc1: 0, npc2: -20 }, { npc1: -10, npc2: -30 })
    expect(result).toEqual({ npc1: -10, npc2: -50 })
  })

  it('clamps result to valid range', () => {
    const result = applyAffinityChanges({ npc1: 90, npc2: -90 }, { npc1: 20, npc2: -20 })
    expect(result.npc1).toBe(100)
    expect(result.npc2).toBe(-100)
  })

  it('ignores changes for NPCs not in base', () => {
    const result = applyAffinityChanges({ npc1: 0 }, { npc1: 10, npc2: 50 })
    expect(result).toEqual({ npc1: 10 })
  })

  it('does not mutate the original object', () => {
    const base = { npc1: 0 }
    const result = applyAffinityChanges(base, { npc1: 10 })
    expect(base.npc1).toBe(0)
    expect(result.npc1).toBe(10)
  })

  it('handles empty changes', () => {
    const result = applyAffinityChanges({ npc1: 50 }, {})
    expect(result).toEqual({ npc1: 50 })
  })

  it('handles empty base', () => {
    const result = applyAffinityChanges({}, { npc1: 10 })
    expect(result).toEqual({})
  })
})

describe('parseAffinityCondition', () => {
  it('parses ">= 40"', () => {
    expect(parseAffinityCondition('>= 40')).toEqual({ operator: '>=', value: 40 })
  })

  it('parses ">= 20" without space', () => {
    expect(parseAffinityCondition('>=20')).toEqual({ operator: '>=', value: 20 })
  })

  it('parses "<= -20"', () => {
    expect(parseAffinityCondition('<= -20')).toEqual({ operator: '<=', value: -20 })
  })

  it('parses "> 0"', () => {
    expect(parseAffinityCondition('> 0')).toEqual({ operator: '>', value: 0 })
  })

  it('parses "< -50"', () => {
    expect(parseAffinityCondition('< -50')).toEqual({ operator: '<', value: -50 })
  })

  it('parses "== 0"', () => {
    expect(parseAffinityCondition('== 0')).toEqual({ operator: '==', value: 0 })
  })

  it('parses "!= 0"', () => {
    expect(parseAffinityCondition('!= 0')).toEqual({ operator: '!=', value: 0 })
  })

  it('throws on invalid format', () => {
    expect(() => parseAffinityCondition('abc')).toThrow('Invalid affinity condition format')
  })
})

describe('checkAffinityCondition', () => {
  it('checks ">= 40" correctly', () => {
    expect(checkAffinityCondition(50, '>= 40')).toBe(true)
    expect(checkAffinityCondition(40, '>= 40')).toBe(true)
    expect(checkAffinityCondition(30, '>= 40')).toBe(false)
  })

  it('checks "<= -20" correctly', () => {
    expect(checkAffinityCondition(-30, '<= -20')).toBe(true)
    expect(checkAffinityCondition(-20, '<= -20')).toBe(true)
    expect(checkAffinityCondition(-10, '<= -20')).toBe(false)
  })

  it('checks "> 0" correctly', () => {
    expect(checkAffinityCondition(1, '> 0')).toBe(true)
    expect(checkAffinityCondition(0, '> 0')).toBe(false)
  })

  it('checks "== 0" correctly', () => {
    expect(checkAffinityCondition(0, '== 0')).toBe(true)
    expect(checkAffinityCondition(10, '== 0')).toBe(false)
  })

  it('checks "!= 0" correctly', () => {
    expect(checkAffinityCondition(10, '!= 0')).toBe(true)
    expect(checkAffinityCondition(0, '!= 0')).toBe(false)
  })

  it('handles "< -50"', () => {
    expect(checkAffinityCondition(-60, '< -50')).toBe(true)
    expect(checkAffinityCondition(-50, '< -50')).toBe(false)
  })
})

describe('checkAllAffinityConditions', () => {
  it('returns true when all conditions pass', () => {
    const affinities = { npc1: 50, npc2: 30 }
    const checks = { npc1: '>= 40', npc2: '>= 20' }
    expect(checkAllAffinityConditions(affinities, checks)).toBe(true)
  })

  it('returns false when any condition fails', () => {
    const affinities = { npc1: 50, npc2: 10 }
    const checks = { npc1: '>= 40', npc2: '>= 20' }
    expect(checkAllAffinityConditions(affinities, checks)).toBe(false)
  })

  it('returns true when there are no checks', () => {
    expect(checkAllAffinityConditions({ npc1: 50 }, {})).toBe(true)
  })

  it('returns false when an NPC is missing from affinities', () => {
    const affinities = { npc1: 50 }
    const checks = { npc1: '>= 40', npc2: '>= 20' }
    expect(checkAllAffinityConditions(affinities, checks)).toBe(false)
  })

  it('returns true when affinity is exactly at boundary', () => {
    const affinities = { npc: 40 }
    const checks = { npc: '>= 40' }
    expect(checkAllAffinityConditions(affinities, checks)).toBe(true)
  })
})

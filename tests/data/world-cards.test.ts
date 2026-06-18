import { describe, it, expect } from 'vitest'
import { presetWorldCards } from '../world-cards'

describe('presetWorldCards', () => {
  it('contains at least one world card', () => {
    expect(presetWorldCards.length).toBeGreaterThanOrEqual(1)
  })

  it('every card has a unique id', () => {
    const ids = presetWorldCards.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every card has a non-empty name and description', () => {
    for (const card of presetWorldCards) {
      expect(card.name.length).toBeGreaterThan(0)
      expect(card.description.length).toBeGreaterThan(0)
      expect(card.initialScene.length).toBeGreaterThan(0)
      expect(card.subtitle.length).toBeGreaterThan(0)
    }
  })

  it('every card has at least one attribute', () => {
    for (const card of presetWorldCards) {
      expect(card.attributes.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('every attribute has valid ranges (0 <= initial <= max)', () => {
    for (const card of presetWorldCards) {
      for (const attr of card.attributes) {
        expect(attr.initial).toBeGreaterThanOrEqual(0)
        expect(attr.max).toBeGreaterThan(0)
        expect(attr.initial).toBeLessThanOrEqual(attr.max)
      }
    }
  })

  it('every attribute key is unique per card', () => {
    for (const card of presetWorldCards) {
      const keys = card.attributes.map(a => a.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('every attribute has a non-empty name and icon', () => {
    for (const card of presetWorldCards) {
      for (const attr of card.attributes) {
        expect(attr.name.length).toBeGreaterThan(0)
        expect(attr.icon.length).toBeGreaterThan(0)
      }
    }
  })
})

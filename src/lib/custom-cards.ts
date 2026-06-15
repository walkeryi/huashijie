import { WorldCard } from './types'

const STORAGE_KEY = 'custom_world_cards'

export function listCustomCards(): WorldCard[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCustomCard(card: WorldCard): void {
  if (typeof window === 'undefined') return
  const cards = listCustomCards()
  const idx = cards.findIndex(c => c.id === card.id)
  if (idx >= 0) {
    cards[idx] = card
  } else {
    cards.push(card)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
}

export function deleteCustomCard(id: string): void {
  if (typeof window === 'undefined') return
  const cards = listCustomCards().filter(c => c.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
}

export function createEmptyCard(): WorldCard {
  return {
    id: 'custom_' + Date.now(),
    name: '',
    subtitle: '',
    description: '',
    coverEmoji: '🌍',
    initialScene: '',
    attributes: [],
    npcs: [],
    flags: [],
    startingItems: [],
    storyBeats: [],
  }
}

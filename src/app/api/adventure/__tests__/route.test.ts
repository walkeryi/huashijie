import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../route'
import { WorldCard, PlayerState } from '@/lib/types'

function makeWorldCard(overrides?: Partial<WorldCard>): WorldCard {
  return {
    id: 'test',
    name: '测试',
    subtitle: '',
    description: '这是一个测试世界的设定。',
    coverEmoji: '',
    initialScene: '开场',
    attributes: [
      { key: 'courage', name: '勇气', icon: '⚔️', initial: 3, max: 10 },
      { key: 'wisdom', name: '智慧', icon: '🧠', initial: 5, max: 10 },
    ],
    ...overrides,
  }
}

function makePlayerState(overrides?: Partial<PlayerState>): PlayerState {
  return {
    playerName: '冒险者',
    attributes: { courage: 3, wisdom: 5 },
    flags: {},
    ...overrides,
  }
}

describe('buildSystemPrompt', () => {
  it('includes the world description in the prompt', () => {
    const card = makeWorldCard({ description: '龙与地下城的世界。' })
    const prompt = buildSystemPrompt(card, makePlayerState())

    expect(prompt).toContain('龙与地下城的世界。')
  })

  it('includes player name in the prompt', () => {
    const card = makeWorldCard()
    const player = makePlayerState({ playerName: '小明' })
    const prompt = buildSystemPrompt(card, player)

    expect(prompt).toContain('小明')
  })

  it('formats attribute values with icons and names', () => {
    const card = makeWorldCard()
    const player = makePlayerState({ attributes: { courage: 7, wisdom: 3 } })
    const prompt = buildSystemPrompt(card, player)

    expect(prompt).toContain('⚔️ 勇气: 7/10')
    expect(prompt).toContain('🧠 智慧: 3/10')
  })

  it('includes JSON output format instructions', () => {
    const prompt = buildSystemPrompt(makeWorldCard(), makePlayerState())

    expect(prompt).toContain('"narration"')
    expect(prompt).toContain('"options"')
    expect(prompt).toContain('"attributeChanges"')
    expect(prompt).toContain('"attributeChecks"')
  })

  it('includes narrative rules in Chinese', () => {
    const prompt = buildSystemPrompt(makeWorldCard(), makePlayerState())

    expect(prompt).toContain('文字冒险游戏的叙事引擎')
    expect(prompt).toContain('200-400 字')
    expect(prompt).toContain('2-4 个有意义的选择')
  })

  it('sanitizes player name to prevent prompt injection', () => {
    const card = makeWorldCard()
    const player = makePlayerState({ playerName: '恶意\n名字\r带换行' })
    const prompt = buildSystemPrompt(card, player)

    // 换行和回车应被过滤
    expect(prompt).not.toContain('\n名字')
    expect(prompt).not.toContain('\r')
  })

  it('limits player name to 50 characters', () => {
    const card = makeWorldCard()
    const longName = 'A'.repeat(100)
    const player = makePlayerState({ playerName: longName })
    const prompt = buildSystemPrompt(card, player)

    // 名字被截断为 50 字符
    expect(prompt).toContain('A'.repeat(50))
    expect(prompt).not.toContain('A'.repeat(51))
  })

  it('falls back attribute display when no matching definition', () => {
    const card = makeWorldCard()
    const player = makePlayerState({ attributes: { unknown_attr: 42 } })
    const prompt = buildSystemPrompt(card, player)

    // 未知属性用 key: val 格式
    expect(prompt).toContain('unknown_attr: 42')
  })
})

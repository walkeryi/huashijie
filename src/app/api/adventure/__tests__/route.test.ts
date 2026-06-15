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
    npcs: [
      { id: 'blacksmith', name: '铁匠老王', description: '村里的铁匠', initialAffinity: 50 },
      { id: 'mage', name: '法师艾琳', description: '神秘的法师', initialAffinity: 30 },
    ],
    flags: ['found_allies', 'betrayed_king'],
    startingItems: ['rusty_key'],
    storyBeats: [],
    ...overrides,
  }
}

function makePlayerState(overrides?: Partial<PlayerState>): PlayerState {
  return {
    playerName: '冒险者',
    attributes: { courage: 3, wisdom: 5 },
    flags: {},
    inventory: [],
    ...overrides,
  }
}

describe('buildSystemPrompt', () => {
  it('includes the world description in the prompt', () => {
    const card = makeWorldCard({ description: '龙与地下城的世界。' })
    const prompt = buildSystemPrompt(card, makePlayerState(), {})

    expect(prompt).toContain('龙与地下城的世界。')
  })

  it('includes player name in the prompt', () => {
    const card = makeWorldCard()
    const player = makePlayerState({ playerName: '小明' })
    const prompt = buildSystemPrompt(card, player, {})

    expect(prompt).toContain('小明')
  })

  it('formats attribute values with icons and names', () => {
    const card = makeWorldCard()
    const player = makePlayerState({ attributes: { courage: 7, wisdom: 3 } })
    const prompt = buildSystemPrompt(card, player, {})

    expect(prompt).toContain('⚔️ 勇气: 7/10')
    expect(prompt).toContain('🧠 智慧: 3/10')
  })

  it('includes JSON output format instructions', () => {
    const prompt = buildSystemPrompt(makeWorldCard(), makePlayerState(), {})

    expect(prompt).toContain('"narration"')
    expect(prompt).toContain('"options"')
    expect(prompt).toContain('"attributeChanges"')
    expect(prompt).toContain('"attributeChecks"')
  })

  it('includes new JSON fields in output format', () => {
    const prompt = buildSystemPrompt(makeWorldCard(), makePlayerState(), {})

    expect(prompt).toContain('"npcAffinityChanges"')
    expect(prompt).toContain('"newFlags"')
    expect(prompt).toContain('"lostFlags"')
    expect(prompt).toContain('"itemsGained"')
    expect(prompt).toContain('"itemsLost"')
  })

  it('includes narrative rules in Chinese', () => {
    const prompt = buildSystemPrompt(makeWorldCard(), makePlayerState(), {})

    expect(prompt).toContain('文字冒险游戏的叙事引擎')
    expect(prompt).toContain('200-400 字')
    expect(prompt).toContain('2-4 个有意义的选择')
  })

  it('includes new rules about NPC affinity, items, and flags', () => {
    const prompt = buildSystemPrompt(makeWorldCard(), makePlayerState(), {})

    expect(prompt).toContain('NPC 好感度随玩家行为变化')
    expect(prompt).toContain('好感度高的 NPC 主动提供帮助')
    expect(prompt).toContain('物品在合理时消耗')
    expect(prompt).toContain('旗标代表不可逆的世界变化')
    expect(prompt).toContain('npcAffinityChanges 只包含本次对话中有变化的 NPC')
  })

  it('sanitizes player name to prevent prompt injection', () => {
    const card = makeWorldCard()
    const player = makePlayerState({ playerName: '恶意\n名字\r带换行' })
    const prompt = buildSystemPrompt(card, player, {})

    // 换行和回车应被过滤
    expect(prompt).not.toContain('\n名字')
    expect(prompt).not.toContain('\r')
  })

  it('limits player name to 50 characters', () => {
    const card = makeWorldCard()
    const longName = 'A'.repeat(100)
    const player = makePlayerState({ playerName: longName })
    const prompt = buildSystemPrompt(card, player, {})

    // 名字被截断为 50 字符
    expect(prompt).toContain('A'.repeat(50))
    expect(prompt).not.toContain('A'.repeat(51))
  })

  it('falls back attribute display when no matching definition', () => {
    const card = makeWorldCard()
    const player = makePlayerState({ attributes: { unknown_attr: 42 } })
    const prompt = buildSystemPrompt(card, player, {})

    // 未知属性用 key: val 格式
    expect(prompt).toContain('unknown_attr: 42')
  })

  describe('NPC 关系 section', () => {
    it('shows NPC affinities from the world card', () => {
      const card = makeWorldCard({
        npcs: [
          { id: 'blacksmith', name: '铁匠老王', description: '', initialAffinity: 50 },
        ],
      })
      const prompt = buildSystemPrompt(card, makePlayerState(), { blacksmith: 45 })

      expect(prompt).toContain('铁匠老王')
      expect(prompt).toContain('好感: 45/100')
    })

    it('uses initial affinity when npcAffinities entry is missing', () => {
      const card = makeWorldCard({
        npcs: [
          { id: 'blacksmith', name: '铁匠老王', description: '', initialAffinity: 50 },
        ],
      })
      const prompt = buildSystemPrompt(card, makePlayerState(), {})

      expect(prompt).toContain('好感: 50/100')
    })

    it('shows "无" when there are no NPCs', () => {
      const card = makeWorldCard({ npcs: [] })
      const prompt = buildSystemPrompt(card, makePlayerState(), {})

      expect(prompt).toContain('NPC 关系\n无')
    })
  })

  describe('物品栏 section', () => {
    it('shows inventory items', () => {
      const player = makePlayerState({ inventory: ['锈蚀钥匙', '草药'] })
      const prompt = buildSystemPrompt(makeWorldCard(), player, {})

      expect(prompt).toContain('- 锈蚀钥匙')
      expect(prompt).toContain('- 草药')
    })

    it('shows "空" when inventory is empty', () => {
      const player = makePlayerState({ inventory: [] })
      const prompt = buildSystemPrompt(makeWorldCard(), player, {})

      expect(prompt).toContain('物品栏\n空')
    })
  })

  describe('已解锁旗标 section', () => {
    it('shows flags that are true', () => {
      const player = makePlayerState({ flags: { found_allies: true, met_king: false } })
      const prompt = buildSystemPrompt(makeWorldCard(), player, {})

      expect(prompt).toContain('- found_allies')
      expect(prompt).not.toContain('- met_king')
    })

    it('shows "无" when no flags are true', () => {
      const player = makePlayerState({ flags: { met_king: false } })
      const prompt = buildSystemPrompt(makeWorldCard(), player, {})

      expect(prompt).not.toContain('- met_king')
    })
  })
})

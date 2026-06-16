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
      { id: 'blacksmith', isMainCharacter: false, fields: { name: '铁匠老王', initialAffinity: 50, gender: '男', origin: '村里的铁匠', dialogueTone: '粗犷', id: 'blacksmith', isMainCharacter: false, birthday: '', dialogueExamples: '', personalityTags: [], appearance: '', currentAttire: '' } },
      { id: 'mage', isMainCharacter: false, fields: { name: '法师艾琳', initialAffinity: 30, gender: '女', origin: '神秘的法师', dialogueTone: '神秘', id: 'mage', isMainCharacter: false, birthday: '', dialogueExamples: '', personalityTags: [], appearance: '', currentAttire: '' } },
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

  it('includes tool-call output instructions', () => {
    const prompt = buildSystemPrompt(makeWorldCard(), makePlayerState(), {})

    expect(prompt).toContain('update_state')
    expect(prompt).toContain('选项')
    expect(prompt).toContain('属性变化')
  })

  it('includes NPC affinity, items, and flags in player state section', () => {
    const prompt = buildSystemPrompt(makeWorldCard(), makePlayerState(), { blacksmith: 45 })

    expect(prompt).toContain('好感')
    expect(prompt).toContain('物品栏')
    expect(prompt).toContain('旗标')
  })

  it('includes narrative rules in Chinese', () => {
    const prompt = buildSystemPrompt(makeWorldCard(), makePlayerState(), {})

    expect(prompt).toContain('文字冒险游戏的叙事引擎')
    expect(prompt).toContain('200-400字')
    expect(prompt).toContain('工具')
  })

  it('includes NPC behavior rules', () => {
    const prompt = buildSystemPrompt(makeWorldCard(), makePlayerState(), {})

    expect(prompt).toContain('好感度变化规则')
    expect(prompt).toContain('与 NPC')
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
          { id: 'blacksmith', isMainCharacter: false, fields: { id: 'blacksmith', isMainCharacter: false, name: '铁匠老王', initialAffinity: 50, gender: '男', origin: '', dialogueTone: '粗犷', birthday: '', dialogueExamples: '', personalityTags: [], appearance: '', currentAttire: '' } },
        ],
      })
      const prompt = buildSystemPrompt(card, makePlayerState(), { blacksmith: 45 })

      expect(prompt).toContain('铁匠老王')
      expect(prompt).toContain('好感: 45/100')
    })

    it('uses initial affinity when npcAffinities entry is missing', () => {
      const card = makeWorldCard({
        npcs: [
          { id: 'blacksmith', isMainCharacter: false, fields: { id: 'blacksmith', isMainCharacter: false, name: '铁匠老王', initialAffinity: 50, gender: '男', origin: '', dialogueTone: '粗犷', birthday: '', dialogueExamples: '', personalityTags: [], appearance: '', currentAttire: '' } },
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

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WorldCard, AttributeDef, NPCDef, StoryBeat } from '@/lib/types'
import { createEmptyCard, saveCustomCard } from '@/lib/custom-cards'

type Tab = 'world' | 'attrs' | 'npcs' | 'items' | 'beats' | 'preview'

const TABS: { key: Tab; label: string }[] = [
  { key: 'world', label: '世界观' },
  { key: 'attrs', label: '属性' },
  { key: 'npcs', label: 'NPC' },
  { key: 'items', label: '物品&旗标' },
  { key: 'beats', label: '节拍链' },
  { key: 'preview', label: '预览' },
]

export default function WorldCreator() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('world')
  const [card, setCard] = useState<WorldCard>(createEmptyCard)
  const [saved, setSaved] = useState(false)

  const update = (patch: Partial<WorldCard>) => setCard(c => ({ ...c, ...patch }))

  const handleSave = () => {
    if (!card.name.trim()) return
    saveCustomCard(card)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = () => {
    if (!card.name.trim()) return
    saveCustomCard(card)
    router.push(`/game?custom=${card.id}`)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">✨ 创作台</h1>
          <div className="flex gap-2">
            <button onClick={() => router.push('/')} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm hover:bg-[var(--bg-card)] transition-colors">
              ← 返回
            </button>
            <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors">
              {saved ? '✅ 已保存' : '💾 保存'}
            </button>
            <button onClick={handleTest} className="px-4 py-2 rounded-xl border border-[var(--accent)] text-[var(--accent)] text-sm hover:bg-[var(--accent)]/10 transition-colors">
              ▶ 试玩
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[var(--border)] overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-6">
          {tab === 'world' && <WorldTab card={card} update={update} />}
          {tab === 'attrs' && <AttrsTab card={card} update={update} />}
          {tab === 'npcs' && <NPCsTab card={card} update={update} />}
          {tab === 'items' && <ItemsTab card={card} update={update} />}
          {tab === 'beats' && <BeatsTab card={card} update={update} />}
          {tab === 'preview' && <PreviewTab card={card} />}
        </div>
      </div>
    </div>
  )
}

// ====== 世界观 ======

function WorldTab({ card, update }: { card: WorldCard; update: (p: Partial<WorldCard>) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm text-[var(--text-secondary)] mb-1">世界名称 *</label>
          <input value={card.name} onChange={e => update({ name: e.target.value })} placeholder="例如：蒸汽苍穹" className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm" />
        </div>
        <div className="w-20">
          <label className="block text-sm text-[var(--text-secondary)] mb-1">Emoji</label>
          <input value={card.coverEmoji} onChange={e => update({ coverEmoji: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-center text-xl" />
        </div>
      </div>
      <div>
        <label className="block text-sm text-[var(--text-secondary)] mb-1">副标题</label>
        <input value={card.subtitle} onChange={e => update({ subtitle: e.target.value })} placeholder="一句话吸引玩家" className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm" />
      </div>
      <div>
        <label className="block text-sm text-[var(--text-secondary)] mb-1">世界观描述</label>
        <p className="text-xs text-[var(--text-secondary)] mb-1">AI 会读取这段文字来理解世界。写清楚时代背景、核心冲突、势力分布。</p>
        <textarea value={card.description} onChange={e => update({ description: e.target.value })} rows={6} placeholder="蒸汽朋克时代，魔法与机械并存。七座天空之城靠核心水晶悬浮..." className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm resize-y" />
      </div>
      <div>
        <label className="block text-sm text-[var(--text-secondary)] mb-1">开场场景</label>
        <p className="text-xs text-[var(--text-secondary)] mb-1">玩家进入游戏看到的第一段文字。</p>
        <textarea value={card.initialScene} onChange={e => update({ initialScene: e.target.value })} rows={3} placeholder="你在一艘坠毁的飞艇残骸中醒来..." className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm resize-y" />
      </div>
    </div>
  )
}

// ====== 属性 ======

function AttrsTab({ card, update }: { card: WorldCard; update: (p: Partial<WorldCard>) => void }) {
  const add = () => {
    const key = 'attr_' + (card.attributes.length + 1)
    update({ attributes: [...card.attributes, { key, name: '', icon: '⬡', initial: 3, max: 10 }] })
  }
  const remove = (idx: number) => update({ attributes: card.attributes.filter((_, i) => i !== idx) })
  const edit = (idx: number, attr: Partial<AttributeDef>) => {
    const list = [...card.attributes]
    list[idx] = { ...list[idx], ...attr }
    update({ attributes: list })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-secondary)]">定义这个世界里玩家需要关注的「能力」。参考：勇气、灵力、科技、声望。</p>
      {card.attributes.length === 0 && <p className="text-sm text-[var(--text-secondary)]">暂无属性，点下方按钮添加。</p>}
      {card.attributes.map((attr, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input value={attr.icon} onChange={e => edit(i, { icon: e.target.value })} className="w-12 px-2 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-center text-lg" />
          <input value={attr.name} onChange={e => edit(i, { name: e.target.value })} placeholder="属性名" className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm" />
          <input type="number" value={attr.initial} onChange={e => edit(i, { initial: Number(e.target.value) })} min={0} max={10} className="w-16 px-2 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-center text-sm" title="初始值" />
          <input type="number" value={attr.max} onChange={e => edit(i, { max: Number(e.target.value) })} min={1} max={10} className="w-16 px-2 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-center text-sm" title="上限" />
          <button onClick={() => remove(i)} className="text-red-400 hover:text-red-300 px-2">✕</button>
        </div>
      ))}
      <button onClick={add} className="text-sm text-[var(--accent)] hover:underline">+ 添加属性</button>
    </div>
  )
}

// ====== NPC ======

function NPCsTab({ card, update }: { card: WorldCard; update: (p: Partial<WorldCard>) => void }) {
  const add = () => {
    const id = 'npc_' + Date.now()
    update({ npcs: [...card.npcs, { id, name: '', description: '', initialAffinity: 0 }] })
  }
  const remove = (idx: number) => update({ npcs: card.npcs.filter((_, i) => i !== idx) })
  const edit = (idx: number, npc: Partial<NPCDef>) => {
    const list = [...card.npcs]
    list[idx] = { ...list[idx], ...npc }
    update({ npcs: list })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">添加世界里的关键角色。给每个人一段背景描述，AI 会据此生成对话。</p>
      {card.npcs.length === 0 && <p className="text-sm text-[var(--text-secondary)]">暂无 NPC。</p>}
      {card.npcs.map((npc, i) => (
        <div key={i} className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] space-y-2">
          <div className="flex gap-2">
            <input value={npc.name} onChange={e => edit(i, { name: e.target.value })} placeholder="NPC 名称" className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm" />
            <div className="flex items-center gap-1 text-sm text-[var(--text-secondary)]">
              好感
              <input type="number" value={npc.initialAffinity} onChange={e => edit(i, { initialAffinity: Number(e.target.value) })} min={-100} max={100} className="w-16 px-2 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-center text-sm" />
            </div>
            <button onClick={() => remove(i)} className="text-red-400 hover:text-red-300 px-2">✕</button>
          </div>
          <input value={npc.description} onChange={e => edit(i, { description: e.target.value })} placeholder="背景描述：他/她是谁？想要什么？怕什么？" className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-xs" />
        </div>
      ))}
      <button onClick={add} className="text-sm text-[var(--accent)] hover:underline">+ 添加 NPC</button>
    </div>
  )
}

// ====== 物品 & 旗标 ======

function ItemsTab({ card, update }: { card: WorldCard; update: (p: Partial<WorldCard>) => void }) {
  const [newItem, setNewItem] = useState('')
  const [newFlag, setNewFlag] = useState('')

  return (
    <div className="space-y-6">
      {/* 物品 */}
      <div>
        <h3 className="text-sm font-bold mb-2">🎒 开局物品</h3>
        <p className="text-xs text-[var(--text-secondary)] mb-2">玩家进入游戏时携带的道具。AI 可能围绕它们生成剧情。</p>
        <div className="flex gap-2 mb-2">
          <input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newItem.trim()) { update({ startingItems: [...card.startingItems, newItem.trim()] }); setNewItem('') } }} placeholder="例如：机械扳手" className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm" />
          <button onClick={() => { if (newItem.trim()) { update({ startingItems: [...card.startingItems, newItem.trim()] }); setNewItem('') } }} className="px-3 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-medium">添加</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {card.startingItems.map((item, i) => (
            <span key={i} className="flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-sm">
              {item}
              <button onClick={() => update({ startingItems: card.startingItems.filter((_, j) => j !== i) })} className="text-[var(--text-secondary)] hover:text-red-400">✕</button>
            </span>
          ))}
        </div>
      </div>

      {/* 旗标 */}
      <div>
        <h3 className="text-sm font-bold mb-2">🏳️ 世界旗标</h3>
        <p className="text-xs text-[var(--text-secondary)] mb-2">记录剧情进度的事件标记。节拍链会用到它们。</p>
        <div className="flex gap-2 mb-2">
          <input value={newFlag} onChange={e => setNewFlag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newFlag.trim()) { update({ flags: [...card.flags, newFlag.trim()] }); setNewFlag('') } }} placeholder="例如：found_crystal_clue" className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm font-mono" />
          <button onClick={() => { if (newFlag.trim()) { update({ flags: [...card.flags, newFlag.trim()] }); setNewFlag('') } }} className="px-3 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-medium">添加</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {card.flags.map((flag, i) => (
            <span key={i} className="flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-sm font-mono">
              {flag}
              <button onClick={() => update({ flags: card.flags.filter((_, j) => j !== i) })} className="text-[var(--text-secondary)] hover:text-red-400">✕</button>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ====== 节拍链 ======

function BeatsTab({ card, update }: { card: WorldCard; update: (p: Partial<WorldCard>) => void }) {
  const add = () => {
    const id = 'beat_' + Date.now()
    update({ storyBeats: [...card.storyBeats, { id, name: '', description: '', effects: {}, unlocks: [] }] })
  }
  const remove = (idx: number) => update({ storyBeats: card.storyBeats.filter((_, i) => i !== idx) })
  const edit = (idx: number, beat: Partial<StoryBeat>) => {
    const list = [...card.storyBeats]
    list[idx] = { ...list[idx], ...beat }
    update({ storyBeats: list })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        定义故事的结构。每个节拍是一个关键剧情节点。第一个节拍通常是开场场景，最后一个没有解锁目标。
        参考<a href="/docs/玩家创作指南.md" className="text-[var(--accent)] hover:underline ml-1">创作指南</a>
      </p>
      {card.storyBeats.length === 0 && <p className="text-sm text-[var(--text-secondary)]">暂无节拍。从开场场景开始添加。</p>}
      {card.storyBeats.map((beat, i) => (
        <div key={i} className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] space-y-3">
          <div className="flex gap-2">
            <input value={beat.name} onChange={e => edit(i, { name: e.target.value })} placeholder="节拍名称" className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm font-bold" />
            <span className="text-xs text-[var(--text-secondary)] self-center px-2">{beat.id}</span>
            <button onClick={() => remove(i)} className="text-red-400 hover:text-red-300 px-2">✕</button>
          </div>
          <input value={beat.description} onChange={e => edit(i, { description: e.target.value })} placeholder="描述：AI 判断完成此节拍的标准" className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-xs" />

          {/* 条件（简单版：只选属性门槛） */}
          <div className="text-xs text-[var(--text-secondary)]">
            <span className="mr-2">前置条件（可选）：</span>
            {card.attributes.map(attr => {
              const key = attr.key
              const val = beat.preconditions?.attributeChecks?.[key] || ''
              return (
                <span key={key} className="inline-flex items-center gap-1 mr-2">
                  {attr.icon}{attr.name} ≥
                  <input
                    type="number"
                    value={val.replace('>= ', '')}
                    onChange={e => {
                      const v = e.target.value
                      const checks = { ...(beat.preconditions?.attributeChecks || {}) }
                      if (v) { checks[key] = `>= ${v}` }
                      else { delete checks[key] }
                      const preconditions = Object.keys(checks).length > 0 ? { ...beat.preconditions, attributeChecks: checks } : undefined
                      edit(i, { preconditions } as Partial<StoryBeat>)
                    }}
                    className="w-12 px-1 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-center"
                    min={0} max={10}
                  />
                </span>
              )
            })}
            {card.npcs.map(npc => {
              const key = npc.id
              const val = beat.preconditions?.npcAffinityChecks?.[key] || ''
              return (
                <span key={key} className="inline-flex items-center gap-1 mr-2">
                  👤{npc.name} ≥
                  <input
                    type="number"
                    value={val.replace('>= ', '')}
                    onChange={e => {
                      const v = e.target.value
                      const checks = { ...(beat.preconditions?.npcAffinityChecks || {}) }
                      if (v) { checks[key] = `>= ${v}` }
                      else { delete checks[key] }
                      const preconditions = Object.keys(checks).length > 0 ? { ...beat.preconditions, npcAffinityChecks: checks } : undefined
                      edit(i, { preconditions } as Partial<StoryBeat>)
                    }}
                    className="w-12 px-1 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-center"
                    min={0} max={100}
                  />
                </span>
              )
            })}
          </div>

          {/* 效果 */}
          <div className="text-xs space-y-1">
            <span className="text-[var(--text-secondary)] mr-2">效果：</span>
            <label className="inline-flex items-center gap-1 mr-3">
              <span>旗标</span>
              <select
                value=""
                onChange={e => {
                  if (e.target.value) {
                    edit(i, { effects: { ...beat.effects, newFlags: [...(beat.effects.newFlags || []), e.target.value] } })
                  }
                }}
                className="px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs"
              >
                <option value="">+ 添加旗标</option>
                {card.flags.filter(f => !beat.effects.newFlags?.includes(f)).map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </label>
            {beat.effects.newFlags?.map(flag => (
              <span key={flag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/20 font-mono text-xs">
                {flag}
                <button onClick={() => edit(i, { effects: { ...beat.effects, newFlags: beat.effects.newFlags?.filter(f => f !== flag) } })} className="text-[var(--text-secondary)] hover:text-red-400">✕</button>
              </span>
            ))}
          </div>

          {/* 解锁 */}
          <div className="text-xs">
            <span className="text-[var(--text-secondary)] mr-2">完成后解锁：</span>
            {card.storyBeats.filter(b => b.id !== beat.id).map(b => {
              const checked = beat.unlocks.includes(b.id)
              return (
                <label key={b.id} className="inline-flex items-center gap-1 mr-3">
                  <input type="checkbox" checked={checked} onChange={() => {
                    edit(i, { unlocks: checked ? beat.unlocks.filter(id => id !== b.id) : [...beat.unlocks, b.id] })
                  }} className="rounded" />
                  {b.name || b.id}
                </label>
              )
            })}
          </div>
        </div>
      ))}
      <button onClick={add} className="text-sm text-[var(--accent)] hover:underline">+ 添加节拍</button>
    </div>
  )
}

// ====== 预览 ======

function PreviewTab({ card }: { card: WorldCard }) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-4xl mb-2">{card.coverEmoji || '🌍'}</div>
        <h2 className="text-xl font-bold">{card.name || '(未命名)'}</h2>
        <p className="text-sm text-[var(--text-secondary)]">{card.subtitle || '(无副标题)'}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="p-3 rounded-xl bg-[var(--bg-card)]">
          <div className="text-[var(--text-secondary)] mb-1">属性 ({card.attributes.length})</div>
          {card.attributes.map(a => <div key={a.key}>{a.icon} {a.name} {a.initial}/{a.max}</div>)}
          {card.attributes.length === 0 && <span className="text-[var(--text-secondary)]">无</span>}
        </div>
        <div className="p-3 rounded-xl bg-[var(--bg-card)]">
          <div className="text-[var(--text-secondary)] mb-1">NPC ({card.npcs.length})</div>
          {card.npcs.map(n => <div key={n.id}>👤 {n.name} (好感 {n.initialAffinity})</div>)}
          {card.npcs.length === 0 && <span className="text-[var(--text-secondary)]">无</span>}
        </div>
        <div className="p-3 rounded-xl bg-[var(--bg-card)]">
          <div className="text-[var(--text-secondary)] mb-1">物品 ({card.startingItems.length})</div>
          {card.startingItems.map((item, i) => <div key={i}>📦 {item}</div>)}
          {card.startingItems.length === 0 && <span className="text-[var(--text-secondary)]">无</span>}
        </div>
        <div className="p-3 rounded-xl bg-[var(--bg-card)]">
          <div className="text-[var(--text-secondary)] mb-1">节拍 ({card.storyBeats.length})</div>
          {card.storyBeats.map(b => <div key={b.id}>→ {b.name || b.id}</div>)}
          {card.storyBeats.length === 0 && <span className="text-[var(--text-secondary)]">无</span>}
        </div>
      </div>
    </div>
  )
}

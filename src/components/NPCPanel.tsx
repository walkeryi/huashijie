'use client'

import { NPCDef } from '@/lib/types'

interface NPCPanelProps {
  open: boolean
  onClose: () => void
  npcs: NPCDef[]
  affinities: Record<string, number>
}

export default function NPCPanel({ open, onClose, npcs, affinities }: NPCPanelProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">👤 NPC 关系</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
        </div>
        {npcs.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-sm">暂无 NPC</p>
        ) : (
          <div className="space-y-3">
            {npcs.map(npc => {
              const val = affinities[npc.id] ?? npc.fields.initialAffinity ?? 0
              const pct = Math.max(0, Math.min(100, val))
              const barColor = val >= 0 ? 'var(--accent)' : 'var(--danger)'
              return (
                <div key={npc.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{npc.fields.name || npc.id}</span>
                    <span className={val < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-secondary)]'}>{val}/100</span>
                  </div>
                  <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{npc.fields.origin || npc.fields.dialogueTone || ''}</p>
                </div>
              )
            })}
          </div>
        )}
        <p className="text-xs text-[var(--text-secondary)] mt-4 text-center">AI 根据对话自动调整</p>
      </div>
    </div>
  )
}

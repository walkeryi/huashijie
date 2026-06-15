'use client'

interface FlagPanelProps {
  open: boolean
  onClose: () => void
  flags: Record<string, boolean>
}

export default function FlagPanel({ open, onClose, flags }: FlagPanelProps) {
  if (!open) return null

  const activeFlags = Object.entries(flags).filter(([, v]) => v).map(([k]) => k)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">🏳️ 已解锁旗标</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
        </div>
        {activeFlags.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-sm">暂无已解锁旗标</p>
        ) : (
          <div className="space-y-2">
            {activeFlags.map(flag => (
              <div key={flag} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--accent)]/20">
                <span className="text-lg">🏳️</span>
                <span className="text-sm">{flag}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-[var(--text-secondary)] mt-4 text-center">旗标影响可用选项，AI 自动管理</p>
      </div>
    </div>
  )
}

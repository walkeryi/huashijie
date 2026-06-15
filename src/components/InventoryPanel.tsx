'use client'

interface InventoryPanelProps {
  open: boolean
  onClose: () => void
  inventory: string[]
}

export default function InventoryPanel({ open, onClose, inventory }: InventoryPanelProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">🎒 物品栏</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
        </div>
        {inventory.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-sm">空空如也</p>
        ) : (
          <div className="space-y-2">
            {inventory.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
                <span className="text-lg">📦</span>
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-[var(--text-secondary)] mt-4 text-center">AI 根据对话自动管理</p>
      </div>
    </div>
  )
}

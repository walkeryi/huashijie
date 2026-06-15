'use client'

import { useState } from 'react'
import { useGame } from '@/lib/game-context'
import { themes, loadTheme, saveTheme, applyTheme, loadFontSize, saveFontSize, applyFontSize, FontSize } from '@/lib/theme'

type SettingsPage = 'menu' | 'general' | 'api'

export default function SystemSettings() {
  const { state, actions } = useGame()
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState<SettingsPage>('menu')

  // API
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState('')

  // 主题 + 字体
  const [currentTheme, setCurrentTheme] = useState(loadTheme())
  const [currentFontSize, setCurrentFontSize] = useState(loadFontSize())

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setPage('menu') }}
        className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-lg"
        title="设置"
      >
        ⚙️
      </button>
    )
  }

  const close = () => { setOpen(false); setPage('menu') }

  const handleTest = async () => {
    if (!state.apiKey) { setTestStatus('fail'); setTestMessage('请先输入 API Key'); return }
    setTestStatus('testing'); setTestMessage('')
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: state.apiKey, provider: state.provider, model: state.model, customBaseURL: state.customBaseURL }),
      })
      const data = await res.json()
      if (data.ok) { setTestStatus('ok'); setTestMessage(`连接成功 · ${data.latency}ms`) }
      else { setTestStatus('fail'); setTestMessage(data.error || '连接失败') }
    } catch { setTestStatus('fail'); setTestMessage('网络错误') }
  }

  const handleThemeChange = (id: string) => {
    const theme = themes.find(t => t.id === id)
    if (!theme) return
    setCurrentTheme(id)
    saveTheme(id)
    applyTheme(theme)
  }

  const handleFontSizeChange = (size: FontSize) => {
    setCurrentFontSize(size)
    saveFontSize(size)
    applyFontSize(size)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* === 主菜单 === */}
        {page === 'menu' && (
          <div>
            <h2 className="text-xl font-bold text-center text-[var(--text-primary)] pt-8 pb-2">⚙️ 设置</h2>
            <div className="px-6 py-6 space-y-3">
              <button onClick={() => setPage('general')}
                className="w-full py-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-left px-5 group">
                <span className="text-2xl mr-3">👤</span>
                <span className="text-lg font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">基础设置</span>
                <span className="text-sm text-[var(--text-secondary)] ml-2">{themes.find(t => t.id === currentTheme)?.name} · {currentFontSize === 'small' ? '小' : currentFontSize === 'large' ? '大' : '中'}</span>
              </button>

              <button onClick={() => { setPage('api'); setTestStatus('idle'); setTestMessage('') }}
                className="w-full py-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-left px-5 group">
                <span className="text-2xl mr-3">🔑</span>
                <span className="text-lg font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">API 设置</span>
                <span className="text-sm text-[var(--text-secondary)] ml-2">{state.provider}</span>
              </button>
            </div>
            <div className="px-6 pb-6">
              <button onClick={close}
                className="w-full py-3 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors text-sm">
                ← 返回
              </button>
            </div>
          </div>
        )}

        {/* === 基础设置 === */}
        {page === 'general' && (
          <div>
            <div className="flex items-center gap-3 px-5 pt-6 pb-4">
              <button onClick={() => setPage('menu')}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors">
                ← 返回
              </button>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">👤 基础设置</h2>
            </div>

            <div className="px-6 pb-6 space-y-6">
              {/* 主题配色 */}
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-3">主题配色</label>
                <div className="grid grid-cols-2 gap-2">
                  {themes.map(t => (
                    <button key={t.id} onClick={() => handleThemeChange(t.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-colors ${
                        currentTheme === t.id ? 'border-[var(--accent)] bg-[var(--bg-card)]' : 'border-[var(--border)] hover:border-[var(--accent)]/50'
                      }`}>
                      <span className="text-lg">{t.emoji}</span>
                      <span className="ml-2 text-sm font-medium text-[var(--text-primary)]">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 字体大小 */}
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-3">字体大小</label>
                <div className="flex gap-2">
                  {(['small','medium','large'] as FontSize[]).map(s => (
                    <button key={s} onClick={() => handleFontSizeChange(s)}
                      className={`flex-1 py-2.5 rounded-xl text-sm border transition-colors ${
                        currentFontSize === s ? 'border-[var(--accent)] bg-[var(--bg-card)] text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-secondary)]'
                      }`}>
                      {{small:'小',medium:'中',large:'大'}[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === API 设置 === */}
        {page === 'api' && (
          <div>
            <div className="flex items-center gap-3 px-5 pt-6 pb-4">
              <button onClick={() => setPage('menu')}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors">
                ← 返回
              </button>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">🔑 API 设置</h2>
            </div>

            <div className="px-6 pb-6 space-y-3">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">API Key</label>
                <input type="password" value={state.apiKey} onChange={e => actions.setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]" />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">提供商</label>
                  <select value={state.provider} onChange={e => {
                    const p = e.target.value as 'anthropic' | 'openai' | 'deepseek' | 'custom'
                    actions.setProvider(p)
                    const defaults: Record<string, string> = { anthropic: 'claude-sonnet-4-6', openai: 'gpt-4o', deepseek: 'deepseek-chat', custom: '' }
                    actions.setModel(defaults[p])
                  }}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)]">
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
                <div className="flex-[2]">
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">模型名</label>
                  <input type="text" value={state.model} onChange={e => actions.setModel(e.target.value)}
                    placeholder="模型名"
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]" />
                </div>
              </div>

              {state.provider === 'custom' && (
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">API 地址</label>
                  <input type="text" value={state.customBaseURL} onChange={e => actions.setCustomBaseURL(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]" />
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button onClick={handleTest} disabled={testStatus === 'testing'}
                  className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50">
                  {testStatus === 'testing' ? '⏳ 测试中...' : '🧪 测试连接'}
                </button>
                {testMessage && (
                  <span className={`text-sm ${testStatus === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{testMessage}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

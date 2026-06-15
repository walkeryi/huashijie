'use client'

import { useState } from 'react'
import { useGame } from '@/lib/game-context'
import { themes, loadTheme, saveTheme, applyTheme, loadFontSize, saveFontSize, applyFontSize, FontSize } from '@/lib/theme'

type TabType = 'theme' | 'api'

export default function SystemSettings() {
  const { state, actions } = useGame()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabType>('theme')

  // API
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState('')

  // 主题 + 字体
  const [currentTheme, setCurrentTheme] = useState(loadTheme())
  const [currentFontSize, setCurrentFontSize] = useState(loadFontSize())

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTab('theme') }}
        className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center text-lg"
        style={{
          borderRadius: 'var(--border-radius)',
          background: 'var(--bg-card)',
          border: 'var(--border-width) var(--border-style) var(--border)',
        }}
        title="设置"
      >
        ⚙️
      </button>
    )
  }

  const close = () => setOpen(false)

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
      <div className="w-full max-w-md shadow-2xl overflow-hidden"
        style={{
          background: 'var(--bg-secondary)',
          border: 'var(--border-width) var(--border-style) var(--border)',
          borderRadius: 'var(--border-radius)',
        }}>

        {/* 标签栏 */}
        <div className="flex border-b px-6 pt-6"
          style={{ borderColor: 'var(--border)' } as React.CSSProperties}>
          <button onClick={() => setTab('theme')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative -mb-[var(--border-width)] ${
              tab === 'theme' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            style={tab === 'theme' ? {
              borderBottom: 'var(--border-width) var(--border-style) var(--accent)',
              borderRadius: 'calc(var(--border-radius) - 0.25rem) calc(var(--border-radius) - 0.25rem) 0 0',
            } : {}}
          >🎨 主题</button>
          <button onClick={() => setTab('api')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'api' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            style={tab === 'api' ? {
              borderBottom: 'var(--border-width) var(--border-style) var(--accent)',
              borderRadius: 'calc(var(--border-radius) - 0.25rem) calc(var(--border-radius) - 0.25rem) 0 0',
            } : {}}
          >🔑 API</button>
        </div>

        {/* 主题标签 */}
        {tab === 'theme' && (
          <div className="px-6 py-6 space-y-6">
            {/* 主题配色 */}
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-3">主题风格</label>
              <div className="grid grid-cols-2 gap-3">
                {themes.map(t => (
                  <button key={t.id} onClick={() => handleThemeChange(t.id)}
                    className="p-4 text-left transition-all"
                    style={{
                      border: currentTheme === t.id
                        ? 'var(--border-width) var(--border-style) var(--accent)'
                        : 'var(--border-width) var(--border-style) var(--border)',
                      borderRadius: 'var(--border-radius)',
                      background: 'var(--bg-card)',
                      boxShadow: currentTheme === t.id ? 'var(--button-depth)' : 'none',
                    }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{t.emoji}</span>
                      <span className="font-medium text-[var(--text-primary)]">{t.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <span className="w-3 h-3 rounded-full" style={{background: t.vars['--accent']}} />
                      <span className="w-3 h-3 rounded-full" style={{background: t.vars['--text-primary']}} />
                      <span className="w-3 h-3 rounded-full" style={{background: t.vars['--bg-primary']}} />
                    </div>
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
                    style={{
                      border: currentFontSize === s
                        ? 'var(--border-width) var(--border-style) var(--accent)'
                        : 'var(--border-width) var(--border-style) var(--border)',
                      borderRadius: 'var(--border-radius)',
                      background: currentFontSize === s ? 'var(--bg-card)' : 'transparent',
                      color: currentFontSize === s ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                    className="flex-1 py-2.5 text-sm transition-colors">
                    {{small:'小',medium:'中',large:'大'}[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* API 标签 */}
        {tab === 'api' && (
          <div className="px-6 py-6 space-y-3">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">API Key</label>
              <input type="password" value={state.apiKey} onChange={e => {
                  console.log('🔍 INPUT: apiKey onChange, 新值长度=', e.target.value.length, '前5字符=', e.target.value.slice(0,5))
                  actions.setApiKey(e.target.value)
                }}
                placeholder="sk-..."
                style={{
                  border: 'var(--border-width) var(--border-style) var(--border)',
                  borderRadius: 'var(--border-radius)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                }}
                className="w-full px-4 py-2.5 outline-none text-sm placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)]" />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm text-[var(--text-secondary)] mb-1">提供商</label>
                <select value={state.provider} title="选择AI提供商" onChange={e => {
                  const p = e.target.value as 'anthropic' | 'openai' | 'deepseek' | 'custom'
                  actions.setProvider(p)
                }}
                  style={{
                    border: 'var(--border-width) var(--border-style) var(--border)',
                    borderRadius: 'var(--border-radius)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                  }}
                  className="w-full px-3 py-2.5 outline-none text-sm">
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
                  style={{
                    border: 'var(--border-width) var(--border-style) var(--border)',
                    borderRadius: 'var(--border-radius)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                  }}
                  className="w-full px-3 py-2.5 outline-none text-sm placeholder:text-[var(--text-secondary)]" />
              </div>
            </div>

            {state.provider === 'custom' && (
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">API 地址</label>
                <input type="text" value={state.customBaseURL} onChange={e => actions.setCustomBaseURL(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  style={{
                    border: 'var(--border-width) var(--border-style) var(--border)',
                    borderRadius: 'var(--border-radius)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                  }}
                  className="w-full px-4 py-2.5 outline-none text-sm placeholder:text-[var(--text-secondary)]" />
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button onClick={handleTest} disabled={testStatus === 'testing'}
                style={{
                  border: 'var(--border-width) var(--border-style) var(--border)',
                  borderRadius: 'var(--border-radius)',
                  background: 'var(--bg-card)',
                }}
                className="px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--accent)] disabled:opacity-50">
                {testStatus === 'testing' ? '⏳ 测试中...' : '🧪 测试连接'}
              </button>
              {testMessage && (
                <span className={`text-sm ${testStatus === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{testMessage}</span>
              )}
            </div>
          </div>
        )}

        {/* 关闭按钮 */}
        <div className="px-6 pb-6">
          <button onClick={close}
            style={{
              border: 'var(--border-width) var(--border-style) var(--border)',
              borderRadius: 'var(--border-radius)',
              color: 'var(--text-secondary)',
            }}
            className="w-full py-2.5 text-sm transition-colors hover:text-[var(--text-primary)]">
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

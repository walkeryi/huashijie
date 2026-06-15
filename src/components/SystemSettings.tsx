'use client'

import { useState, useEffect, useRef } from 'react'
import { useGame } from '@/lib/game-context'
import { themes, loadTheme, saveTheme, applyTheme, loadFontSize, saveFontSize, applyFontSize, FontSize } from '@/lib/theme'
import { ModelIcon } from '@lobehub/icons'
import type { Protocol, PresetProvider } from '@/lib/types'

type TabType = 'theme' | 'api'

// ========== 预设供应商定义 ==========

interface PresetDef {
  id: string
  name: string
  provider: 'anthropic' | 'openai' | 'deepseek' | 'custom'
  apiBaseURL: string
  defaultModel: string
  protocol: Protocol
  modelKey: string
}

const PRESETS: PresetDef[] = [
  { id: 'openai', name: 'OpenAI', provider: 'openai', apiBaseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', protocol: 'openai', modelKey: 'gpt-4o' },
  { id: 'anthropic', name: 'Anthropic', provider: 'anthropic', apiBaseURL: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-6', protocol: 'anthropic', modelKey: 'claude-sonnet-4-6' },
  { id: 'deepseek', name: 'DeepSeek', provider: 'deepseek', apiBaseURL: 'https://api.deepseek.com', defaultModel: 'deepseek-chat', protocol: 'openai', modelKey: 'deepseek-chat' },
  { id: 'custom', name: '自定义', provider: 'custom', apiBaseURL: '', defaultModel: '', protocol: 'openai', modelKey: '' },
]

// ========== 高级选项子组件 ==========

function AdvancedSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void
}) {
  const selectStyle: React.CSSProperties = {
    border: 'var(--border-width) var(--border-style) var(--border)',
    borderRadius: 'var(--border-radius)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
  }
  return (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={selectStyle}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function AdvancedToggle({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      <button onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-colors relative ${value ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${value ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

function AdvancedNumber({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void
}) {
  const inputStyle: React.CSSProperties = {
    border: 'var(--border-width) var(--border-style) var(--border)',
    borderRadius: 'var(--border-radius)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
  }
  return (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">{label}</label>
      <input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        min={min} max={max} step={step}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
    </div>
  )
}

export default function SystemSettings({ inline }: { inline?: boolean }) {
  const { state, actions, dispatch } = useGame()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabType>('theme')

  // 持续监控 apiKey
  const keyRef = useRef(state.apiKey)
  useEffect(() => {
    const old = keyRef.current
    const now = state.apiKey
    if (old !== now) {
      console.log('[监控] apiKey变化 长度:', now.length, '内容:', now.slice(0,20)+(now.length>20?'...':''), 'provider:', state.provider)
      keyRef.current = now
    }
  })
  // 监控 open 状态
  useEffect(() => {
    console.log('[监控] 设置面板:', open ? '打开了' : '关闭了', '当前apiKey:', state.apiKey.slice(0,20)+(state.apiKey.length>20?'...':''))
  }, [open])

  // API
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState('')

  // 主题 + 字体
  const [currentTheme, setCurrentTheme] = useState(loadTheme())
  const [currentFontSize, setCurrentFontSize] = useState(loadFontSize())
  const [showKey, setShowKey] = useState(false)
  const autofillRef = useRef(false)

  const handleApiKeyAnimationStart: React.AnimationEventHandler<HTMLInputElement> = (e) => {
    if (e.animationName === 'huashijie-autofill-detected') {
      autofillRef.current = true
    } else if (e.animationName === 'huashijie-autofill-cleared') {
      autofillRef.current = false
    }
  }

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (autofillRef.current) {
      autofillRef.current = false // 复位
      return // 拒绝自动填充的值
    }
    actions.setApiKey(e.target.value)
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTab('theme') }}
        className={inline
          ? 'w-10 h-10 flex items-center justify-center text-lg'
          : 'fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center text-lg'
        }
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
          <div className="px-6 py-6 space-y-4">
            {/* 预设供应商标题 */}
            <label className="block text-sm font-medium text-[var(--text-secondary)]">
              预设供应商
            </label>

            {/* 预设按钮 */}
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map(p => {
                const active = state.provider === p.provider && state.providerName === p.name
                return (
                  <button key={p.id}
                    onClick={() => {
                      const preset: PresetProvider = {
                        id: p.id, name: p.name, provider: p.provider,
                        apiBaseURL: p.apiBaseURL, defaultModel: p.defaultModel,
                        protocol: p.protocol, icon: p.modelKey,
                      }
                      dispatch({ type: 'APPLY_PRESET', preset })
                    }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg text-xs transition-all ${
                      active
                        ? 'ring-2 ring-[var(--accent)] bg-[var(--bg-card)]'
                        : 'bg-[var(--bg-card)]/50 hover:bg-[var(--bg-card)] border border-[var(--border)]'
                    }`}
                  >
                    {p.modelKey ? (
                      <ModelIcon model={p.modelKey} size={28} type="color" />
                    ) : (
                      <div className="w-7 h-7 flex items-center justify-center text-lg">⚙️</div>
                    )}
                    <span className="text-[var(--text-primary)] text-[11px] leading-tight">{p.name}</span>
                  </button>
                )
              })}
            </div>

            {/* 供应商名称 */}
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">供应商名称</label>
              <input type="text" value={state.providerName}
                onChange={e => dispatch({ type: 'SET_PROVIDER_NAME', name: e.target.value })}
                placeholder="例如：OpenAI"
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                style={{
                  border: 'var(--border-width) var(--border-style) var(--border)',
                  borderRadius: 'var(--border-radius)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                }} />
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">API Key</label>
              <div className="relative">
                <input type="text" value={state.apiKey} onChange={handleApiKeyChange}
                  onAnimationStart={handleApiKeyAnimationStart}
                  placeholder="sk-..." autoComplete="off"
                  style={{
                    WebkitTextSecurity: showKey ? 'none' : 'disc',
                    border: 'var(--border-width) var(--border-style) var(--border)',
                    borderRadius: 'var(--border-radius)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                  } as React.CSSProperties}
                  className="huashijie-apikey w-full px-4 py-2.5 pr-10 outline-none text-sm font-mono placeholder:text-[var(--text-secondary)]" />
                <button onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]/30 transition-colors"
                  title={showKey ? '隐藏' : '显示'}>
                  {showKey ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* 请求地址 */}
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">请求地址</label>
              <input type="text" value={state.apiBaseURL}
                onChange={e => dispatch({ type: 'SET_API_BASE_URL', url: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                style={{
                  border: 'var(--border-width) var(--border-style) var(--border)',
                  borderRadius: 'var(--border-radius)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                }} />
            </div>

            {/* 模型名称 */}
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">模型名称</label>
              <input type="text" value={state.model}
                onChange={e => actions.setModel(e.target.value)}
                placeholder="例如：gpt-4o"
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                style={{
                  border: 'var(--border-width) var(--border-style) var(--border)',
                  borderRadius: 'var(--border-radius)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                }} />
            </div>

            {/* 高级分割线 */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-xs text-[var(--text-secondary)]">高级选项</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            {/* 协议兼容 */}
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">协议兼容</label>
              <div className="flex gap-2">
                {(['openai', 'anthropic'] as Protocol[]).map(p => (
                  <button key={p}
                    onClick={() => dispatch({ type: 'SET_PROTOCOL', protocol: p })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      state.protocol === p
                        ? 'ring-2 ring-[var(--accent)] bg-[var(--bg-card)] text-[var(--text-primary)]'
                        : 'bg-[var(--bg-card)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
                    }`}>
                    {p === 'openai' ? '🧬 OpenAI 兼容' : '🔷 Anthropic'}
                  </button>
                ))}
              </div>
            </div>

            {/* 高级参数 — OpenAI 协议 */}
            {state.protocol === 'openai' ? (
              <>
                <AdvancedSelect label="Thinking" value={state.advancedParams?.thinking ?? 'enabled'} options={['enabled', 'disabled']}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { thinking: v as 'enabled' | 'disabled' } })} />
                <AdvancedSelect label="Reasoning Effort" value={state.advancedParams?.reasoning_effort ?? 'high'} options={['low', 'medium', 'high']}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { reasoning_effort: v as 'low' | 'medium' | 'high' } })} />
                <AdvancedToggle label="Stream" value={state.advancedParams?.stream ?? false}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { stream: v } })} />
                <AdvancedNumber label="Temperature" value={state.advancedParams?.temperature ?? 0.7} min={0} max={2} step={0.1}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { temperature: v } })} />
                <AdvancedNumber label="Max Tokens" value={state.advancedParams?.max_tokens ?? 4096} min={1} max={128000}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { max_tokens: v } })} />
                <AdvancedNumber label="Top P" value={state.advancedParams?.top_p ?? 1} min={0} max={1} step={0.05}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { top_p: v } })} />
              </>
            ) : (
              <>
                <AdvancedNumber label="Max Tokens" value={state.advancedParams?.max_tokens ?? 4096} min={1} max={128000}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { max_tokens: v } })} />
                <AdvancedNumber label="Temperature" value={state.advancedParams?.temperature ?? 0.7} min={0} max={1} step={0.1}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { temperature: v } })} />
                <AdvancedNumber label="Top P" value={state.advancedParams?.top_p ?? 1} min={0} max={1} step={0.05}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { top_p: v } })} />
                <AdvancedNumber label="Top K" value={state.advancedParams?.top_k ?? 40} min={0} max={100}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { top_k: v } })} />
              </>
            )}

            {/* 测试连接 */}
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

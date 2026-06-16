'use client'

import { useState, useEffect, useRef } from 'react'
import { useGame, loadApiConfigForProvider } from '@/lib/game-context'
import { themes, loadTheme, saveTheme, setTheme, loadFontSize, saveFontSize, applyFontSize, FontSize } from '@/lib/theme'
import { ModelIcon } from '@lobehub/icons'
import type { Protocol, PresetProvider } from '@/lib/types'

type TabType = 'theme' | 'api'

// ========== 自定义预设 ==========

interface CustomPreset {
  id: string
  name: string
  provider: 'custom'
  apiKey: string
  apiBaseURL: string
  model: string
  protocol: Protocol
  advancedParams?: Record<string, unknown>
}

const CUSTOM_PRESETS_KEY = 'adventure_custom_presets'

function loadCustomPresets(): CustomPreset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveCustomPresets(presets: CustomPreset[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets))
}

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

function AdvancedSelect({ label, value, options, labels, onChange }: {
  label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (v: string) => void
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
        {options.map(o => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
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
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(loadCustomPresets)
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
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: state.apiKey, provider: state.provider, model: state.model, customBaseURL: state.customBaseURL }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      if (data.ok) { setTestStatus('ok'); setTestMessage(`连接成功 · ${data.latency}ms`) }
      else { setTestStatus('fail'); setTestMessage(data.error || '连接失败') }
    } catch (e: unknown) {
      clearTimeout(timer)
      if (e instanceof DOMException && e.name === 'AbortError') {
        setTestStatus('fail'); setTestMessage('连接超时（10秒）')
      } else {
        setTestStatus('fail'); setTestMessage('网络错误')
      }
    }
  }

  const handleThemeChange = (id: string) => {
    const theme = themes.find(t => t.id === id)
    if (!theme) return
    setCurrentTheme(id)
    saveTheme(id)
    setTheme(theme.id)
  }

  const handleFontSizeChange = (size: FontSize) => {
    setCurrentFontSize(size)
    saveFontSize(size)
    applyFontSize(size)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 py-8">
      <div className="w-full max-w-md shadow-2xl flex flex-col overflow-hidden h-[85vh]"
        style={{
          background: 'var(--bg-secondary)',
          border: 'var(--border-width) var(--border-style) var(--border)',
          borderRadius: 'var(--border-radius)',
        }}>

        {/* 标签栏 + 关闭按钮 */}
        <div className="flex items-center border-b px-6 pt-6"
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
          {/* 右上角关闭按钮 */}
          <button onClick={close}
            className="ml-auto text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1"
            title="关闭">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="5" y1="5" x2="15" y2="15" />
              <line x1="15" y1="5" x2="5" y2="15" />
            </svg>
          </button>
        </div>

        {/* 可滚动内容区 */}
        <div className="overflow-y-scroll flex-1 px-6 py-6 settings-scroll">
        {/* 主题标签 */}
        {tab === 'theme' && (
          <div className="space-y-6">
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
          <div className="space-y-4">
            {/* 预设供应商标题 */}
            <label className="block text-sm font-medium text-[var(--text-secondary)]">
              预设供应商
            </label>

            {/* 预设按钮 */}
            <div className="flex flex-wrap gap-2">
              {/* 三个硬编码预设 */}
              {PRESETS.filter(p => p.id !== 'custom').map(p => {
                const active = state.provider === p.provider
                return (
                  <button key={p.id}
                    onClick={() => {
                      const saved = loadApiConfigForProvider(p.provider)
                      const preset: PresetProvider = {
                        id: p.id, name: p.name, provider: p.provider,
                        apiBaseURL: p.apiBaseURL, defaultModel: p.defaultModel,
                        protocol: p.protocol, icon: p.modelKey,
                      }
                      dispatch({
                        type: 'APPLY_PRESET', preset,
                        apiKey: saved.apiKey,
                        model: saved.model || p.defaultModel,
                        customBaseURL: saved.customBaseURL || '',
                        protocol: saved.protocol || p.protocol,
                        providerName: saved.providerName || p.name,
                        apiBaseURL: saved.apiBaseURL || p.apiBaseURL,
                        advancedParams: Object.keys(saved.advancedParams || {}).length > 0 ? saved.advancedParams : undefined,
                      })
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                      active
                        ? 'ring-2 ring-[var(--accent)] bg-[var(--bg-card)]'
                        : 'bg-[var(--bg-card)]/50 hover:bg-[var(--bg-card)] border border-[var(--border)]'
                    }`}
                  >
                    {p.modelKey ? (
                      <ModelIcon model={p.modelKey} size={18} type="color" />
                    ) : (
                      <div className="w-[18px] h-[18px] flex items-center justify-center text-sm">⚙️</div>
                    )}
                    <span className="text-[var(--text-primary)] text-[11px] leading-tight">{p.name}</span>
                  </button>
                )
              })}
              {/* 自定义预设 */}
              {customPresets.map(cp => {
                const active = state.provider === 'custom' && state.providerName === cp.name
                return (
                  <button key={cp.id}
                    onClick={() => {
                      const preset: PresetProvider = {
                        id: 'custom', name: cp.name, provider: 'custom',
                        apiBaseURL: cp.apiBaseURL, defaultModel: cp.model,
                        protocol: cp.protocol, icon: '',
                      }
                      dispatch({
                        type: 'APPLY_PRESET', preset,
                        apiKey: cp.apiKey,
                        model: cp.model,
                        customBaseURL: '',
                        protocol: cp.protocol,
                        providerName: cp.name,
                        apiBaseURL: cp.apiBaseURL,
                        advancedParams: cp.advancedParams as Record<string, unknown> | undefined,
                      })
                    }}
                    className={`group inline-flex items-center gap-1.5 pl-3 pr-1 py-1.5 rounded-full text-xs transition-all ${
                      active
                        ? 'ring-2 ring-[var(--accent)] bg-[var(--bg-card)]'
                        : 'bg-[var(--bg-card)]/50 hover:bg-[var(--bg-card)] border border-[var(--border)]'
                    }`}
                  >
                    <span className="text-[var(--text-primary)] text-[11px] leading-tight">{cp.name}</span>
                    <span onClick={(e) => {
                      e.stopPropagation()
                      const updated = customPresets.filter(x => x.id !== cp.id)
                      setCustomPresets(updated)
                      saveCustomPresets(updated)
                      // 如果删除的是当前激活的，切到默认自定义
                      if (active) {
                        const preset: PresetProvider = {
                          id: 'custom', name: '自定义', provider: 'custom',
                          apiBaseURL: '', defaultModel: '', protocol: 'openai', icon: '',
                        }
                        dispatch({ type: 'APPLY_PRESET', preset, apiKey: '', model: '', customBaseURL: '', protocol: 'openai', providerName: '', apiBaseURL: '' })
                      }
                    }}
                      className="w-5 h-5 flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="删除">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                        <line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/>
                      </svg>
                    </span>
                  </button>
                )
              })}
              {/* 自定义按钮（固定最后） */}
              {(() => {
                const p = PRESETS.find(x => x.id === 'custom')!
                const active = state.provider === 'custom' && !customPresets.some(cp => cp.name === state.providerName)
                return (
                  <button key="custom"
                    onClick={() => {
                      const preset: PresetProvider = {
                        id: p.id, name: p.name, provider: p.provider,
                        apiBaseURL: p.apiBaseURL, defaultModel: p.defaultModel,
                        protocol: p.protocol, icon: p.modelKey,
                      }
                      dispatch({
                        type: 'APPLY_PRESET', preset,
                        apiKey: '', model: '', customBaseURL: '', protocol: 'openai', providerName: '', apiBaseURL: '',
                      })
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                      active
                        ? 'ring-2 ring-[var(--accent)] bg-[var(--bg-card)]'
                        : 'bg-[var(--bg-card)]/50 hover:bg-[var(--bg-card)] border border-[var(--border)]'
                    }`}
                  >
                    <div className="w-[18px] h-[18px] flex items-center justify-center text-sm">⚙️</div>
                    <span className="text-[var(--text-primary)] text-[11px] leading-tight">自定义</span>
                  </button>
                )
              })()}
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
              <label className="block text-sm text-[var(--text-secondary)] mb-1">API 密钥</label>
              <div className="relative">
                <input type="text" value={state.apiKey} onChange={handleApiKeyChange}
                  onAnimationStart={handleApiKeyAnimationStart}
                  placeholder="请先选择预设供应商，再输入密钥" autoComplete="off"
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
                {([
                  { key: 'openai' as Protocol, label: 'OpenAI 兼容', modelKey: 'gpt-4o' },
                  { key: 'anthropic' as Protocol, label: 'Anthropic', modelKey: 'claude-sonnet-4-6' },
                ].map(p => (
                  <button key={p.key}
                    onClick={() => dispatch({ type: 'SET_PROTOCOL', protocol: p.key })}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                      state.protocol === p.key
                        ? 'ring-2 ring-[var(--accent)] bg-[var(--bg-card)] text-[var(--text-primary)]'
                        : 'bg-[var(--bg-card)]/50 hover:bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}>
                    <ModelIcon model={p.modelKey} size={18} type="color" />
                    {p.label}
                  </button>
                )))}
              </div>
            </div>

            {/* 高级参数 — OpenAI 协议 */}
            {state.protocol === 'openai' ? (
              <>
                <AdvancedSelect label="推理力度" value={state.advancedParams?.reasoning_effort ?? 'high'} options={['low', 'medium', 'high']}
                  labels={{ low: '低', medium: '中', high: '高' }}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { reasoning_effort: v as 'low' | 'medium' | 'high' } })} />
                <AdvancedToggle label="流式输出" value={state.advancedParams?.stream ?? false}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { stream: v } })} />
                <AdvancedNumber label="温度" value={state.advancedParams?.temperature ?? 0.7} min={0} max={2} step={0.1}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { temperature: v } })} />
                <AdvancedNumber label="最大令牌数" value={state.advancedParams?.max_tokens ?? 4096} min={1} max={128000}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { max_tokens: v } })} />
                <AdvancedNumber label="核采样" value={state.advancedParams?.top_p ?? 1} min={0} max={1} step={0.05}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { top_p: v } })} />
              </>
            ) : (
              <>
                <AdvancedSelect label="思考模式" value={state.advancedParams?.thinking ?? 'enabled'} options={['enabled', 'disabled']}
                  labels={{ enabled: '启用', disabled: '禁用' }}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { thinking: v as 'enabled' | 'disabled' } })} />
                <AdvancedToggle label="流式输出" value={state.advancedParams?.stream ?? false}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { stream: v } })} />
                <AdvancedNumber label="最大令牌数" value={state.advancedParams?.max_tokens ?? 4096} min={1} max={128000}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { max_tokens: v } })} />
                <AdvancedNumber label="温度" value={state.advancedParams?.temperature ?? 0.7} min={0} max={1} step={0.1}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { temperature: v } })} />
                <AdvancedNumber label="核采样" value={state.advancedParams?.top_p ?? 1} min={0} max={1} step={0.05}
                  onChange={v => dispatch({ type: 'SET_ADVANCED_PARAMS', params: { top_p: v } })} />
                <AdvancedNumber label="候选数" value={state.advancedParams?.top_k ?? 40} min={0} max={100}
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

            {/* 添加供应商 — 仅自定义模式 */}
            {state.provider === 'custom' && (
              <button
                onClick={() => {
                  const name = state.providerName.trim()
                  if (!name) { setTestStatus('fail'); setTestMessage('请先填写供应商名称'); return }
                  if (customPresets.some(cp => cp.name === name)) { setTestStatus('fail'); setTestMessage('该名称已存在'); return }
                  const cp: CustomPreset = {
                    id: 'custom_' + Date.now(),
                    name,
                    provider: 'custom',
                    apiKey: state.apiKey,
                    apiBaseURL: state.apiBaseURL,
                    model: state.model,
                    protocol: state.protocol,
                    advancedParams: state.advancedParams as Record<string, unknown>,
                  }
                  const updated = [...customPresets, cp]
                  setCustomPresets(updated)
                  saveCustomPresets(updated)
                  setTestStatus('ok'); setTestMessage(`已添加「${name}」`)
                  setTimeout(() => setTestStatus('idle'), 2000)
                }}
                style={{
                  border: 'var(--border-width) var(--border-style) var(--accent)',
                  borderRadius: 'var(--border-radius)',
                  color: 'var(--accent)',
                }}
                className="w-full py-2.5 text-sm font-medium transition-colors hover:bg-[var(--accent)]/10"
              >
                + 添加供应商
              </button>
            )}
          </div>
        )}

        </div>
      </div>
    </div>
  )
}

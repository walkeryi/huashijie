'use client'

import { useState } from 'react'
import { useGame } from '@/lib/game-context'

export default function SystemSettings() {
  const { state, actions } = useGame()
  const [open, setOpen] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState('')

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-lg"
        title="系统设置"
      >
        ⚙️
      </button>
    )
  }

  const handleTest = async () => {
    if (!state.apiKey) { setTestStatus('fail'); setTestMessage('请先输入 API Key'); return }
    setTestStatus('testing')
    setTestMessage('')
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: state.apiKey,
          provider: state.provider,
          model: state.model,
          customBaseURL: state.customBaseURL,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setTestStatus('ok')
        setTestMessage(`连接成功 · ${data.latency}ms`)
      } else {
        setTestStatus('fail')
        setTestMessage(data.error || '连接失败')
      }
    } catch {
      setTestStatus('fail')
      setTestMessage('网络错误')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold">⚙️ 系统设置</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* API Key */}
        <div className="mb-3">
          <label className="block text-sm text-[var(--text-secondary)] mb-1">API Key</label>
          <input
            type="password"
            value={state.apiKey}
            onChange={e => actions.setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
          />
        </div>

        {/* Provider + Model */}
        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <label className="block text-sm text-[var(--text-secondary)] mb-1">提供商</label>
            <select
              value={state.provider}
              onChange={e => {
                const p = e.target.value as 'anthropic' | 'openai' | 'deepseek' | 'custom'
                actions.setProvider(p)
                const defaults: Record<string, string> = { anthropic: 'claude-sonnet-4-6', openai: 'gpt-4o', deepseek: 'deepseek-chat', custom: '' }
                actions.setModel(defaults[p])
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)]"
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          <div className="flex-[2]">
            <label className="block text-sm text-[var(--text-secondary)] mb-1">模型名</label>
            <input
              type="text"
              value={state.model}
              onChange={e => actions.setModel(e.target.value)}
              placeholder="模型名"
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
            />
          </div>
        </div>

        {/* Custom base URL */}
        {state.provider === 'custom' && (
          <div className="mb-3">
            <label className="block text-sm text-[var(--text-secondary)] mb-1">API 地址</label>
            <input
              type="text"
              value={state.customBaseURL}
              onChange={e => actions.setCustomBaseURL(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
            />
          </div>
        )}

        {/* Test connection */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testStatus === 'testing'}
            className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50"
          >
            {testStatus === 'testing' ? '⏳ 测试中...' : '🧪 测试连接'}
          </button>
          {testMessage && (
            <span className={`text-sm ${testStatus === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
              {testMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

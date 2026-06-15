'use client'

import { useState } from 'react'
import { useGame } from '@/lib/game-context'
import * as saveService from '@/lib/save-service'
import { onlineRegister, onlineLogin } from '@/lib/online-storage'
import { localListSaves } from '@/lib/local-storage'

type TabType = 'api' | 'storage'

export default function SystemSettings() {
  const { state, actions } = useGame()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabType>('api')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState('')

  // 存储标签状态
  const [accountName, setAccountName] = useState(saveService.getModeConfig().accountName)
  const [password, setPassword] = useState('')
  const [storageStatus, setStorageStatus] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(
    saveService.isOnline() && !!saveService.getAccountName()
  )
  const [migrating, setMigrating] = useState(false)
  const [localSaveCount, setLocalSaveCount] = useState(0)

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

  const handleRegister = async () => {
    if (!accountName.trim() || !password) {
      setStorageStatus('请填写账户名和密码')
      return
    }
    setStorageStatus('注册中...')
    try {
      await onlineRegister(accountName.trim(), password)
      saveService.savePassword(password)
      saveService.setMode('online', accountName.trim())
      actions.setSaveMode('online', accountName.trim())
      setIsLoggedIn(true)
      setStorageStatus('✅ 注册成功，已登录')
      const count = localListSaves().length
      setLocalSaveCount(count)
    } catch (e: any) {
      setStorageStatus('❌ ' + (e.message || '注册失败'))
    }
  }

  const handleLogin = async () => {
    if (!accountName.trim() || !password) {
      setStorageStatus('请填写账户名和密码')
      return
    }
    setStorageStatus('登录中...')
    try {
      await onlineLogin(accountName.trim(), password)
      saveService.savePassword(password)
      saveService.setMode('online', accountName.trim())
      actions.setSaveMode('online', accountName.trim())
      setIsLoggedIn(true)
      setStorageStatus('✅ 登录成功')
      const count = localListSaves().length
      setLocalSaveCount(count)
    } catch (e: any) {
      setStorageStatus('❌ ' + (e.message || '登录失败'))
    }
  }

  const handleLogout = () => {
    saveService.setMode('offline', '')
    saveService.clearPassword()
    actions.setSaveMode('offline', '')
    setIsLoggedIn(false)
    setAccountName('')
    setPassword('')
    setStorageStatus('已退出登录')
    setLocalSaveCount(0)
  }

  const handleMigrate = async () => {
    setMigrating(true)
    setStorageStatus('迁移中...')
    try {
      const result = await saveService.migrateLocalToOnline()
      if (result.success) {
        setStorageStatus(`✅ 已迁移 ${result.count} 个存档`)
        setLocalSaveCount(0)
      } else {
        setStorageStatus('❌ 迁移失败，请重试')
      }
    } catch {
      setStorageStatus('❌ 迁移失败')
    } finally {
      setMigrating(false)
    }
  }

  const handleSwitchOffline = () => {
    saveService.setMode('offline', '')
    saveService.clearPassword()
    actions.setSaveMode('offline', '')
    setIsLoggedIn(false)
    setStorageStatus('')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('api')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                tab === 'api' ? 'bg-[var(--accent)] text-[var(--bg-primary)]' : 'text-[var(--text-secondary)]'
              }`}
            >API</button>
            <button
              onClick={() => { setTab('storage'); setLocalSaveCount(localListSaves().length) }}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                tab === 'storage' ? 'bg-[var(--accent)] text-[var(--bg-primary)]' : 'text-[var(--text-secondary)]'
              }`}
            >存储</button>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >✕</button>
        </div>

        {tab === 'api' && (
          <>
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
            <div className="flex items-center gap-3">
              <button
                onClick={handleTest}
                disabled={testStatus === 'testing'}
                className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50"
              >
                {testStatus === 'testing' ? '⏳ 测试中...' : '🧪 测试连接'}
              </button>
              {testMessage && (
                <span className={`text-sm ${testStatus === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{testMessage}</span>
              )}
            </div>
          </>
        )}

        {tab === 'storage' && (
          <>
            {/* 模式选择 */}
            <div className="mb-4">
              <label className="block text-sm text-[var(--text-secondary)] mb-2">存档模式</label>
              <div className="flex gap-2">
                <button
                  onClick={handleSwitchOffline}
                  className={`flex-1 py-2 rounded-xl text-sm border transition-colors ${
                    !isLoggedIn
                      ? 'border-[var(--accent)] bg-[var(--bg-card)] text-[var(--text-primary)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)]'
                  }`}
                >
                  💾 离线模式
                </button>
                <button
                  className={`flex-1 py-2 rounded-xl text-sm border transition-colors ${
                    isLoggedIn
                      ? 'border-[var(--accent)] bg-[var(--bg-card)] text-[var(--text-primary)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)]'
                  }`}
                >
                  ☁️ 在线模式
                </button>
              </div>
            </div>

            {/* 在线模式登录区域 */}
            {!isLoggedIn ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">账户名</label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={e => setAccountName(e.target.value)}
                    placeholder="输入账户名"
                    maxLength={50}
                    className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">密码</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="输入密码"
                    maxLength={100}
                    className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRegister}
                    className="flex-1 py-2 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
                  >注册</button>
                  <button
                    onClick={handleLogin}
                    className="flex-1 py-2 rounded-xl border border-[var(--accent)] text-[var(--accent)] text-sm font-medium hover:bg-[var(--bg-card)] transition-colors"
                  >登录</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-400">✅</span>
                  <span className="text-[var(--text-primary)]">已登录: {state.accountName}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full py-2 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-sm hover:border-red-800 hover:text-red-400 transition-colors"
                >退出登录</button>

                {localSaveCount > 0 && (
                  <div className="pt-2 border-t border-[var(--border)]">
                    <p className="text-sm text-[var(--text-secondary)] mb-2">
                      检测到 {localSaveCount} 个本地存档
                    </p>
                    <button
                      onClick={handleMigrate}
                      disabled={migrating}
                      className="w-full py-2 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                    >
                      {migrating ? '迁移中...' : '☁️ 迁移到云端'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {storageStatus && (
              <p className="mt-3 text-sm text-[var(--text-secondary)]">{storageStatus}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useGame } from '@/lib/game-context'
import * as saveService from '@/lib/save-service'
import { onlineRegister, onlineLogin } from '@/lib/online-storage'
import { localListSaves } from '@/lib/local-storage'

type SettingsPage = 'menu' | 'general' | 'api'

export default function SystemSettings() {
  const { state, actions } = useGame()
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState<SettingsPage>('menu')

  // API
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState('')

  // 账户
  const [accountName, setAccountName] = useState('')
  const [password, setPassword] = useState('')
  const [storageStatus, setStorageStatus] = useState('')
  const [migrating, setMigrating] = useState(false)
  const [localSaveCount, setLocalSaveCount] = useState(0)

  const isLoggedIn = saveService.isOnline() && !!saveService.getAccountName()

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

  const handleRegister = async () => {
    if (!accountName.trim() || !password) { setStorageStatus('请填写账户名和密码'); return }
    setStorageStatus('注册中...')
    try {
      await onlineRegister(accountName.trim(), password)
      saveService.savePassword(password)
      saveService.setMode('online', accountName.trim())
      actions.setSaveMode('online', accountName.trim())
      setStorageStatus('✅ 注册成功，已登录')
      setLocalSaveCount(localListSaves().length)
    } catch (e: any) { setStorageStatus('❌ ' + (e.message || '注册失败')) }
  }

  const handleLogin = async () => {
    if (!accountName.trim() || !password) { setStorageStatus('请填写账户名和密码'); return }
    setStorageStatus('登录中...')
    try {
      await onlineLogin(accountName.trim(), password)
      saveService.savePassword(password)
      saveService.setMode('online', accountName.trim())
      actions.setSaveMode('online', accountName.trim())
      setStorageStatus('✅ 登录成功')
      setLocalSaveCount(localListSaves().length)
    } catch (e: any) { setStorageStatus('❌ ' + (e.message || '登录失败')) }
  }

  const handleLogout = () => {
    saveService.setMode('offline', '')
    saveService.clearPassword()
    actions.setSaveMode('offline', '')
    setStorageStatus('已退出登录')
    setLocalSaveCount(0)
  }

  const handleMigrate = async () => {
    setMigrating(true); setStorageStatus('迁移中...')
    try {
      const result = await saveService.migrateLocalToOnline()
      if (result.success) { setStorageStatus(`✅ 已迁移 ${result.count} 个存档`); setLocalSaveCount(0) }
      else { setStorageStatus('❌ 迁移失败，请重试') }
    } catch { setStorageStatus('❌ 迁移失败') }
    finally { setMigrating(false) }
  }

  const handleSwitchOffline = () => {
    saveService.setMode('offline', '')
    saveService.clearPassword()
    actions.setSaveMode('offline', '')
    setStorageStatus('')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* === 主菜单 === */}
        {page === 'menu' && (
          <div>
            <h2 className="text-xl font-bold text-center text-[var(--text-primary)] pt-8 pb-2">⚙️ 设置</h2>
            <div className="px-6 py-6 space-y-3">
              <button onClick={() => { setPage('general'); setLocalSaveCount(localListSaves().length); setStorageStatus('') }}
                className="w-full py-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-left px-5 group">
                <span className="text-2xl mr-3">👤</span>
                <span className="text-lg font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">基础设置</span>
                <span className="text-sm text-[var(--text-secondary)] ml-2">
                  {isLoggedIn ? `☁️ ${state.accountName}` : '💾 离线模式'}
                </span>
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
                返回
              </button>
            </div>
          </div>
        )}

        {/* === 基础设置 === */}
        {page === 'general' && (
          <div>
            <div className="flex items-center px-5 pt-6 pb-4">
              <button onClick={() => setPage('menu')} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-lg mr-3">←</button>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">👤 基础设置</h2>
            </div>

            <div className="px-6 pb-6 space-y-4">
              {/* 模式切换 */}
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">存档模式</label>
                <div className="flex gap-2">
                  <button onClick={handleSwitchOffline}
                    className={`flex-1 py-2.5 rounded-xl text-sm border transition-colors ${!isLoggedIn ? 'border-[var(--accent)] bg-[var(--bg-card)] text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>
                    💾 离线模式
                  </button>
                  <button className={`flex-1 py-2.5 rounded-xl text-sm border transition-colors ${isLoggedIn ? 'border-[var(--accent)] bg-[var(--bg-card)] text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>
                    ☁️ 在线模式
                  </button>
                </div>
              </div>

              {isLoggedIn ? (
                <div className="space-y-3">
                  <div className="text-center py-2">
                    <p className="text-sm text-[var(--text-secondary)]">当前账户</p>
                    <p className="text-lg font-bold text-[var(--text-primary)]">{state.accountName}</p>
                    <p className="text-xs text-green-400">● 已连接</p>
                  </div>
                  <button onClick={handleLogout}
                    className="w-full py-2.5 rounded-xl border border-red-800 text-red-400 text-sm hover:bg-red-900/20 transition-colors">退出登录</button>
                  {localSaveCount > 0 && (
                    <div className="pt-2 border-t border-[var(--border)]">
                      <p className="text-sm text-[var(--text-secondary)] mb-2">检测到 {localSaveCount} 个本地存档</p>
                      <button onClick={handleMigrate} disabled={migrating}
                        className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50">
                        {migrating ? '迁移中...' : '☁️ 迁移到云端'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)}
                    placeholder="账户名" maxLength={50}
                    className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]" />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="密码" maxLength={100}
                    className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]" />
                  <div className="flex gap-2">
                    <button onClick={handleLogin}
                      className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors">登录</button>
                    <button onClick={handleRegister}
                      className="flex-1 py-2.5 rounded-xl border border-[var(--accent)] text-[var(--accent)] text-sm font-medium hover:bg-[var(--bg-card)] transition-colors">注册</button>
                  </div>
                </div>
              )}

              {storageStatus && <p className="text-sm text-center text-[var(--text-secondary)]">{storageStatus}</p>}
            </div>
          </div>
        )}

        {/* === API 设置 === */}
        {page === 'api' && (
          <div>
            <div className="flex items-center px-5 pt-6 pb-4">
              <button onClick={() => setPage('menu')} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-lg mr-3">←</button>
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

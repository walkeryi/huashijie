'use client'

import { useState, useSyncExternalStore } from 'react'
import { useGame } from '@/lib/game-context'
import * as saveService from '@/lib/save-service'
import { onlineRegister, onlineLogin } from '@/lib/online-storage'

export default function AccountButton({ inline }: { inline?: boolean }) {
  const { state, actions } = useGame()
  const [showPanel, setShowPanel] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const isLoggedIn = saveService.isOnline() && !!saveService.getAccountName()

  // SSR 时 false、hydration 后 true，避免 hydration mismatch（替代 mounted + useEffect 模式）
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)

  // 打开面板时重置表单（在事件处理器中重置，而非 effect）
  const openPanel = () => {
    setAccountName('')
    setPassword('')
    setStatus('')
    setShowPanel(true)
  }

  const handleRegister = async () => {
    if (!accountName.trim() || !password) { setStatus('请填写账户名和密码'); return }
    setStatus('注册中...')
    try {
      await onlineRegister(accountName.trim(), password)
      saveService.savePassword(password)
      saveService.setMode('online', accountName.trim())
      actions.setSaveMode('online', accountName.trim())
      setStatus('✅ 注册成功')
      setTimeout(() => setShowPanel(false), 800)
    } catch (e: unknown) { setStatus('❌ ' + (e instanceof Error ? e.message : '注册失败')) }
  }

  const handleLogin = async () => {
    if (!accountName.trim() || !password) { setStatus('请填写账户名和密码'); return }
    setStatus('登录中...')
    try {
      await onlineLogin(accountName.trim(), password)
      saveService.savePassword(password)
      saveService.setMode('online', accountName.trim())
      actions.setSaveMode('online', accountName.trim())
      setStatus('✅ 登录成功')
      setTimeout(() => setShowPanel(false), 800)
    } catch (e: unknown) { setStatus('❌ ' + (e instanceof Error ? e.message : '登录失败')) }
  }

  const handleLogout = () => {
    saveService.setMode('offline', '')
    saveService.clearPassword()
    actions.setSaveMode('offline', '')
    setStatus('已退出登录')
  }

  return (
    <>
      <button
        onClick={openPanel}
        className={inline
          ? 'h-10 px-4 flex items-center gap-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-sm text-[var(--text-primary)]'
          : 'fixed top-4 right-16 z-50 h-10 px-4 flex items-center gap-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-sm text-[var(--text-primary)]'
        }
        title={mounted && isLoggedIn ? `☁️ ${state.accountName}` : '登录云端存档'}
      >
        {mounted ? (
          isLoggedIn ? (
            <><span className="w-2 h-2 rounded-full bg-green-400" /> {state.accountName}</>
          ) : (
            <><span className="text-base">☁️</span> 登录</>
          )
        ) : null}
      </button>

      {showPanel && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowPanel(false)}>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4 text-center text-[var(--text-primary)]">☁️ 云端存档</h2>

            {isLoggedIn ? (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-[var(--text-secondary)]">当前账户</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">{state.accountName}</p>
                  <p className="text-xs text-green-400 mt-1">● 已连接</p>
                </div>
                <button onClick={handleLogout}
                  className="w-full py-2.5 rounded-xl border border-red-800 text-red-400 text-sm hover:bg-red-900/20 transition-colors">
                  退出登录
                </button>
                <button onClick={() => setShowPanel(false)}
                  className="w-full py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-sm hover:bg-[var(--bg-card)] transition-colors">
                  关闭
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-secondary)] text-center">登录后存档可跨设备同步</p>
                <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)}
                  placeholder="账户名" maxLength={50}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="密码" maxLength={100}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]" />
                <div className="flex gap-2">
                  <button onClick={handleLogin}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--bg-primary)] text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors">
                    登录
                  </button>
                  <button onClick={handleRegister}
                    className="flex-1 py-2.5 rounded-xl border border-[var(--accent)] text-[var(--accent)] text-sm font-medium hover:bg-[var(--bg-card)] transition-colors">
                    注册
                  </button>
                </div>
                {status && <p className="text-sm text-center text-[var(--text-secondary)]">{status}</p>}
                <button onClick={() => setShowPanel(false)}
                  className="w-full py-2 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  暂不登录
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

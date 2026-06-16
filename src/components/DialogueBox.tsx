'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useGame } from '@/lib/game-context'
import { createEventBus } from '@/lib/event-bus'
import { ModelIcon } from '@lobehub/icons'
import type { DialogueEntry } from '@/lib/types'

// 模块级 EventBus 单例 — 同一时刻只有一个流
const eventBus = createEventBus()

export default function DialogueBox() {
  const { state } = useGame()
  const { dialogueHistory, isLoading } = state

  const scrollRef = useRef<HTMLDivElement>(null)
  const currentDomRef = useRef<HTMLParagraphElement>(null)
  const bufferRef = useRef('')
  const rafRef = useRef<number>(0)
  const charIndexRef = useRef(0)
  const mountedRef = useRef(true)

  // RAF 打字循环
  const startTyping = useCallback(() => {
    if (rafRef.current) return // 已在运行

    const tick = () => {
      if (!mountedRef.current) return
      const full = bufferRef.current
      if (charIndexRef.current >= full.length) {
        rafRef.current = 0
        return // 暂停，等待下一个 chunk
      }

      // 每帧输出 2-3 个字符（积压多时加速）
      const charsPerFrame = 2 + (full.length - charIndexRef.current > 20 ? 1 : 0)
      charIndexRef.current = Math.min(charIndexRef.current + charsPerFrame, full.length)

      if (currentDomRef.current) {
        currentDomRef.current.textContent = full.slice(0, charIndexRef.current)
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  // 订阅 EventBus
  useEffect(() => {
    const unsub = eventBus.on((chunk) => {
      bufferRef.current += chunk
      if (!rafRef.current) {
        charIndexRef.current = currentDomRef.current?.textContent?.length ?? 0
        startTyping()
      }
    })

    return () => { unsub() }
  }, [startTyping])

  // 挂载/卸载跟踪
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [dialogueHistory])

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto pr-2 space-y-4"
      style={{ maxHeight: 'calc(100vh - 280px)' }}
    >
      {/* Dialogue History */}
      {dialogueHistory.map((entry: DialogueEntry) => {
        const isPlayer = entry.role === 'player'
        return (
          <div
            key={entry.id}
            className={`dialogue-entry flex ${isPlayer ? 'justify-end' : 'justify-start'}`}
            style={
              {
                contentVisibility: 'auto',
                containIntrinsicSize: 'auto 80px',
              } as React.CSSProperties
            }
          >
            <div className={isPlayer ? '' : 'max-w-[80%]'}>
              {!isPlayer && entry.model && (
                <div className="flex items-center gap-1.5 mb-1 ml-1">
                  <ModelIcon model={entry.model} size={32} />
                  <span className="text-base text-[var(--text-secondary)]">{entry.model}</span>
                </div>
              )}
              <div
                className={`p-3 rounded-lg border ${
                  isPlayer
                    ? 'max-w-[80%] border-[var(--accent)] bg-[var(--bg-card)]'
                    : 'border-[var(--border)] bg-[var(--bg-secondary)]'
                }`}
              >
                {isPlayer && (
                  <div className="text-xs text-[var(--accent)] mb-1 font-medium">你</div>
                )}
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {entry.content}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* 打字机当前行 — React 仅管理挂载/卸载，内容由 RAF 直接 DOM 操作 */}
      {isLoading && (
        <div className="flex justify-start">
          <div className="max-w-[80%] p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
            <p
              ref={currentDomRef}
              className="text-sm leading-relaxed whitespace-pre-wrap inline"
            />
            <span className="inline-block w-[2px] h-[1em] bg-[var(--accent)] ml-0.5 align-text-bottom animate-blink" />
          </div>
        </div>
      )}
    </div>
  )
}

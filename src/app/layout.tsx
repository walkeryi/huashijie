import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { GameProvider } from '@/lib/game-context'
import GlobalButtons from '@/components/GlobalButtons'
import { getThemeCookie } from '@/lib/theme'

export const metadata: Metadata = {
  title: '话世界',
  description: '用对话创造世界 — AI 驱动的文字冒险引擎',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const themeId = getThemeCookie(cookies().toString())

  return (
    <html lang="zh-CN" data-theme={themeId} suppressHydrationWarning>
      <body className="min-h-screen">
        <GameProvider>
          {children}
          <GlobalButtons />
        </GameProvider>
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import './globals.css'
import { GameProvider } from '@/lib/game-context'
import GlobalButtons from '@/components/GlobalButtons'
import ThemeProvider from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: '话世界',
  description: '用对话创造世界 — AI 驱动的文字冒险引擎',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <ThemeProvider>
          <GameProvider>
            {children}
            <GlobalButtons />
          </GameProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

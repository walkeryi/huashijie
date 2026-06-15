import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '陪你一起冒险',
  description: 'AI 驱动的文字冒险世界引擎',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}

'use client'

import { useEffect } from 'react'
import { themes, loadTheme, applyTheme, loadFontSize, applyFontSize } from '@/lib/theme'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const id = loadTheme()
    const theme = themes.find(t => t.id === id) || themes[0]
    applyTheme(theme)
    const size = loadFontSize()
    applyFontSize(size)
  }, [])
  return <>{children}</>
}

'use client'

import { GameProvider } from '@/lib/game-context'
import WorldCardSelector from '@/components/WorldCardSelector'

export default function HomePage() {
  return (
    <GameProvider>
      <main className="min-h-screen flex items-center justify-center">
        <WorldCardSelector />
      </main>
    </GameProvider>
  )
}

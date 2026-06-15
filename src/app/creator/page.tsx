'use client'

import { GameProvider } from '@/lib/game-context'
import WorldCreator from '@/components/WorldCreator'

export default function CreatorPage() {
  return (
    <GameProvider>
      <WorldCreator />
    </GameProvider>
  )
}

'use client'

import { GameProvider } from '@/lib/game-context'
import GameScreen from '@/components/GameScreen'

export default function GamePage() {
  return (
    <GameProvider>
      <GameScreen />
    </GameProvider>
  )
}

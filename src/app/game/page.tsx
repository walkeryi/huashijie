'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGame } from '@/lib/game-context'
import GameScreen from '@/components/GameScreen'

export default function GamePage() {
  const { state } = useGame()
  const router = useRouter()

  useEffect(() => {
    if (state.screen === 'menu') {
      router.replace('/')
    }
  }, [state.screen, router])

  return <GameScreen />
}

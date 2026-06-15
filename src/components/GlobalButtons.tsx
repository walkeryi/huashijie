'use client'

import { usePathname } from 'next/navigation'
import AccountButton from './AccountButton'
import SystemSettings from './SystemSettings'

export default function GlobalButtons() {
  const pathname = usePathname()
  if (pathname.startsWith('/creator')) return null
  return (
    <>
      <AccountButton />
      <SystemSettings />
    </>
  )
}

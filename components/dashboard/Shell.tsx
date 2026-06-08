import { ReactNode } from 'react'
import { TopRail } from './TopRail'

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <TopRail />
      <main className="w-full px-3 py-4 pb-24">
        {children}
      </main>
    </div>
  )
}

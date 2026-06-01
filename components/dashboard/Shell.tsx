import { ReactNode } from 'react'
import { TopRail } from './TopRail'

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--ink-0)' }}>
      <TopRail />
      <main className="max-w-[1400px] mx-auto px-4 py-4">
        {children}
      </main>
    </div>
  )
}

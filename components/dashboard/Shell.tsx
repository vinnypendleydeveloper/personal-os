import { ReactNode } from 'react'
import { TopRail } from './TopRail'

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <TopRail />
      <main className="max-w-[1440px] mx-auto px-4 py-4 pb-24">
        {children}
      </main>
    </div>
  )
}

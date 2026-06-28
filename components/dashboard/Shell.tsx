import { ReactNode } from 'react'
import { TopRail } from './TopRail'
import { BottomTabBar } from './BottomTabBar'

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <TopRail />
      <main className="w-full px-3 py-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-24">
        {children}
      </main>
      <BottomTabBar />
    </div>
  )
}

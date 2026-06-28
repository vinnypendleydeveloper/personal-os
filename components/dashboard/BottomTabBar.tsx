'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

interface Tab {
  href: string
  label: string
  icon: ReactNode
}

// Minimal 1.6px-stroke line icons, inheriting currentColor.
const TABS: Tab[] = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <path d="M3 10.5 12 3l9 7.5M5.25 9v10.5A1.5 1.5 0 0 0 6.75 21h3.75v-6h3v6h3.75a1.5 1.5 0 0 0 1.5-1.5V9" />
    ),
  },
  {
    href: '/crm',
    label: 'CRM',
    icon: (
      <>
        <circle cx="9" cy="8" r="3.25" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3.25 3.25 0 0 1 0 6M17 14.5a5.5 5.5 0 0 1 3.5 5.5" />
      </>
    ),
  },
  {
    href: '/gym-log',
    label: 'Gym',
    icon: (
      <>
        <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
      </>
    ),
  },
  {
    href: '/log',
    label: 'Log',
    icon: (
      <>
        <path d="M5 4.5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z" />
        <path d="M8 9h8M8 12.5h8M8 16h5" />
      </>
    ),
  },
  {
    href: '/morning-routine',
    label: 'Routine',
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.1 5.1l1.8 1.8M17.1 17.1l1.8 1.8M18.9 5.1l-1.8 1.8M6.9 17.1l-1.8 1.8" />
      </>
    ),
  },
]

export function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50"
      style={{
        background: 'oklch(0.10 0.008 255 / 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
      aria-label="Primary"
    >
      <div className="flex items-stretch justify-around h-14">
        {TABS.map((tab) => {
          const active =
            tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-1 items-center justify-center transition-colors duration-150 active:scale-90"
              style={{ color: active ? 'var(--accent)' : 'var(--fg-3)' }}
            >
              {active && (
                <span
                  className="absolute top-0 h-px w-8 rounded-full"
                  style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent-glow)' }}
                />
              )}
              <svg
                width="23"
                height="23"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {tab.icon}
              </svg>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

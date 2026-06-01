'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const TABS = [
  { label: 'Home', href: '/' },
  { label: 'CRM', href: '/crm' },
  { label: 'Brain', href: '/brain' },
  { label: 'Finance', href: '/finance' },
  { label: 'Journal', href: '/journal' },
  { label: 'Health', href: '/health' },
]

export function TopRail() {
  const pathname = usePathname()
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    function tick() {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
      setDate(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-5 h-12 border-b"
      style={{
        background: 'oklch(0.12 0.006 260 / 0.9)',
        backdropFilter: 'blur(12px)',
        borderColor: 'oklch(1 0 0 / 0.07)',
      }}
    >
      {/* Brand */}
      <span className="font-mono font-bold text-sm tracking-widest" style={{ color: 'var(--accent)' }}>
        PERSONAL OS
      </span>

      {/* Tabs */}
      <nav className="flex items-center gap-1">
        {TABS.map(tab => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
              style={{
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--ink-4)',
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* Clock + logout */}
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="font-mono text-xs" style={{ color: 'var(--foreground)' }}>{time}</div>
          <div className="font-mono text-[10px]" style={{ color: 'var(--ink-4)' }}>{date}</div>
        </div>
        <button
          onClick={handleLogout}
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-opacity hover:opacity-70"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          title="Sign out"
        >
          V
        </button>
      </div>
    </header>
  )
}

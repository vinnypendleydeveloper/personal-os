'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const TABS = [
  { label: 'Home', href: '/' },
  { label: 'CRM', href: '/crm' },
  { label: 'Finance', href: '/finance' },
  { label: 'Review', href: '/review' },
  { label: 'Brain', href: '/brain' },
  { label: 'Health', href: '/health' },
]

interface TickerItem {
  label: string
  value: string
  change?: string
  up?: boolean
}

function useTicker() {
  const [tickers, setTickers] = useState<TickerItem[]>([
    { label: 'BTC', value: '—' },
    { label: 'NDX', value: '—' },
    { label: 'XAU', value: '—' },
  ])

  useEffect(() => {
    async function fetchPrices() {
      try {
        const res = await fetch(
          'https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD,^NDX,GC=F?interval=1d&range=2d',
          { cache: 'no-store' }
        )
        // Yahoo Finance blocks CORS — use a simple free API instead
        const [btc, ndx, gold] = await Promise.allSettled([
          fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot').then(r => r.json()),
          Promise.resolve(null),
          Promise.resolve(null),
        ])

        const items: TickerItem[] = []

        if (btc.status === 'fulfilled' && btc.value?.data?.amount) {
          const price = parseFloat(btc.value.data.amount)
          items.push({ label: 'BTC', value: `$${Math.round(price).toLocaleString()}` })
        } else {
          items.push({ label: 'BTC', value: '—' })
        }
        items.push({ label: 'NDX', value: '—' })
        items.push({ label: 'XAU', value: '—' })

        setTickers(items)
      } catch {
        // Keep defaults
      }
    }
    fetchPrices()
    const id = setInterval(fetchPrices, 60_000)
    return () => clearInterval(id)
  }, [])

  return tickers
}

export function TopRail() {
  const pathname = usePathname()
  const tickers = useTicker()
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    function tick() {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
      setDate(now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase())
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
      className="sticky top-0 z-50 border-b"
      style={{
        background: 'oklch(0.12 0.006 260 / 0.95)',
        backdropFilter: 'blur(12px)',
        borderColor: 'oklch(1 0 0 / 0.07)',
      }}
    >
      {/* Main rail */}
      <div className="flex items-center justify-between px-5 h-11">
        {/* Brand */}
        <span className="font-mono font-bold text-xs tracking-widest" style={{ color: 'var(--accent)' }}>
          PERSONAL OS
        </span>

        {/* Tabs */}
        <nav className="flex items-center gap-0.5">
          {TABS.map(tab => {
            const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="px-3 py-1 rounded-md text-[11px] font-mono font-medium transition-colors"
                style={{
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--ink-4)',
                }}
              >
                {tab.label.toUpperCase()}
              </Link>
            )
          })}
        </nav>

        {/* Clock + logout */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="font-mono text-xs font-bold" style={{ color: 'var(--foreground)' }}>{time}</div>
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
      </div>

      {/* Ticker sub-rail */}
      <div
        className="flex items-center gap-4 px-5 h-6 overflow-x-auto"
        style={{ borderTop: '1px solid oklch(1 0 0 / 0.04)' }}
      >
        {tickers.map(t => (
          <span key={t.label} className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono text-[10px] font-semibold" style={{ color: 'var(--ink-4)' }}>{t.label}</span>
            <span className="font-mono text-[10px]" style={{ color: t.value === '—' ? 'var(--ink-3)' : 'var(--foreground)' }}>
              {t.value}
            </span>
          </span>
        ))}
        <span className="font-mono text-[10px] ml-auto shrink-0" style={{ color: 'var(--ink-3)' }}>
          {date} {time}
        </span>
      </div>
    </header>
  )
}

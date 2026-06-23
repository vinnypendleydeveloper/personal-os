'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const TABS = [
  { label: 'HOME', href: '/' },
  { label: 'LOG', href: '/log' },
  { label: 'ROUTINE', href: '/morning-routine' },
  { label: 'GYM', href: '/gym-log' },
  { label: 'CRM', href: '/crm' },
  { label: 'FINANCE', href: '/finance' },
  { label: 'REVIEW', href: '/weekly-review' },
  { label: 'HISTORY', href: '/history' },
  { label: 'BRAIN', href: '/brain' },
  { label: 'HEALTH', href: '/health' },
  { label: 'WEIGHT', href: '/weight' },
  { label: 'FEATURES', href: '/new-features' },
]

interface TickerItem { label: string; value: string; change?: string; up?: boolean | null }

function useLivePrices() {
  const [prices, setPrices] = useState<TickerItem[]>([
    { label: 'BTC', value: '—', change: undefined },
    { label: 'NDX', value: '—', change: undefined },
    { label: 'XAU', value: '—', change: undefined },
  ])

  useEffect(() => {
    async function fetch_btc() {
      try {
        const r = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot')
        const j = await r.json()
        const price = parseFloat(j?.data?.amount ?? '0')
        if (price > 0) {
          setPrices(prev => prev.map(p => p.label === 'BTC'
            ? { ...p, value: `$${Math.round(price).toLocaleString()}` }
            : p))
        }
      } catch {}
    }
    fetch_btc()
    const id = setInterval(fetch_btc, 30_000)
    return () => clearInterval(id)
  }, [])

  return prices
}

const AVATAR_SRC = '/avatar.jpg'

function AvatarButton({ onClick }: { onClick: () => void }) {
  const [hasPhoto, setHasPhoto] = useState(false)

  useEffect(() => {
    const img = new window.Image()
    img.onload = () => setHasPhoto(true)
    img.onerror = () => setHasPhoto(false)
    img.src = AVATAR_SRC
  }, [])

  return (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-150 hover:scale-110 active:scale-95 overflow-hidden"
      style={{
        fontFamily: 'var(--font-mono)',
        background: hasPhoto ? 'transparent' : 'linear-gradient(135deg, var(--accent-dim), oklch(0.74 0.17 148 / 0.15))',
        color: 'var(--fg)',
        border: '1px solid var(--accent-glow)',
        letterSpacing: '0.05em',
      }}
      title="Sign out"
    >
      {hasPhoto ? (
        <Image src={AVATAR_SRC} alt="VP" width={32} height={32} className="w-full h-full object-cover rounded-full" />
      ) : 'VP'}
    </button>
  )
}

export function TopRail() {
  const pathname = usePathname()
  const prices = useLivePrices()
  const [time, setTime] = useState('')
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    function tick() {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }))
      setDateStr(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase())
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  // Ticker items repeated for seamless loop
  const tickerItems = [...prices, ...prices]

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'oklch(0.10 0.008 255 / 0.96)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Main navigation rail */}
      <div className="flex items-center justify-between px-4 h-10">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold tracking-[0.2em]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}
          >
            PERSONAL OS
          </span>
          <span className="text-[10px] dot-online" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ok)' }}>●</span>
        </div>

        {/* Nav tabs */}
        <nav className="flex items-center gap-0.5">
          {TABS.map((tab, i) => {
            const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative px-3 py-1 rounded text-[10px] font-medium tracking-wider transition-all duration-150 group"
                style={{
                  fontFamily: 'var(--font-mono)',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--fg-3)',
                  animationDelay: `${i * 40}ms`,
                }}
              >
                {active && (
                  <span
                    className="absolute inset-x-3 bottom-0 h-px"
                    style={{ background: 'var(--accent)', opacity: 0.6 }}
                  />
                )}
                <span className="group-hover:text-[var(--fg)] transition-colors duration-150">
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Clock + avatar */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div
              className="text-xs font-semibold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg)', letterSpacing: '0.05em' }}
            >
              {time}
            </div>
            <div
              className="text-[9px]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}
            >
              {dateStr}
            </div>
          </div>
          <AvatarButton onClick={handleLogout} />
        </div>
      </div>

      {/* Ticker rail */}
      <div
        className="relative overflow-hidden h-5 flex items-center"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, oklch(0.10 0.008 255), transparent)' }} />
        <div className="absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(270deg, oklch(0.10 0.008 255), transparent)' }} />

        <div className="ticker-track px-4">
          {tickerItems.map((item, i) => (
            <span key={i} className="flex items-center gap-3 mr-8">
              <span
                className="text-[10px] font-semibold tracking-widest"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}
              >
                {item.label}
              </span>
              <span
                className="text-[10px] tabular-nums"
                style={{ fontFamily: 'var(--font-mono)', color: item.value === '—' ? 'var(--fg-2)' : 'var(--fg)' }}
              >
                {item.value}
              </span>
              {item.change && (
                <span
                  className="text-[10px]"
                  style={{ fontFamily: 'var(--font-mono)', color: item.up ? 'var(--ok)' : 'var(--hot)' }}
                >
                  {item.change}
                </span>
              )}
              <span style={{ color: 'var(--fg-2)', fontSize: '10px' }}>·</span>
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}

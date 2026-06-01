'use client'

import { useEffect, useState } from 'react'
import { Panel } from './Panel'

export function OperatorCard() {
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    fetch('/api/habits?days=60')
      .then(r => r.json())
      .then(data => {
        const habits = data.habits ?? {}
        let s = 0
        const today = new Date()
        for (let i = 0; i < 60; i++) {
          const d = new Date(today)
          d.setDate(d.getDate() - i)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          if (habits[key]?.done?.length > 0) s++
          else if (i > 0) break
        }
        setStreak(s)
      }).catch(() => {})
  }, [])

  return (
    <Panel index={1} title="Operator" status="online" delay={0}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-semibold" style={{ color: 'var(--fg)' }}>Vinny Pendley</p>
            <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', fontSize: '11px' }}>
              Los Angeles, CA
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums leading-none" style={{ fontFamily: 'var(--font-mono)', color: streak > 0 ? 'var(--accent)' : 'var(--fg-4)' }}>
              {streak}
            </p>
            <p className="text-[9px] mt-0.5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', letterSpacing: '0.1em' }}>
              DAY STREAK
            </p>
          </div>
        </div>

        <div className="h-px" style={{ background: 'var(--border)' }} />

        <div className="flex flex-col gap-1.5">
          <Row label="FOCUS" value="IB Internship Search" />
          <Row label="SCHOOL" value="USC → Fall 2026" />
          <Row label="STATUS" value="● ACTIVE" accent />
        </div>
      </div>
    </Panel>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span
        className="text-[10px] font-medium tracking-wider"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}
      >
        {label}
      </span>
      <span
        className="text-[11px]"
        style={{
          fontFamily: 'var(--font-mono)',
          color: accent ? 'var(--ok)' : 'var(--fg-2)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Panel } from './Panel'

export function OperatorCard() {
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    // Calculate streak from habits data
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
          else if (i > 0) break // streak broken
        }
        setStreak(s)
      })
      .catch(() => {})
  }, [])

  return (
    <Panel index={1} title="Operator" status="online">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Vinny Pendley</p>
            <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Los Angeles, CA</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xl font-bold leading-none" style={{ color: 'var(--accent)' }}>{streak}</p>
            <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: 'var(--ink-4)' }}>day streak</p>
          </div>
        </div>
        <div className="h-px" style={{ background: 'oklch(1 0 0 / 0.06)' }} />
        <div className="flex flex-col gap-1">
          <Row label="Focus" value="IB Internship Search" />
          <Row label="School" value="USC → Fall 2026" />
          <Row label="Status" value="Active" ok />
        </div>
      </div>
    </Panel>
  )
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span style={{ color: 'var(--ink-4)' }}>{label}</span>
      <span className="font-mono" style={{ color: ok ? 'var(--ok)' : 'var(--foreground)' }}>{value}</span>
    </div>
  )
}

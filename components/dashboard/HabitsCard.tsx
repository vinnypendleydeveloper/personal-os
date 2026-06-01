'use client'

import { useEffect, useState } from 'react'
import { Panel } from './Panel'

const DEFAULT_HABITS = [
  'Morning workout',
  'Read 30 min',
  'No social media before noon',
  'Cold shower',
  'Review goals',
  'In bed by midnight',
]

function localDateKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function HabitsCard() {
  const today = localDateKey()
  const storageKey = `pos-habits-${today}`

  const [done, setDone] = useState<string[]>([])
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    // Load from localStorage first (instant)
    try {
      const cached = localStorage.getItem(storageKey)
      if (cached) setDone(JSON.parse(cached))
    } catch {}

    // Then sync from server
    fetch(`/api/habits?days=1`)
      .then(r => r.json())
      .then(data => {
        const serverDone = data.habits?.[today]?.done ?? []
        setDone(serverDone)
        localStorage.setItem(storageKey, JSON.stringify(serverDone))
      })
      .catch(() => {})
  }, [today, storageKey])

  function toggle(habit: string) {
    const next = done.includes(habit)
      ? done.filter(h => h !== habit)
      : [...done, habit]

    setDone(next)
    localStorage.setItem(storageKey, JSON.stringify(next))

    setSyncing(true)
    fetch(`/api/habits/${today}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: next }),
    })
      .catch(console.error)
      .finally(() => setSyncing(false))
  }

  const pct = Math.round((done.length / DEFAULT_HABITS.length) * 100)

  return (
    <Panel title={`Habits · ${done.length}/${DEFAULT_HABITS.length}`} action={
      syncing ? <span className="text-[10px] font-mono" style={{ color: 'var(--ink-4)' }}>saving…</span> : null
    }>
      {/* Progress bar */}
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--ink-2)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: pct === 100 ? 'var(--ok)' : 'var(--accent)' }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        {DEFAULT_HABITS.map(habit => {
          const checked = done.includes(habit)
          return (
            <button
              key={habit}
              onClick={() => toggle(habit)}
              className="flex items-center gap-2 text-left group"
            >
              <div
                className="w-4 h-4 rounded shrink-0 border flex items-center justify-center transition-colors"
                style={{
                  background: checked ? 'var(--ok)' : 'transparent',
                  borderColor: checked ? 'var(--ok)' : 'oklch(1 0 0 / 0.2)',
                }}
              >
                {checked && <span className="text-[10px] text-black">✓</span>}
              </div>
              <span
                className="text-xs transition-colors"
                style={{ color: checked ? 'var(--ink-4)' : 'var(--foreground)', textDecoration: checked ? 'line-through' : 'none' }}
              >
                {habit}
              </span>
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

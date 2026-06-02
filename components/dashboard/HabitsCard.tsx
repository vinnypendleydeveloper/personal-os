'use client'

import { useEffect, useState } from 'react'
import { Panel } from './Panel'

const DEFAULT_HABITS = [
  'Hit the gym',
  'Eat clean + calorie surplus',
  'No social media before noon',
  'Work on business / clients',
  'Wake up early (before 8am)',
  'Review North Star goals',
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
  const [popping, setPopping] = useState<string | null>(null)

  useEffect(() => {
    try {
      const cached = localStorage.getItem(storageKey)
      if (cached) setDone(JSON.parse(cached))
    } catch {}
    fetch('/api/habits?days=1')
      .then(r => r.json())
      .then(data => {
        const serverDone = data.habits?.[today]?.done ?? []
        setDone(serverDone)
        localStorage.setItem(storageKey, JSON.stringify(serverDone))
      }).catch(() => {})
  }, [today, storageKey])

  function toggle(habit: string) {
    const next = done.includes(habit) ? done.filter(h => h !== habit) : [...done, habit]
    setDone(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
    setPopping(habit)
    setTimeout(() => setPopping(null), 300)
    setSyncing(true)
    fetch(`/api/habits/${today}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: next }),
    }).catch(console.error).finally(() => setSyncing(false))
  }

  const count = done.length
  const total = DEFAULT_HABITS.length
  const pct = Math.round((count / total) * 100)
  const allDone = count === total

  return (
    <Panel index={3} title={`Habits · ${count}/${total}`} delay={120} action={
      syncing
        ? <span className="card-label" style={{ color: 'var(--fg-4)' }}>saving</span>
        : allDone
        ? <span className="card-label dot-online" style={{ color: 'var(--ok)' }}>COMPLETE ●</span>
        : null
    }>
      {/* Progress bar */}
      <div className="relative h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: allDone
              ? 'linear-gradient(90deg, var(--ok), oklch(0.82 0.16 148))'
              : 'linear-gradient(90deg, var(--accent), oklch(0.74 0.22 270))',
            boxShadow: pct > 0 ? `0 0 8px ${allDone ? 'var(--ok)' : 'var(--accent)'}` : 'none',
          }}
        />
      </div>

      {/* Habit list */}
      <div className="flex flex-col gap-1">
        {DEFAULT_HABITS.map((habit, i) => {
          const checked = done.includes(habit)
          const isPopping = popping === habit
          return (
            <button
              key={habit}
              onClick={() => toggle(habit)}
              className="flex items-center gap-2.5 text-left w-full group py-0.5 transition-opacity duration-150"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {/* Checkbox */}
              <div
                className={`w-4 h-4 rounded shrink-0 border flex items-center justify-center transition-all duration-200 ${isPopping ? 'checkbox-pop' : ''}`}
                style={{
                  background: checked ? 'var(--ok)' : 'transparent',
                  borderColor: checked ? 'var(--ok)' : 'var(--bg-3)',
                  boxShadow: checked ? '0 0 6px var(--ok-dim)' : 'none',
                }}
              >
                {checked && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3L3 5L7 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span
                className="text-xs transition-all duration-200"
                style={{
                  color: checked ? 'var(--fg-3)' : 'var(--fg-2)',
                  textDecoration: checked ? 'line-through' : 'none',
                  textDecorationColor: 'var(--fg-4)',
                }}
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

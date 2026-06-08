'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Panel } from './Panel'

interface Item { id: string; label: string }

export function MorningRoutineCard() {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [completions, setCompletions] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/morning-routine')
      .then(r => r.json())
      .then(d => {
        setItems(d.items ?? [])
        setCompletions(d.completions ?? {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const total = items.length
  const completed = items.filter(i => completions[i.id]).length
  const next = items.find(i => !completions[i.id]) ?? null
  const allDone = total > 0 && completed === total
  const pct = total ? completed / total : 0

  // Ring geometry
  const r = 26
  const circ = 2 * Math.PI * r
  const ringColor = allDone ? 'var(--ok)' : 'var(--accent)'

  return (
    <Panel index={7} title="Morning Routine" status={allDone ? 'online' : 'none'} delay={40}>
      <button
        onClick={() => router.push('/morning-routine')}
        className="flex items-center gap-3.5 w-full text-left transition-opacity hover:opacity-90 active:opacity-75"
      >
        {/* Progress ring */}
        <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
          <svg viewBox="0 0 64 64" className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="32" cy="32" r={r} fill="none" stroke="var(--bg-3)" strokeWidth="5" />
            {!loading && total > 0 && (
              <circle
                cx="32" cy="32" r={r} fill="none"
                stroke={ringColor}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - pct)}
                style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 5px ${ringColor}aa)` }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {allDone ? (
              <svg width="22" height="18" viewBox="0 0 8 6" fill="none">
                <path d="M1 3L3 5L7 1" stroke="var(--ok)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <div className="flex items-baseline" style={{ fontFamily: 'var(--font-mono)' }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg)', lineHeight: 1 }}>{loading ? '–' : completed}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-2)' }}>/{total || '–'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Next item / complete state */}
        <div className="flex flex-col gap-0.5 min-w-0">
          {loading ? (
            <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>LOADING…</span>
          ) : allDone ? (
            <>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--ok)' }}>
                ● COMPLETE
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>Routine complete</span>
            </>
          ) : (
            <>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--fg-2)' }}>
                NEXT
              </span>
              <span className="text-sm font-medium truncate" style={{ color: 'var(--fg)' }}>
                {next ? next.label : 'Add steps →'}
              </span>
            </>
          )}
          <span className="text-[10px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
            Open routine →
          </span>
        </div>
      </button>
    </Panel>
  )
}

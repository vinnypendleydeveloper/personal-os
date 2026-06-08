'use client'

import { useEffect, useState } from 'react'
import { Panel } from './Panel'

const GOAL_ML = 3000

function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

interface WaterEntry { amount_ml: number; logged_at: string }

export function WaterCard() {
  const today = localDate()
  const [totalMl, setTotalMl] = useState(0)
  const [entries, setEntries] = useState<WaterEntry[]>([])
  const [custom, setCustom] = useState('')
  const [logging, setLogging] = useState(false)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    fetch(`/api/water?date=${today}`)
      .then(r => r.json())
      .then(d => {
        setTotalMl(d.total_ml ?? 0)
        setEntries(d.entries ?? [])
      })
      .catch(() => {})
  }, [today])

  async function logWater(amount: number) {
    if (logging || amount <= 0) return
    setLogging(true)
    const prev = { totalMl, entries }
    const newEntry: WaterEntry = { amount_ml: amount, logged_at: new Date().toISOString() }
    setTotalMl(t => t + amount)
    setEntries(e => [...e, newEntry])
    setFlash(true)
    setTimeout(() => setFlash(false), 600)
    try {
      const res = await fetch('/api/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, amount_ml: amount }),
      })
      if (!res.ok) throw new Error(`Log failed (${res.status})`)
      const data = await res.json()
      if (data.total_ml !== undefined) setTotalMl(data.total_ml)
      if (data.entries) setEntries(data.entries)
    } catch {
      setTotalMl(prev.totalMl)
      setEntries(prev.entries)
    }
    setLogging(false)
  }

  async function undoLast() {
    if (!entries.length || logging) return
    setLogging(true)
    const last = entries[entries.length - 1]
    const prev = { totalMl, entries }
    setTotalMl(t => Math.max(0, t - last.amount_ml))
    setEntries(e => e.slice(0, -1))
    try {
      const res = await fetch('/api/water', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today }),
      })
      if (!res.ok) throw new Error(`Undo failed (${res.status})`)
      const data = await res.json()
      if (data.total_ml !== undefined) setTotalMl(data.total_ml)
      if (data.entries) setEntries(data.entries)
    } catch {
      setTotalMl(prev.totalMl)
      setEntries(prev.entries)
    }
    setLogging(false)
  }

  const pct = Math.min(100, (totalMl / GOAL_ML) * 100)
  const done = totalMl >= GOAL_ML
  const remaining = Math.max(0, GOAL_ML - totalMl)
  const lastEntry = entries[entries.length - 1]

  const undoBtn = entries.length > 0 ? (
    <button
      onClick={undoLast}
      disabled={logging}
      className="font-mono text-[10px] disabled:opacity-40 transition-opacity hover:opacity-70"
      style={{ color: 'var(--fg-4)', letterSpacing: '0.06em' }}
      title={`Undo last entry (${lastEntry?.amount_ml}ml)`}
    >
      ↩ {lastEntry?.amount_ml}ml
    </button>
  ) : undefined

  return (
    <Panel index={8} title="Hydration" status={done ? 'online' : 'none'} action={undoBtn}>
      {/* Amount display */}
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-mono font-bold"
            style={{
              fontSize: '2rem',
              lineHeight: 1,
              color: flash ? 'var(--water-hi)' : 'var(--water)',
              textShadow: flash ? '0 0 16px var(--water-glow)' : 'none',
              transition: 'color 300ms ease, text-shadow 300ms ease',
            }}
          >
            {totalMl.toLocaleString()}
          </span>
          <span className="font-mono text-xs" style={{ color: 'var(--fg-3)' }}>ml</span>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs font-bold" style={{ color: done ? 'var(--ok)' : 'var(--fg-3)' }}>
            {Math.round(pct)}%
          </div>
          {!done && (
            <div className="font-mono text-[10px]" style={{ color: 'var(--fg-4)' }}>
              {remaining.toLocaleString()} left
            </div>
          )}
          {done && (
            <div className="font-mono text-[10px]" style={{ color: 'var(--ok)' }}>goal met</div>
          )}
        </div>
      </div>

      {/* Glass progress bar */}
      <div
        className="relative overflow-hidden rounded"
        style={{
          height: 14,
          background: 'var(--bg-3)',
          border: '1px solid var(--border)',
          boxShadow: 'inset 0 1px 3px oklch(0 0 0 / 0.3)',
        }}
      >
        <div
          className="absolute inset-y-0 left-0 water-fill"
          style={{
            width: `${pct}%`,
            background: done
              ? 'linear-gradient(90deg, var(--ok), oklch(0.80 0.16 170))'
              : 'linear-gradient(90deg, var(--water-dim), var(--water), var(--water-hi))',
            backgroundSize: '200% 100%',
            transition: 'width 700ms cubic-bezier(0.34, 1.2, 0.64, 1)',
            borderRadius: '2px',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, oklch(1 0 0 / 0.08) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: pct > 0 ? 'water-shimmer 2.5s linear infinite' : 'none',
          }}
        />
      </div>

      <div className="font-mono text-[10px]" style={{ color: 'var(--fg-4)' }}>
        {totalMl.toLocaleString()} / {GOAL_ML.toLocaleString()} ml
      </div>

      {/* Quick add */}
      <div className="grid grid-cols-3 gap-1.5">
        {[250, 500, 1000].map(amt => (
          <button
            key={amt}
            onClick={() => logWater(amt)}
            disabled={logging}
            className="text-xs font-mono py-1.5 rounded transition-all disabled:opacity-40 hover:scale-[1.02] active:scale-[0.97]"
            style={{
              background: 'var(--water-dim)',
              color: 'var(--water)',
              border: '1px solid var(--water-border)',
              fontWeight: 600,
            }}
          >
            +{amt}
          </button>
        ))}
      </div>

      {/* Custom input */}
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          placeholder="Custom ml…"
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const amt = parseInt(custom)
              if (amt > 0) { logWater(amt); setCustom('') }
            }
          }}
          className="flex-1 text-xs px-2 py-1.5 rounded font-mono"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg)' }}
        />
        <button
          onClick={() => { const amt = parseInt(custom); if (amt > 0) { logWater(amt); setCustom('') } }}
          disabled={logging || !custom || parseInt(custom) <= 0}
          className="text-xs px-3 py-1.5 rounded font-mono font-bold disabled:opacity-40 transition-all hover:brightness-110"
          style={{ background: 'var(--water)', color: 'var(--bg)' }}
        >
          LOG
        </button>
      </div>
    </Panel>
  )
}

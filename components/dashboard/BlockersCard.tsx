'use client'

import { useEffect, useState } from 'react'
import { Panel } from './Panel'
import Link from 'next/link'

interface Blocker {
  id: string
  title: string
  owner: string | null
  created_at: string
  key: boolean
}

function daysStuck(created_at: string) {
  const days = Math.floor((Date.now() - new Date(created_at).getTime()) / 86_400_000)
  return days
}

export function BlockersCard() {
  const [blockers, setBlockers] = useState<Blocker[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetch('/api/blockers')
      .then(r => r.json())
      .then(data => { setBlockers(data.blockers ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function addBlocker() {
    if (!input.trim()) return
    setAdding(true)
    const res = await fetch('/api/blockers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: input.trim() }),
    })
    const data = await res.json()
    setBlockers(prev => [...prev, data.blocker])
    setInput('')
    setAdding(false)
  }

  async function resolve(id: string) {
    setBlockers(prev => prev.filter(b => b.id !== id))
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed_at: new Date().toISOString() }),
    })
  }

  const visible = blockers.slice(0, 5)
  const extra = blockers.length - 5

  return (
    <Panel index={6} title="Key Blockers" action={
      <Link href="/crm" className="text-[10px] font-mono" style={{ color: 'var(--accent)' }}>
        View all →
      </Link>
    }>
      {loading ? (
        <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Loading…</p>
      ) : blockers.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--ok)' }}>No active blockers. 🟢</p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map(b => {
            const days = daysStuck(b.created_at)
            const heat = days >= 3 ? 'HOT' : days >= 1 ? 'WARM' : 'NEW'
            const heatColor = heat === 'HOT' ? 'var(--danger)' : heat === 'WARM' ? 'var(--warn)' : 'var(--ok)'
            return (
              <div key={b.id} className="flex items-start gap-2 group">
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed truncate" style={{ color: 'var(--foreground)' }}>{b.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {b.owner && (
                      <span className="text-[10px] font-mono" style={{ color: 'var(--ink-4)' }}>
                        OWNER {b.owner}
                      </span>
                    )}
                    <span className="text-[10px] font-mono" style={{ color: 'var(--ink-4)' }}>
                      STUCK {days}d
                    </span>
                    <span className="text-[10px] font-mono font-bold" style={{ color: heatColor }}>{heat}</span>
                  </div>
                </div>
                <button onClick={() => resolve(b.id)}
                  className="opacity-0 group-hover:opacity-100 text-[10px] px-1.5 py-0.5 rounded shrink-0 transition-opacity"
                  style={{ background: 'oklch(0.72 0.18 145 / 0.15)', color: 'var(--ok)' }}
                >✓</button>
              </div>
            )
          })}
          {extra > 0 && (
            <p className="text-[10px] font-mono" style={{ color: 'var(--ink-4)' }}>+ {extra} MORE</p>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-1">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addBlocker()}
          placeholder="Add a blocker…"
          className="flex-1 text-xs px-2 py-1 rounded outline-none"
          style={{ background: 'var(--ink-2)', border: '1px solid oklch(1 0 0 / 0.08)', color: 'var(--foreground)' }}
        />
        <button onClick={addBlocker} disabled={adding || !input.trim()}
          className="text-xs px-2 py-1 rounded disabled:opacity-40"
          style={{ background: 'oklch(0.65 0.22 20 / 0.2)', color: 'var(--danger)' }}
        >+</button>
      </div>
    </Panel>
  )
}

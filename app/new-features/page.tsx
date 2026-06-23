'use client'

import { useState, useEffect, useRef } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'

interface Feature {
  id: string
  title: string
  notes: string | null
  when_to_add: string | null
  created_at: string
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase()
}

export default function NewFeaturesPage() {
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [whenToAdd, setWhenToAdd] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (showForm) setTimeout(() => titleRef.current?.focus(), 50)
  }, [showForm])

  async function load() {
    try {
      const res = await fetch('/api/new-features')
      const data = await res.json()
      setFeatures(data.features ?? [])
    } catch {}
    setLoading(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/new-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, notes, when_to_add: whenToAdd || null }),
      })
      const data = await res.json()
      if (data.feature) {
        setFeatures(prev => {
          const next = [...prev, data.feature]
          return next.sort((a, b) => {
            if (!a.when_to_add && !b.when_to_add) return 0
            if (!a.when_to_add) return 1
            if (!b.when_to_add) return -1
            return a.when_to_add.localeCompare(b.when_to_add)
          })
        })
        setTitle('')
        setNotes('')
        setWhenToAdd('')
        setShowForm(false)
      }
    } catch {}
    setAdding(false)
  }

  async function remove(id: string) {
    setFeatures(prev => prev.filter(f => f.id !== id))
    await fetch(`/api/new-features?id=${id}`, { method: 'DELETE' })
  }

  return (
    <Shell>
      <div className="flex flex-col gap-6" style={{ maxWidth: 760 }}>
        <Panel
          index={1}
          title="New Features"
          action={
            <button
              onClick={() => setShowForm(v => !v)}
              className="text-[10px] px-2.5 py-1 rounded-md font-semibold transition-all hover:brightness-110 active:scale-95"
              style={{
                fontFamily: 'var(--font-mono)',
                background: showForm ? 'var(--bg-3)' : 'var(--accent)',
                color: showForm ? 'var(--fg-3)' : 'oklch(0.09 0.008 255)',
                border: showForm ? '1px solid var(--border)' : 'none',
              }}
            >
              {showForm ? 'CANCEL' : '+ ADD'}
            </button>
          }
        >
          {/* Add form */}
          {showForm && (
            <form onSubmit={submit} className="flex flex-col gap-2 pb-1">
              <input
                ref={titleRef}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Feature title…"
                required
                className="text-xs px-3 py-2 rounded-lg outline-none"
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg)',
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <div className="flex gap-2">
                <input
                  value={whenToAdd}
                  onChange={e => setWhenToAdd(e.target.value)}
                  type="date"
                  className="text-xs px-3 py-2 rounded-lg outline-none"
                  style={{
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    color: whenToAdd ? 'var(--fg)' : 'var(--fg-3)',
                    fontFamily: 'var(--font-mono)',
                    colorScheme: 'dark',
                  }}
                />
                <input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Notes (optional)…"
                  className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
                  style={{
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--fg)',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={adding || !title.trim()}
                  className="text-xs px-4 py-2 rounded-lg font-semibold disabled:opacity-30 transition-all hover:brightness-110"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    background: 'var(--accent)',
                    color: 'oklch(0.09 0.008 255)',
                  }}
                >
                  {adding ? '…' : 'SAVE'}
                </button>
              </div>
            </form>
          )}

          {/* List */}
          {loading ? (
            <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>Loading…</p>
          ) : features.length === 0 ? (
            <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
              No features queued. Add one above.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {features.map((f, i) => (
                <div
                  key={f.id}
                  className="panel rounded-lg px-4 py-3 flex items-start justify-between gap-3 animate-fade-up group"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-sm font-medium leading-snug" style={{ color: 'var(--fg)' }}>
                      {f.title}
                    </span>
                    {f.notes && (
                      <span className="text-xs leading-relaxed" style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                        {f.notes}
                      </span>
                    )}
                    <div className="flex items-center gap-3 mt-0.5">
                      {f.when_to_add && (
                        <span
                          className="card-label px-1.5 py-0.5 rounded"
                          style={{
                            color: 'var(--accent)',
                            background: 'var(--accent-dim)',
                            border: '1px solid var(--accent-glow)',
                          }}
                        >
                          {formatDate(f.when_to_add)}
                        </span>
                      )}
                      <span className="card-label" style={{ color: 'var(--fg-4)' }}>
                        added {new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(f.id)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] px-2 py-1 rounded transition-all hover:brightness-110 shrink-0"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--fg-3)',
                      background: 'var(--bg-3)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </Shell>
  )
}

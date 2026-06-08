'use client'

import { useEffect, useState, useCallback } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'
import { WHERE, priorityBadge, splitTags, Chip } from '@/components/chips'

const TZ = 'America/Los_Angeles'
function todayKey() { return new Date().toLocaleDateString('en-CA', { timeZone: TZ }) }
function shift(key: string, days: number) {
  const [y, m, d] = key.split('-').map(Number)
  const x = new Date(y, m - 1, d); x.setDate(x.getDate() + days)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
function fmtHeader(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

interface Task { id?: string; title: string; priority_score: number; tags: string[]; completed_at: string }
interface LogData {
  date: string
  routine: { total: number; done: string[]; missed: string[] }
  habits: { hit: string[]; missed: string[] }
  gym: { day: number; label: string; whoop_strain: number | null; sauna: boolean; exercises: { name: string }[] } | null
  tasks: Task[]
  notes: string
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="card-label mb-1.5" style={{ color: 'var(--accent)' }}>{children}</div>
}

export default function DailyLogPage() {
  const [date, setDate] = useState<string>(todayKey())
  const [data, setData] = useState<LogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)
  const today = todayKey()

  const load = useCallback((d: string) => {
    setLoading(true)
    fetch(`/api/log?date=${d}`)
      .then(r => r.json())
      .then(j => { setData(j); setNotes(j.notes ?? ''); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load(date) }, [date, load])

  function saveNotes() {
    fetch('/api/log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, notes }),
    }).then(() => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500) }).catch(console.error)
  }

  return (
    <Shell>
      <div className="flex flex-col gap-4" style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Date nav */}
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setDate(shift(date, -1))} className="card-label hover:opacity-70" style={{ color: 'var(--fg-3)', padding: '4px 8px' }}>‹ PREV</button>
          <div className="flex items-center gap-3">
            <input
              type="date" value={date} max={today}
              onChange={e => e.target.value && setDate(e.target.value)}
              className="text-xs px-2 py-1 rounded outline-none"
              style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg-3)', colorScheme: 'dark' }}
            />
          </div>
          <button onClick={() => setDate(shift(date, 1))} disabled={date >= today}
            className="card-label hover:opacity-70 disabled:opacity-20" style={{ color: 'var(--fg-3)', padding: '4px 8px' }}>NEXT ›</button>
        </div>

        {/* Journal entry */}
        <Panel index={1} title={date === today ? 'Daily Log · Today' : 'Daily Log'} status="online">
          {/* Date header — terminal journal */}
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 4 }}>
            <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--fg)', letterSpacing: '0.02em' }}>
              {fmtHeader(date)}
            </h1>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>{date}</span>
          </div>

          {loading || !data ? (
            <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>LOADING…</p>
          ) : (
            <div className="flex flex-col gap-5 mt-2">

              {/* Morning routine */}
              <div>
                <SectionLabel>◢ MORNING ROUTINE · {data.routine.done.length}/{data.routine.total}</SectionLabel>
                {data.routine.done.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--fg-4)' }}>Nothing logged.</p>
                ) : (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {data.routine.done.map(x => (
                      <span key={x} className="text-xs" style={{ color: 'var(--fg-2)' }}>✓ {x}</span>
                    ))}
                    {data.routine.missed.map(x => (
                      <span key={x} className="text-xs" style={{ color: 'var(--fg-4)', textDecoration: 'line-through' }}>{x}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Tasks completed */}
              <div>
                <SectionLabel>◢ TASKS COMPLETED · {data.tasks.length}</SectionLabel>
                {data.tasks.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--fg-4)' }}>No tasks completed.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {data.tasks.map((t, i) => {
                      const { ctx, topical } = splitTags(t.tags ?? [])
                      const where = ctx ? (WHERE[ctx] ?? { label: ctx.toUpperCase(), color: 'var(--fg-4)' }) : null
                      const prio = priorityBadge(t.priority_score)
                      return (
                        <div key={i} className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs" style={{ color: 'var(--fg-2)' }}>✓ {t.title}</span>
                          <Chip label={prio.label} color={prio.color} filled={prio.filled} />
                          {where && <Chip label={where.label} color={where.color} />}
                          {topical.map(tag => <span key={tag} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-4)' }}>#{tag}</span>)}
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-4)', marginLeft: 'auto' }}>
                            {new Date(t.completed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Habits */}
              <div>
                <SectionLabel>◢ HABITS · {data.habits.hit.length}/{data.habits.hit.length + data.habits.missed.length}</SectionLabel>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {data.habits.hit.map(h => <span key={h} className="text-xs" style={{ color: 'var(--ok)' }}>✓ {h}</span>)}
                  {data.habits.missed.map(h => <span key={h} className="text-xs" style={{ color: 'var(--fg-4)' }}>✗ {h}</span>)}
                </div>
              </div>

              {/* Gym */}
              <div>
                <SectionLabel>◢ GYM</SectionLabel>
                {data.gym ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs" style={{ color: 'var(--fg-2)' }}>Day {data.gym.day} · {data.gym.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>{data.gym.exercises.length} exercises</span>
                    {typeof data.gym.whoop_strain === 'number' && <Chip label={`STRAIN ${data.gym.whoop_strain}`} color="oklch(0.74 0.15 200)" />}
                    {data.gym.sauna && <Chip label="SAUNA" color="var(--ok)" />}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--fg-4)' }}>No gym session logged.</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <SectionLabel>◢ NOTES</SectionLabel>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onBlur={saveNotes}
                  rows={5}
                  placeholder="How was today? Write your reflection…"
                  className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none leading-relaxed"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg)', fontFamily: 'var(--font-sans)' }}
                />
                <div className="flex items-center justify-end gap-2 mt-1.5">
                  {savedFlash && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ok)' }}>✓ saved</span>}
                  <button onClick={saveNotes}
                    className="text-xs px-3 py-1 rounded-md font-semibold hover:brightness-110"
                    style={{ fontFamily: 'var(--font-mono)', background: 'var(--accent)', color: 'oklch(0.09 0.008 255)' }}>
                    SAVE
                  </button>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </Shell>
  )
}

'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'

interface LoggedSet { weight: number | null; reps: number | null }
interface LoggedExercise { name: string; group: string; unit: 'weight' | 'reps' | 'time'; target: string; sets: LoggedSet[] }
interface Session {
  date: string; day: number; label: string; exercises: LoggedExercise[]
  abs_included: boolean; whoop_strain: number | null; sauna: boolean; notes: string; saved_at: string
}
interface ProgressEntry { status: 'up' | 'same' | 'down' | 'new'; label: string }

function fmtDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function bestWeight(ex: LoggedExercise) {
  let w = 0, r = 0
  for (const s of ex.sets ?? []) { if (typeof s.weight === 'number') w = Math.max(w, s.weight); if (typeof s.reps === 'number') r = Math.max(r, s.reps) }
  return ex.unit === 'weight' ? w : r
}

// ── Minimal SVG line chart ────────────────────────────────────
function LineChart({ points, color = 'var(--accent)', unitLabel = '' }: { points: { label: string; value: number }[]; color?: string; unitLabel?: string }) {
  if (points.length === 0) return <p className="text-xs" style={{ color: 'var(--fg-2)' }}>No data yet.</p>
  const W = 320, H = 110, pad = 18
  const vals = points.map(p => p.value)
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = max - min || 1
  const xStep = points.length > 1 ? (W - pad * 2) / (points.length - 1) : 0
  const xy = points.map((p, i) => {
    const x = pad + i * xStep
    const y = H - pad - ((p.value - min) / span) * (H - pad * 2)
    return { x, y, ...p }
  })
  const path = xy.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {/* baseline */}
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--border)" strokeWidth="1" />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${color}88)` }} />
        {xy.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill={color} />
            <text x={p.x} y={p.y - 7} textAnchor="middle" style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--fg-3)' }}>{p.value}</text>
          </g>
        ))}
      </svg>
      <div className="flex justify-between" style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--fg-2)' }}>
        <span>{points[0].label}</span>
        {unitLabel && <span>{unitLabel}</span>}
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  )
}

export default function GymHistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [latestProgress, setLatestProgress] = useState<{ progress: Record<string, ProgressEntry>; summary: { up: number; same: number; down: number; comparedTo: string | null } } | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [exercise, setExercise] = useState<string>('')

  useEffect(() => {
    fetch('/api/gym-log/history').then(r => r.json()).then(d => {
      setSessions(d.sessions ?? [])
      setLatestProgress(d.latestProgress ?? null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // chronological (oldest → newest) for charts
  const chrono = useMemo(() => [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1)), [sessions])

  const strainPoints = chrono
    .filter(s => typeof s.whoop_strain === 'number')
    .map(s => ({ label: fmtDate(s.date).split(',')[0], value: s.whoop_strain as number }))

  // sauna this month
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const saunaThisMonth = sessions.filter(s => s.sauna && s.date.startsWith(ym)).length

  // all exercise names
  const allExercises = useMemo(() => {
    const set = new Set<string>()
    sessions.forEach(s => s.exercises.forEach(e => set.add(e.name)))
    return Array.from(set).sort()
  }, [sessions])

  const exercisePoints = useMemo(() => {
    if (!exercise) return []
    return chrono.flatMap(s => {
      const ex = s.exercises.find(e => e.name === exercise)
      if (!ex) return []
      return [{ label: fmtDate(s.date).split(',')[0], value: bestWeight(ex) }]
    })
  }, [exercise, chrono])

  return (
    <Shell>
      <div className="flex flex-col gap-4" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="flex items-center justify-between">
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--fg)' }}>
            GYM · HISTORY
          </h1>
          <Link href="/gym-log" className="card-label hover:opacity-70 transition-opacity" style={{ color: 'var(--accent)' }}>
            ← Log today
          </Link>
        </div>

        {loading ? (
          <p className="text-xs py-8 text-center" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>LOADING…</p>
        ) : sessions.length === 0 ? (
          <Panel index={1} title="No sessions yet">
            <p className="text-xs" style={{ color: 'var(--fg-2)' }}>Log your first workout and it&apos;ll show up here.</p>
          </Panel>
        ) : (
          <>
            {/* Progress vs last week */}
            {latestProgress && latestProgress.summary.comparedTo && (
              <Panel index={1} title="Progress vs Last Week">
                <div className="flex items-center gap-4 flex-wrap">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--ok)' }}>↑ {latestProgress.summary.up} improved</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--fg-3)' }}>= {latestProgress.summary.same} held</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--warn)' }}>↓ {latestProgress.summary.down} dropped</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)', marginLeft: 'auto' }}>latest vs {fmtDate(latestProgress.summary.comparedTo)}</span>
                </div>
              </Panel>
            )}

            {/* Charts row */}
            <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
              <Panel index={2} title="Whoop Strain">
                <LineChart points={strainPoints} color="oklch(0.74 0.15 200)" unitLabel="/21" />
              </Panel>
              <Panel index={3} title="Sauna" status={saunaThisMonth > 0 ? 'online' : 'none'}>
                <div className="flex flex-col items-center justify-center h-full gap-1 py-2">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 800, color: 'var(--ok)' }}>{saunaThisMonth}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)', letterSpacing: '0.1em' }}>
                    SAUNA DAYS · {now.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()}
                  </span>
                </div>
              </Panel>
            </div>

            {/* Per-exercise progression */}
            <Panel index={4} title="Exercise Progression" action={
              <select value={exercise} onChange={e => setExercise(e.target.value)}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg)' }}>
                <option value="">Pick an exercise…</option>
                {allExercises.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            }>
              {exercise
                ? <LineChart points={exercisePoints} color="var(--accent)" unitLabel="top set" />
                : <p className="text-xs" style={{ color: 'var(--fg-2)' }}>Select an exercise to see weight progression over time.</p>}
            </Panel>

            {/* Sessions list */}
            <Panel index={5} title={`Sessions · ${sessions.length}`}>
              <div className="flex flex-col">
                {sessions.map((s, i) => {
                  const open = expanded === s.date
                  return (
                    <div key={s.date} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                      <button onClick={() => setExpanded(open ? null : s.date)}
                        className="flex items-center gap-3 w-full text-left py-2.5">
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)', width: 12 }}>{open ? '▾' : '▸'}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{fmtDate(s.date)}</span>
                          <span className="text-xs ml-2" style={{ color: 'var(--fg-3)' }}>Day {s.day} · {s.label}</span>
                        </div>
                        {typeof s.whoop_strain === 'number' && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'oklch(0.74 0.15 200)' }}>{s.whoop_strain} strain</span>
                        )}
                        {s.sauna && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ok)' }}>🔥 sauna</span>}
                      </button>
                      {open && (
                        <div className="pb-3 pl-6 flex flex-col gap-2">
                          {s.exercises.length === 0 && <p className="text-xs" style={{ color: 'var(--fg-2)' }}>Rest day.</p>}
                          {s.exercises.map(ex => (
                            <div key={ex.name} className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-xs font-medium" style={{ color: 'var(--fg-2)', minWidth: 180 }}>{ex.name}</span>
                              <span className="flex gap-2 flex-wrap" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
                                {ex.sets.map((st, j) => (
                                  <span key={j} style={{ color: 'var(--fg-2)' }}>
                                    {ex.unit === 'weight'
                                      ? `${st.weight ?? '–'}×${st.reps ?? '–'}`
                                      : ex.unit === 'time'
                                        ? `${st.reps ?? '–'}s`
                                        : `${st.reps ?? '–'}`}
                                  </span>
                                ))}
                              </span>
                            </div>
                          ))}
                          {s.notes && <p className="text-xs mt-1" style={{ color: 'var(--fg-2)' }}>📝 {s.notes}</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Panel>
          </>
        )}
      </div>
    </Shell>
  )
}

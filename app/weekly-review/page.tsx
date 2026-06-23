'use client'

import { useEffect, useState, useCallback } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'

// ── Types ─────────────────────────────────────────────────────
interface Task {
  id: string
  title: string
  urgency: string
  priority_score: number
  tags: string[]
  time_estimate_min: number | null
  completed_at: string | null
  created_at: string
  due_date: string | null
}

interface HabitDay { done: string[]; total: number }

const HABITS = [
  'Hit the gym',
  'Eat clean + calorie surplus',
  'No social media before noon',
  'Work on business / clients',
  'Wake up early (before 8am)',
  'Review North Star goals',
]
const HABIT_SHORT = ['Gym', 'Eat clean', 'No social AM', 'Business', 'Wake early', 'North Star']

// ── Week math (Monday-start) ──────────────────────────────────
function startOfWeek(d: Date): Date {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7 // Mon=0 … Sun=6
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fmtShort(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── When/Where chip styling (shared with Session) ─────────────
const WHEN: Record<string, { label: string; color: string }> = {
  today:      { label: 'TODAY',     color: 'var(--hot)' },
  this_week:  { label: 'THIS WEEK', color: 'var(--warn)' },
  this_month: { label: 'THIS MO',   color: 'var(--accent)' },
  someday:    { label: 'SOMEDAY',   color: 'var(--fg-2)' },
}
const WHERE: Record<string, { label: string; color: string }> = {
  'deep-work': { label: 'DEEP WORK', color: 'oklch(0.70 0.16 250)' },
  'gym':       { label: 'GYM',       color: 'oklch(0.72 0.18 30)' },
  'court':     { label: 'COURT',     color: 'oklch(0.74 0.17 148)' },
  'campus':    { label: 'CAMPUS',    color: 'oklch(0.70 0.16 300)' },
  'calls':     { label: 'CALLS',     color: 'oklch(0.74 0.15 200)' },
  'errands':   { label: 'ERRANDS',   color: 'oklch(0.74 0.16 70)' },
  'home':      { label: 'HOME',      color: 'oklch(0.66 0.05 255)' },
  'anywhere':  { label: 'ANYWHERE',  color: 'var(--fg-2)' },
}
function priorityColor(s: number) {
  if (s >= 90) return 'var(--hot)'
  if (s >= 70) return 'var(--warn)'
  if (s >= 40) return 'var(--accent)'
  return 'var(--fg-2)'
}
function splitTags(tags: string[]) {
  const ctx = tags?.find(t => t.startsWith('@'))?.slice(1) ?? null
  const topical = tags?.filter(t => !t.startsWith('@')) ?? []
  return { ctx, topical }
}
function Chip({ label, color, filled = false }: { label: string; color: string; filled?: boolean }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
      padding: '1px 5px', borderRadius: 4, lineHeight: 1.4, whiteSpace: 'nowrap',
      color: filled ? 'var(--bg)' : color,
      background: filled ? color : `color-mix(in oklch, ${color} 14%, transparent)`,
      border: `1px solid color-mix(in oklch, ${color} 35%, transparent)`,
    }}>{label}</span>
  )
}

export default function WeeklyReviewPage() {
  const [weekOffset, setWeekOffset] = useState(0) // 0 = current week
  const [wins, setWins] = useState<Task[]>([])
  const [openLoops, setOpenLoops] = useState<Task[]>([])
  const [habits, setHabits] = useState<Record<string, HabitDay>>({})
  const [loading, setLoading] = useState(true)

  // Week boundaries for the selected offset
  const base = new Date()
  base.setDate(base.getDate() + weekOffset * 7)
  const weekStart = startOfWeek(base)
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6); weekEnd.setHours(23, 59, 59, 999)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d
  })
  const today = new Date()

  const load = useCallback(async () => {
    setLoading(true)
    const wsMs = weekStart.getTime()
    const weMs = weekEnd.getTime()

    // How many days back from now does this week start? (for habits window)
    const daysBack = Math.max(7, Math.ceil((Date.now() - wsMs) / 86_400_000) + 1)

    try {
      const [doneRes, openRes, habitsRes] = await Promise.all([
        fetch('/api/tasks?status=done').then(r => r.json()),
        fetch('/api/tasks?status=open').then(r => r.json()),
        fetch(`/api/habits?days=${daysBack}`).then(r => r.json()),
      ])

      const doneTasks: Task[] = doneRes.tasks ?? []
      setWins(doneTasks.filter(t => {
        if (!t.completed_at) return false
        const c = new Date(t.completed_at).getTime()
        return c >= wsMs && c <= weMs
      }))

      const openTasks: Task[] = openRes.tasks ?? []
      // Open loops = open tasks created on/before this week's end (existed during the week)
      setOpenLoops(openTasks
        .filter(t => new Date(t.created_at).getTime() <= weMs)
        .sort((a, b) => b.priority_score - a.priority_score))

      setHabits(habitsRes.habits ?? {})
    } catch {
      setWins([]); setOpenLoops([]); setHabits({})
    }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset])

  useEffect(() => { load() }, [load])

  // Habit stats
  const habitHitCount = (habitName: string) =>
    days.filter(d => habits[dateKey(d)]?.done?.includes(habitName)).length
  const dayHitCount = (d: Date) => {
    const rec = habits[dateKey(d)]
    return rec ? HABITS.filter(h => rec.done?.includes(h)).length : 0
  }
  const totalPossible = days.filter(d => d <= today).length * HABITS.length
  const totalHit = days.reduce((sum, d) => sum + dayHitCount(d), 0)
  const habitPct = totalPossible ? Math.round((totalHit / totalPossible) * 100) : 0

  function isOverdue(t: Task) {
    if (t.due_date) return new Date(t.due_date) < new Date(today.toDateString())
    // Older than 10 days and still open, or urgency 'today' created on a prior day
    const ageDays = (Date.now() - new Date(t.created_at).getTime()) / 86_400_000
    return ageDays > 10 || (t.urgency === 'today' && ageDays > 1)
  }

  return (
    <Shell>
      <div className="flex flex-col gap-4" style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header + week selector */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--fg)' }}>
            WEEKLY REVIEW
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWeekOffset(o => o - 1)}
              className="card-label hover:opacity-70 transition-opacity"
              style={{ color: 'var(--fg-3)', padding: '4px 8px' }}
            >‹ PREV</button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--accent)', minWidth: 180, textAlign: 'center' }}>
              {weekOffset === 0 ? 'THIS WEEK · ' : ''}{fmtShort(weekStart)} – {fmtShort(weekEnd)}
            </span>
            <button
              onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
              disabled={weekOffset >= 0}
              className="card-label hover:opacity-70 transition-opacity disabled:opacity-20"
              style={{ color: 'var(--fg-3)', padding: '4px 8px' }}
            >NEXT ›</button>
          </div>
        </div>

        {loading ? (
          <div className="text-xs py-8 text-center" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
            LOADING WEEK…
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">

            {/* WINS */}
            <Panel index={1} title={`Wins · ${wins.length}`} status={wins.length ? 'online' : 'none'}>
              {wins.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--fg-2)' }}>No tasks completed this week yet.</p>
              ) : (
                <div className="flex flex-col">
                  {wins.map((t, i) => {
                    const { ctx, topical } = splitTags(t.tags)
                    return (
                      <div key={t.id} className="flex items-start gap-2.5 py-2" style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                        <div className="w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center" style={{ background: 'var(--ok)', boxShadow: '0 0 6px var(--ok-dim)' }}>
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <p className="text-xs leading-snug" style={{ color: 'var(--fg-2)', textDecoration: 'line-through', textDecorationColor: 'var(--fg-2)' }}>{t.title}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {ctx && WHERE[ctx] && <Chip label={WHERE[ctx].label} color={WHERE[ctx].color} />}
                            {topical.map(tag => (
                              <span key={tag} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-2)' }}>#{tag}</span>
                            ))}
                            {t.completed_at && (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-2)', marginLeft: 'auto' }}>
                                {new Date(t.completed_at).toLocaleDateString('en-US', { weekday: 'short' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Panel>

            {/* OPEN LOOPS */}
            <Panel index={2} title={`Open Loops · ${openLoops.length}`} status={openLoops.length ? 'live' : 'none'}>
              {openLoops.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--fg-2)' }}>No open loops. Clean slate.</p>
              ) : (
                <div className="flex flex-col" style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {openLoops.map((t, i) => {
                    const { ctx, topical } = splitTags(t.tags)
                    const when = WHEN[t.urgency] ?? WHEN.someday
                    const overdue = isOverdue(t)
                    const pColor = priorityColor(t.priority_score)
                    return (
                      <div key={t.id} className="flex items-start gap-2.5 py-2" style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                        <div className="shrink-0 self-stretch rounded-full" style={{ width: 3, minHeight: 24, background: pColor, boxShadow: `0 0 6px color-mix(in oklch, ${pColor} 60%, transparent)` }} />
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <p className="text-xs leading-snug" style={{ color: 'var(--fg)' }}>{t.title}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {overdue && <Chip label="⚠ OVERDUE" color="var(--hot)" filled />}
                            <Chip label={when.label} color={when.color} />
                            {ctx && WHERE[ctx] && <Chip label={WHERE[ctx].label} color={WHERE[ctx].color} />}
                            {topical.map(tag => (
                              <span key={tag} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)' }}>#{tag}</span>
                            ))}
                          </div>
                        </div>
                        <span className="shrink-0 tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: pColor }}>{t.priority_score}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Panel>

            {/* HABIT SNAPSHOT — spans both columns */}
            <div style={{ gridColumn: '1 / -1' }}>
              <Panel index={3} title={`Habit Snapshot · ${habitPct}%`} status={habitPct >= 70 ? 'online' : 'none'}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '4px 8px 8px 0' }} />
                        {days.map(d => {
                          const isToday = dateKey(d) === dateKey(today)
                          return (
                            <th key={dateKey(d)} style={{ padding: '4px 0 8px', textAlign: 'center' }}>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: isToday ? 'var(--accent)' : 'var(--fg-2)', letterSpacing: '0.05em' }}>
                                {d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                              </div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: isToday ? 'var(--accent)' : 'var(--fg-3)' }}>
                                {d.getDate()}
                              </div>
                            </th>
                          )
                        })}
                        <th style={{ padding: '4px 0 8px 12px', textAlign: 'right' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-2)' }}>HIT</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {HABITS.map((h, hi) => (
                        <tr key={h}>
                          <td style={{ padding: '5px 10px 5px 0', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{HABIT_SHORT[hi]}</span>
                          </td>
                          {days.map(d => {
                            const rec = habits[dateKey(d)]
                            const future = d > today
                            const hit = rec?.done?.includes(h) ?? false
                            return (
                              <td key={dateKey(d)} style={{ textAlign: 'center', padding: '4px 0' }}>
                                <div style={{
                                  width: 22, height: 22, borderRadius: 6, margin: '0 auto',
                                  background: hit ? 'var(--ok)' : future ? 'transparent' : 'var(--bg-3)',
                                  border: `1px solid ${hit ? 'var(--ok)' : future ? 'var(--border)' : 'var(--bg-3)'}`,
                                  boxShadow: hit ? '0 0 6px var(--ok-dim)' : 'none',
                                  opacity: future ? 0.35 : 1,
                                }} />
                              </td>
                            )
                          })}
                          <td style={{ textAlign: 'right', padding: '4px 0 4px 12px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: habitHitCount(h) >= 5 ? 'var(--ok)' : 'var(--fg-3)' }}>
                              {habitHitCount(h)}/7
                            </span>
                          </td>
                        </tr>
                      ))}
                      {/* Per-day totals */}
                      <tr>
                        <td style={{ padding: '8px 10px 0 0' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-2)', letterSpacing: '0.05em' }}>DAY</span>
                        </td>
                        {days.map(d => {
                          const future = d > today
                          const n = dayHitCount(d)
                          return (
                            <td key={dateKey(d)} style={{ textAlign: 'center', padding: '8px 0 0' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: future ? 'var(--fg-2)' : n >= 4 ? 'var(--ok)' : n > 0 ? 'var(--warn)' : 'var(--fg-2)', opacity: future ? 0.4 : 1 }}>
                                {future ? '–' : `${n}/6`}
                              </span>
                            </td>
                          )
                        })}
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}

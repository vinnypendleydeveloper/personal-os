'use client'

import { useEffect, useState, useMemo } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'
import { WHERE, priorityBadge, splitTags, Chip } from '@/components/chips'

interface Task {
  id: string
  title: string
  priority_score: number
  tags: string[]
  urgency: string
  completed_at: string | null
}

const TZ = 'America/Los_Angeles'
function laDateKey(d: Date | string) {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: TZ })
}
function startOfWeek(d: Date) {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7 // Mon=0
  x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0)
  return x
}
function fmt(d: Date, o: Intl.DateTimeFormatOptions) { return d.toLocaleDateString('en-US', o) }

export default function TaskHistoryPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [weekStartKey, setWeekStartKey] = useState<string>(() => laDateKey(startOfWeek(new Date())))

  useEffect(() => {
    fetch('/api/tasks?status=done')
      .then(r => r.json())
      .then(d => { setTasks((d.tasks ?? []).filter((t: Task) => t.completed_at)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Build the list of weeks that have completed tasks (+ always include current week)
  const weeks = useMemo(() => {
    const set = new Set<string>()
    set.add(laDateKey(startOfWeek(new Date())))
    for (const t of tasks) {
      const ws = startOfWeek(new Date(t.completed_at!))
      set.add(laDateKey(ws))
    }
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1)) // newest first
  }, [tasks])

  // Days (Mon→Sun) for the selected week
  const weekDays = useMemo(() => {
    const [y, m, d] = weekStartKey.split('-').map(Number)
    const start = new Date(y, m - 1, d)
    return Array.from({ length: 7 }, (_, i) => { const x = new Date(start); x.setDate(x.getDate() + i); return x })
  }, [weekStartKey])

  const thisWeekKey = laDateKey(startOfWeek(new Date()))
  const weekTotal = tasks.filter(t => laDateKey(startOfWeek(new Date(t.completed_at!))) === weekStartKey).length

  function weekLabel(key: string) {
    const [y, m, d] = key.split('-').map(Number)
    const s = new Date(y, m - 1, d)
    const e = new Date(s); e.setDate(e.getDate() + 6)
    const range = `${fmt(s, { month: 'short', day: 'numeric' })} – ${fmt(e, { month: 'short', day: 'numeric' })}`
    return key === thisWeekKey ? `This Week · ${range}` : range
  }

  return (
    <Shell>
      <div className="flex flex-col gap-4" style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Header + week selector */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--fg)' }}>
            TASK HISTORY
          </h1>
          <select
            value={weekStartKey}
            onChange={e => setWeekStartKey(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg outline-none"
            style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--accent)' }}
          >
            {weeks.map(w => <option key={w} value={w}>{weekLabel(w)}</option>)}
          </select>
        </div>

        {loading ? (
          <p className="text-xs py-8 text-center" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>LOADING…</p>
        ) : (
          <Panel index={1} title={`Completed · ${weekTotal}`} status={weekTotal ? 'online' : 'none'}>
            <div className="flex flex-col gap-4">
              {weekDays.map(day => {
                const key = laDateKey(day)
                const dayTasks = tasks
                  .filter(t => laDateKey(t.completed_at!) === key)
                  .sort((a, b) => +new Date(b.completed_at!) - +new Date(a.completed_at!))
                const isToday = key === laDateKey(new Date())
                const isFuture = day > new Date()
                return (
                  <div key={key} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: isToday ? 'var(--accent)' : 'var(--fg-3)' }}>
                        {fmt(day, { weekday: 'long' }).toUpperCase()} · {fmt(day, { month: 'short', day: 'numeric' })}
                      </span>
                      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)' }}>{dayTasks.length}</span>
                    </div>
                    {dayTasks.length === 0 ? (
                      <p className="text-[11px] pl-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
                        {isFuture ? '—' : 'no tasks completed'}
                      </p>
                    ) : (
                      dayTasks.map(t => {
                        const { ctx, topical } = splitTags(t.tags ?? [])
                        const where = ctx ? (WHERE[ctx] ?? { label: ctx.toUpperCase(), color: 'var(--fg-2)' }) : null
                        const prio = priorityBadge(t.priority_score)
                        return (
                          <div key={t.id} className="flex items-start gap-2.5 pl-1">
                            <div className="w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center" style={{ background: 'var(--ok)', boxShadow: '0 0 5px var(--ok-dim)' }}>
                              <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                              <span className="text-xs" style={{ color: 'var(--fg-2)', textDecoration: 'line-through', textDecorationColor: 'var(--fg-2)' }}>{t.title}</span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Chip label={prio.label} color={prio.color} filled={prio.filled} />
                                {where && <Chip label={where.label} color={where.color} />}
                                {topical.map(tag => (
                                  <span key={tag} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-2)' }}>#{tag}</span>
                                ))}
                              </div>
                            </div>
                            <span className="shrink-0 tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)' }}>
                              {new Date(t.completed_at!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                )
              })}
            </div>
          </Panel>
        )}
      </div>
    </Shell>
  )
}

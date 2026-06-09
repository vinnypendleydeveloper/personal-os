'use client'

import { useEffect, useState, useRef, useCallback, DragEvent, KeyboardEvent } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'

// ── Types ──────────────────────────────────────────────────────

interface CalEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  location?: string
  tag?: string
}

interface WhoopSnapshot {
  recovery_score: number | null
  hrv: number | null
  rhr: number | null
  sleep_performance: number | null
  sleep_hours: number | null
  strain: number | null
}

interface RoutineIntake { energy?: string; focus?: string; note?: string }
interface DebriefData {
  wake_time: string | null
  whoop_connected: boolean
  whoop: WhoopSnapshot | null
  yesterday: { sleep_hours: number | null; hrv: number | null; recovery_score: number | null } | null
  averages: { sleep_7d: number | null; hrv_7d: number | null; recovery_7d: number | null; sample_days: number }
  comparisons: string[]
  due_tasks: { id: string; title: string; urgency: string; tags: string[] }[]
  routine: { done: number; total: number; doneLabels: string[]; remainingLabels: string[]; allDone: boolean } | null
  intake: RoutineIntake | null
  debrief_message: string | null
}

// ── Helpers ────────────────────────────────────────────────────

const TAG_COLOR: Record<string, string> = {
  class:    'oklch(0.70 0.16 300)',
  gym:      'oklch(0.72 0.18 30)',
  tennis:   'oklch(0.74 0.17 148)',
  call:     'oklch(0.74 0.15 200)',
  meeting:  'oklch(0.70 0.16 250)',
  work:     'oklch(0.74 0.16 70)',
  social:   'oklch(0.74 0.17 350)',
  personal: 'var(--fg-3)',
}

function fmtTime(date: Date) {
  return date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function recoveryColor(score: number | null) {
  if (score == null) return 'var(--fg-3)'
  if (score >= 66) return 'oklch(0.74 0.17 148)'
  if (score >= 33) return 'oklch(0.82 0.16 76)'
  return 'oklch(0.66 0.22 22)'
}

// ── Recovery Arc ───────────────────────────────────────────────

function RecoveryArc({ score }: { score: number | null }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80)
    return () => clearTimeout(t)
  }, [score])

  const r = 34
  const size = 84
  const cx = size / 2
  const circumference = 2 * Math.PI * r
  const pct = score ?? 0
  const filled = animated ? (pct / 100) * circumference : 0
  const color = recoveryColor(score)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)', width: size, height: size }}
      >
        {/* Track */}
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke="var(--bg-3)"
          strokeWidth={7}
        />
        {/* Fill */}
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{
            transition: 'stroke-dasharray 1.1s cubic-bezier(0.22, 1, 0.36, 1)',
            filter: score != null ? `drop-shadow(0 0 5px ${color})` : 'none',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: score != null ? 22 : 18,
          fontWeight: 700,
          color,
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}>
          {score != null ? score : '—'}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 7,
          color: 'var(--fg-3)',
          letterSpacing: '0.14em',
          marginTop: 2,
        }}>
          RECOV
        </span>
      </div>
    </div>
  )
}

// ── Stat cell ──────────────────────────────────────────────────

function Stat({ label, value, unit, dim }: {
  label: string
  value: number | string | null
  unit?: string
  dim?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 8,
        letterSpacing: '0.13em',
        color: 'var(--fg-3)',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 17,
          fontWeight: 600,
          color: dim ? 'var(--fg-3)' : 'var(--fg)',
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}>
          {value ?? '—'}
        </span>
        {unit && value != null && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--fg-3)',
            letterSpacing: '0.06em',
          }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Comparison chips ──────────────────────────────────────────

function ComparisonChip({ text }: { text: string }) {
  const isUp = text.includes('more') || text.includes('above') || text.includes('Best') || text.includes('best')
  const color = isUp ? 'oklch(0.74 0.17 148)' : 'oklch(0.82 0.16 76)'
  const symbol = isUp ? '↑' : '↓'
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      fontWeight: 500,
      letterSpacing: '0.04em',
      padding: '2px 6px',
      borderRadius: 4,
      color,
      background: `color-mix(in oklch, ${color} 12%, transparent)`,
      border: `1px solid color-mix(in oklch, ${color} 28%, transparent)`,
      whiteSpace: 'nowrap',
    }}>
      {symbol} {text}
    </span>
  )
}

// ── Debrief message renderer ───────────────────────────────────

const SECTION_HEADERS = [
  'WHERE YOU STAND',
  'NEXT 1–2 HOURS',
  'BODY STATUS',
  'ONE MOVE',
]
// Matches any of the known headers (with optional trailing colon)
const SECTION_RE = new RegExp(
  `^(${SECTION_HEADERS.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}):?`,
  'm'
)

function DebriefMessage({ text, accentColor }: { text: string; accentColor: string }) {
  // Split into [pre, header, body, header, body, ...]
  const parts = text.split(SECTION_RE).filter(s => s.trim())

  // Pair consecutive header + body chunks
  const sections: { header: string; body: string }[] = []
  let i = 0
  while (i < parts.length) {
    const trimmed = parts[i].trim()
    if (SECTION_HEADERS.some(h => trimmed.startsWith(h))) {
      sections.push({ header: trimmed.replace(/:$/, ''), body: (parts[i + 1] ?? '').trim() })
      i += 2
    } else {
      // orphan text before first header — skip
      i++
    }
  }

  if (!sections.length) {
    // fallback: plain text
    return (
      <div className="pl-3 py-0.5" style={{ borderLeft: `2px solid ${accentColor}` }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--fg)', lineHeight: 1.55, opacity: 0.9 }}>
          {text}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3" style={{ borderLeft: `2px solid ${accentColor}`, paddingLeft: 12 }}>
      {sections.map(({ header, body }) => (
        <div key={header} className="flex flex-col gap-0.5">
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            letterSpacing: '0.13em',
            color: accentColor,
            textTransform: 'uppercase',
            opacity: 0.8,
          }}>
            {header}
          </span>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: 'var(--fg)',
            lineHeight: 1.6,
            whiteSpace: 'pre-line',
            opacity: 0.92,
            margin: 0,
          }}>
            {body}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── Morning Debrief panel ──────────────────────────────────────

const ENERGY_OPTS = [
  { v: 'low', label: 'Low' },
  { v: 'medium', label: 'Medium' },
  { v: 'high', label: 'High' },
]

function MorningDebrief() {
  const [data, setData] = useState<DebriefData | null>(null)
  const [loading, setLoading] = useState(true)

  // Intake form
  const [formOpen, setFormOpen] = useState(false)
  const [energy, setEnergy] = useState('')
  const [focus, setFocus] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/debrief')
      .then(r => r.json())
      .then((d: DebriefData) => {
        setData(d)
        const hasIntake = !!(d.intake && (d.intake.energy || d.intake.focus || d.intake.note))
        if (d.intake) {
          setEnergy(d.intake.energy ?? '')
          setFocus(d.intake.focus ?? '')
          setNote(d.intake.note ?? '')
        }
        // Open the form automatically if Vinny hasn't done a real intake yet today
        setFormOpen(!hasIntake)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function submitIntake() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/debrief', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ energy, focus, note }),
      })
      const d: DebriefData = await res.json()
      setData(d)
      setFormOpen(false)
    } catch { /* keep form open */ }
    setSubmitting(false)
  }

  const wakeStr = data?.wake_time
    ? new Date(data.wake_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const recColor = recoveryColor(data?.whoop?.recovery_score ?? null)

  return (
    <Panel
      index={0}
      title="Morning Debrief"
      action={
        wakeStr ? (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            color: 'oklch(0.82 0.16 76)',
          }}>
            AWAKE · {wakeStr}
          </span>
        ) : loading ? (
          <span className="font-mono text-[10px]" style={{ color: 'var(--fg-3)' }}>LOGGING…</span>
        ) : null
      }
      style={{
        background: `color-mix(in oklch, var(--bg-1) 96%, oklch(0.82 0.16 76) 4%)`,
      }}
    >
      {/* Date line */}
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: 'var(--fg-3)',
        letterSpacing: '0.12em',
        marginTop: -4,
        textTransform: 'uppercase',
      }}>
        {dateStr}
      </p>

      {loading ? (
        <div className="flex flex-col gap-3">
          {/* Skeleton */}
          <div className="flex items-center gap-4">
            <div className="shrink-0 rounded-full" style={{ width: 84, height: 84, background: 'var(--bg-3)' }} />
            <div className="flex flex-col gap-2 flex-1">
              {[50, 70, 40, 60].map(w => (
                <div key={w} className="rounded" style={{ height: 10, width: `${w}%`, background: 'var(--bg-3)' }} />
              ))}
            </div>
          </div>
          <div className="rounded" style={{ height: 36, background: 'var(--bg-3)' }} />
        </div>
      ) : (
        <>
          {/* Biometrics row */}
          {(data?.whoop || data?.whoop_connected === false) && (
            <div className="flex items-center gap-4">
              {data.whoop ? (
                <>
                  <RecoveryArc score={data.whoop.recovery_score} />
                  <div className="grid grid-cols-2 gap-x-5 gap-y-3 flex-1">
                    <Stat label="Sleep" value={data.whoop.sleep_hours} unit="h" />
                    <Stat label="HRV" value={data.whoop.hrv} unit="ms" />
                    <Stat
                      label="Sleep Score"
                      value={data.whoop.sleep_performance != null ? `${data.whoop.sleep_performance}%` : null}
                    />
                    <Stat label="RHR" value={data.whoop.rhr} unit="bpm" dim />
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2.5 py-1">
                  <span style={{ fontSize: 16 }}>⌚</span>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', letterSpacing: '0.08em' }}>
                    WHOOP not connected — no sleep data
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Comparison chips */}
          {data?.comparisons && data.comparisons.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.comparisons.map((c, i) => <ComparisonChip key={i} text={c} />)}
            </div>
          )}

          {/* Quick intake — 2-3 questions, all at once (not a chat) */}
          {formOpen ? (
            <div className="flex flex-col gap-2.5 p-3 rounded-lg" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.13em', color: 'var(--accent)', textTransform: 'uppercase' }}>
                  Quick intake — plan the next 1–2 hrs
                </span>
                {data?.routine && data.routine.total > 0 && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)' }}>
                    routine {data.routine.done}/{data.routine.total}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--fg-3)', width: 52 }}>ENERGY</span>
                <div className="flex gap-1">
                  {ENERGY_OPTS.map(o => (
                    <button key={o.v} onClick={() => setEnergy(o.v)}
                      className="text-[11px] px-2.5 py-1 rounded-md transition-all"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        background: energy === o.v ? 'var(--accent-dim)' : 'var(--bg-3)',
                        color: energy === o.v ? 'var(--accent)' : 'var(--fg-3)',
                        border: `1px solid ${energy === o.v ? 'var(--accent-glow)' : 'transparent'}`,
                      }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <input value={focus} onChange={e => setFocus(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitIntake()}
                placeholder="#1 thing to get done this morning…"
                className="w-full text-sm px-2.5 py-1.5 rounded-md outline-none"
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--fg)' }} />
              <input value={note} onChange={e => setNote(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitIntake()}
                placeholder="Anything on your mind? (optional)"
                className="w-full text-sm px-2.5 py-1.5 rounded-md outline-none"
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--fg)' }} />
              <button onClick={submitIntake} disabled={submitting}
                className="self-start text-xs px-3 py-1.5 rounded-md font-semibold disabled:opacity-40 hover:brightness-110"
                style={{ fontFamily: 'var(--font-mono)', background: 'var(--accent)', color: 'oklch(0.09 0.008 255)' }}>
                {submitting ? 'PLANNING…' : 'PLAN MY MORNING'}
              </button>
            </div>
          ) : (
            <button onClick={() => setFormOpen(true)}
              className="self-start text-[10px] font-mono px-2 py-1 rounded transition-opacity hover:opacity-100"
              style={{ color: 'var(--accent)', opacity: 0.8 }}>
              ↻ Adjust morning intake
            </button>
          )}

          {/* AI Briefing */}
          {data?.debrief_message && (
            <DebriefMessage text={data.debrief_message} accentColor={data.whoop?.recovery_score != null ? recColor : 'var(--accent)'} />
          )}

          {/* Due Today */}
          {data?.due_tasks && data.due_tasks.length > 0 && (
            <div className="pt-1" style={{ borderTop: '1px solid var(--border)' }}>
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                letterSpacing: '0.14em',
                color: 'var(--fg-3)',
                marginBottom: 6,
              }}>
                DUE TODAY
              </p>
              <div className="flex flex-col gap-1.5">
                {data.due_tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2">
                    <div
                      className="w-1 h-1 rounded-full shrink-0"
                      style={{ background: task.urgency === 'today' ? 'var(--hot)' : 'var(--warn)' }}
                    />
                    <span style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 12,
                      color: 'var(--fg)',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {task.title}
                    </span>
                    {task.tags?.slice(0, 1).map(tag => (
                      <span key={tag} style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 8,
                        letterSpacing: '0.08em',
                        color: 'var(--fg-3)',
                        padding: '1px 5px',
                        background: 'var(--bg-3)',
                        borderRadius: 3,
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state: no WHOOP, no tasks, no message */}
          {!data?.whoop && !data?.debrief_message && !data?.due_tasks?.length && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', letterSpacing: '0.08em' }}>
              Wake time logged. Connect WHOOP for full debrief.
            </p>
          )}
        </>
      )}
    </Panel>
  )
}

// ── Today's Schedule ───────────────────────────────────────────

function TodaySchedule() {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/calendar')
      .then(r => r.json())
      .then(data => {
        const today = new Date()
        const todayEvents = (data.events ?? []).filter((e: CalEvent) => sameDay(new Date(e.start), today))
        setEvents(todayEvents)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const now = new Date()
  const upcoming = events.filter(e => e.allDay || new Date(e.end) >= now)
  const past = events.filter(e => !e.allDay && new Date(e.end) < now)

  return (
    <Panel index={2} title="Today's Schedule" action={
      <span className="font-mono text-[10px]" style={{ color: 'var(--fg-2)' }}>
        {events.length} event{events.length !== 1 ? 's' : ''}
      </span>
    }>
      {loading ? (
        <p className="text-xs font-mono" style={{ color: 'var(--fg-2)' }}>LOADING…</p>
      ) : events.length === 0 ? (
        <p className="text-xs font-mono" style={{ color: 'var(--fg-3)' }}>No events scheduled today.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {upcoming.map(event => {
            const tagColor = TAG_COLOR[event.tag ?? 'personal'] ?? 'var(--fg-3)'
            const startDate = new Date(event.start)
            const endDate = new Date(event.end)
            const isNow = !event.allDay && startDate <= now && endDate > now
            return (
              <div key={event.id} className="flex gap-2.5 items-start">
                <div
                  className="w-1 rounded-full mt-1.5 shrink-0 self-stretch"
                  style={{
                    background: tagColor,
                    minHeight: 8,
                    boxShadow: isNow ? `0 0 6px color-mix(in oklch, ${tagColor} 70%, transparent)` : 'none',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-medium" style={{ color: 'var(--fg)' }}>
                      {event.title}
                    </p>
                    {isNow && (
                      <span className="font-mono text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: 'var(--hot)', color: 'var(--bg)', letterSpacing: '0.06em' }}>
                        NOW
                      </span>
                    )}
                    {event.tag && (
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 600, letterSpacing: '0.06em',
                        padding: '1px 4px', borderRadius: 3, color: tagColor,
                        background: `color-mix(in oklch, ${tagColor} 13%, transparent)`,
                        border: `1px solid color-mix(in oklch, ${tagColor} 32%, transparent)`,
                      }}>
                        {event.tag.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono" style={{ color: 'var(--fg-2)' }}>
                    {event.allDay ? 'All day' : `${fmtTime(startDate)} – ${fmtTime(endDate)}`}
                  </p>
                  {event.location && (
                    <p className="text-[10px]" style={{ color: 'var(--fg-3)' }}>📍 {event.location}</p>
                  )}
                </div>
              </div>
            )
          })}
          {past.length > 0 && (
            <div className="mt-1 pt-1.5" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="font-mono text-[9px] mb-1.5" style={{ color: 'var(--fg-3)', letterSpacing: '0.1em' }}>COMPLETED</p>
              {past.map(event => {
                const tagColor = TAG_COLOR[event.tag ?? 'personal'] ?? 'var(--fg-3)'
                return (
                  <div key={event.id} className="flex gap-2.5 items-start opacity-45">
                    <div className="w-1 rounded-full mt-1.5 shrink-0 self-stretch" style={{ background: tagColor, minHeight: 8 }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium" style={{ color: 'var(--fg-2)', textDecoration: 'line-through' }}>
                        {event.title}
                      </p>
                      <p className="text-[10px] font-mono" style={{ color: 'var(--fg-3)' }}>
                        {fmtTime(new Date(event.start))} – {fmtTime(new Date(event.end))}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}

// ── Weight Input ───────────────────────────────────────────────

function WeightInput({ onSaved }: { onSaved: (logged: boolean) => void }) {
  const today = localDate()
  const [saved, setSaved] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onSavedRef = useRef(onSaved)
  useEffect(() => { onSavedRef.current = onSaved }, [onSaved])

  useEffect(() => {
    fetch(`/api/weight?date=${today}`)
      .then(r => r.json())
      .then(d => {
        if (d.weight_lbs != null) {
          setSaved(d.weight_lbs)
          setInput(d.weight_lbs.toFixed(1))
          onSavedRef.current(true)
        }
      })
      .catch(() => {})
  }, [today])

  async function save() {
    const val = parseFloat(input)
    if (saving) return
    if (!val || val < 50 || val > 999) {
      setError('Enter a weight between 50 and 999 lbs')
      return
    }
    const rounded = Math.round(val * 10) / 10
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, weight_lbs: rounded }),
      })
      if (!res.ok) throw new Error(`Save failed (${res.status})`)
      setSaved(rounded)
      setInput(rounded.toFixed(1))
      setDirty(false)
      onSavedRef.current(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save — try again')
    }
    setSaving(false)
  }

  const isEditing = dirty || saved == null

  return (
    <Panel index={1} title="Weight" action={
      saved != null && !dirty
        ? <span className="font-mono text-[10px]" style={{ color: 'var(--ok)' }}>LOGGED ●</span>
        : <span className="font-mono text-[10px]" style={{ color: 'var(--hot)' }}>REQUIRED</span>
    }>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="number"
            min={50}
            max={999}
            step={0.1}
            value={input}
            onChange={e => { setInput(e.target.value); setDirty(true); if (error) setError(null) }}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="Enter weight…"
            className="w-full font-mono font-bold rounded px-3 py-2 outline-none text-right"
            style={{
              fontSize: '1.5rem',
              background: 'var(--bg-2)',
              border: `1px solid ${isEditing ? 'var(--warn)' : 'var(--border)'}`,
              color: 'var(--warn)',
              boxShadow: isEditing ? '0 0 8px oklch(0.82 0.16 76 / 0.15)' : 'none',
              transition: 'border-color 200ms, box-shadow 200ms',
            }}
          />
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs pointer-events-none"
            style={{ color: 'var(--fg-2)' }}
          >
            lbs
          </span>
        </div>
        {isEditing && (
          <button
            onClick={save}
            disabled={saving || !input || parseFloat(input) <= 0}
            className="font-mono text-xs px-4 py-2.5 rounded font-bold disabled:opacity-40 transition-all hover:brightness-110 shrink-0"
            style={{ background: 'var(--warn)', color: 'var(--bg)' }}
          >
            {saving ? '…' : 'SAVE'}
          </button>
        )}
      </div>
      {error && (
        <p className="font-mono text-[10px]" style={{ color: 'var(--hot)' }}>{error}</p>
      )}
      {!error && saved != null && !dirty && (
        <p className="font-mono text-[10px]" style={{ color: 'var(--fg-2)' }}>
          Today's log: {saved.toFixed(1)} lbs · click the field to update
        </p>
      )}
      {!error && saved == null && (
        <p className="font-mono text-[10px]" style={{ color: 'var(--fg-3)' }}>
          Log weight to unlock routine completion
        </p>
      )}
    </Panel>
  )
}

// ── Main page ──────────────────────────────────────────────────

interface Item { id: string; label: string }

export default function MorningRoutinePage() {
  const [items, setItems] = useState<Item[]>([])
  const [completions, setCompletions] = useState<Record<string, string>>({})
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [weightLogged, setWeightLogged] = useState(false)
  const handleWeightSaved = useCallback((v: boolean) => setWeightLogged(v), [])

  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/morning-routine')
      .then(r => r.json())
      .then(d => {
        setItems(d.items ?? [])
        setCompletions(d.completions ?? {})
        setStreak(d.streak ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { if (editingId) editRef.current?.select() }, [editingId])

  function saveItems(next: Item[]) {
    setItems(next)
    fetch('/api/morning-routine', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'items', items: next }),
    }).catch(console.error)
  }

  async function toggle(id: string) {
    const isDone = !!completions[id]
    const next = { ...completions }
    if (isDone) delete next[id]
    else next[id] = new Date().toISOString()
    setCompletions(next)
    try {
      const res = await fetch('/api/morning-routine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'toggle', itemId: id, completed: !isDone }),
      })
      const d = await res.json()
      if (d.completions) setCompletions(d.completions)
      if (typeof d.streak === 'number') setStreak(d.streak)
    } catch { /* keep optimistic state */ }
  }

  function addItem() {
    const label = newLabel.trim()
    if (!label) return
    const item: Item = { id: crypto.randomUUID(), label }
    saveItems([...items, item])
    setNewLabel('')
  }

  function deleteItem(id: string) {
    saveItems(items.filter(i => i.id !== id))
  }

  function commitRename(id: string) {
    const v = editDraft.trim()
    setEditingId(null)
    if (v) saveItems(items.map(i => i.id === id ? { ...i, label: v } : i))
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return }
    const from = items.findIndex(i => i.id === dragId)
    const to = items.findIndex(i => i.id === targetId)
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    saveItems(next)
    setDragId(null); setOverId(null)
  }

  const completedItems = items.filter(i => completions[i.id]).length
  const totalItems = items.length
  const progressCompleted = completedItems + (weightLogged ? 1 : 0)
  const progressTotal = totalItems + 1
  const pct = progressTotal ? Math.round((progressCompleted / progressTotal) * 100) : 0
  const allDone = weightLogged && totalItems > 0 && completedItems === totalItems

  return (
    <Shell>
      <div className="flex flex-col gap-4" style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Morning Debrief — always first, logs wake time on mount */}
        <MorningDebrief />

        <WeightInput onSaved={handleWeightSaved} />

        <TodaySchedule />

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--fg)' }}>
            MORNING ROUTINE
          </h1>
          <div className="flex items-center gap-1.5" title="Days in a row you've completed the full routine">
            <span style={{ fontSize: 14 }}>🔥</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800, color: streak > 0 ? 'oklch(0.74 0.16 70)' : 'var(--fg-2)' }}>
              {streak}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-2)', letterSpacing: '0.1em' }}>
              DAY{streak === 1 ? '' : 'S'}
            </span>
          </div>
        </div>

        <Panel index={3} title="Today" status={allDone ? 'online' : 'none'} action={
          <span className="card-label" style={{ color: allDone ? 'var(--ok)' : 'var(--fg-3)' }}>
            {progressCompleted}/{progressTotal}{allDone ? ' COMPLETE ●' : ''}
          </span>
        }>
          {/* Progress bar */}
          <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
            <div className="h-full rounded-full transition-all duration-500 ease-out" style={{
              width: `${pct}%`,
              background: allDone
                ? 'linear-gradient(90deg, var(--ok), oklch(0.82 0.16 148))'
                : 'linear-gradient(90deg, var(--accent), oklch(0.74 0.16 70))',
              boxShadow: pct > 0 ? `0 0 8px ${allDone ? 'var(--ok)' : 'var(--accent)'}` : 'none',
            }} />
          </div>

          {loading ? (
            <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>LOADING…</p>
          ) : (
            <div className="flex flex-col gap-1 mt-1">
              {items.map((item, idx) => {
                const done = completions[item.id]
                const isOver = overId === item.id && dragId !== item.id
                return (
                  <div
                    key={item.id}
                    draggable={editingId !== item.id}
                    onDragStart={() => setDragId(item.id)}
                    onDragEnd={() => { setDragId(null); setOverId(null) }}
                    onDragOver={(e: DragEvent) => { e.preventDefault(); setOverId(item.id) }}
                    onDrop={() => onDrop(item.id)}
                    className="group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-all"
                    style={{
                      background: isOver ? 'var(--accent-dim)' : 'transparent',
                      borderTop: isOver ? '2px solid var(--accent)' : '2px solid transparent',
                      opacity: dragId === item.id ? 0.4 : 1,
                      cursor: editingId === item.id ? 'text' : 'grab',
                    }}
                  >
                    <span className="shrink-0 select-none opacity-30 group-hover:opacity-60 transition-opacity" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-3)', cursor: 'grab' }}>
                      ⠿
                    </span>
                    <span className="shrink-0 w-4 text-right tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)' }}>
                      {idx + 1}
                    </span>
                    <button
                      onClick={() => toggle(item.id)}
                      className="w-5 h-5 rounded shrink-0 border flex items-center justify-center transition-all duration-200"
                      style={{
                        background: done ? 'var(--ok)' : 'transparent',
                        borderColor: done ? 'var(--ok)' : 'var(--bg-3)',
                        boxShadow: done ? '0 0 6px var(--ok-dim)' : 'none',
                      }}
                    >
                      {done && (
                        <svg width="10" height="8" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                    </button>
                    {editingId === item.id ? (
                      <input
                        ref={editRef}
                        value={editDraft}
                        onChange={e => setEditDraft(e.target.value)}
                        onBlur={() => commitRename(item.id)}
                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                          if (e.key === 'Enter') commitRename(item.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        autoFocus
                        className="flex-1 text-sm outline-none rounded px-1.5 py-0.5 min-w-0"
                        style={{ background: 'var(--bg-2)', border: '1px solid var(--accent-glow)', color: 'var(--fg)' }}
                      />
                    ) : (
                      <span
                        onClick={() => { setEditDraft(item.label); setEditingId(item.id) }}
                        className="flex-1 text-sm cursor-text transition-all duration-200 min-w-0"
                        style={{
                          color: done ? 'var(--fg-2)' : 'var(--fg)',
                          textDecoration: done ? 'line-through' : 'none',
                          textDecorationColor: 'var(--fg-2)',
                        }}
                        title="Click to rename"
                      >
                        {item.label}
                      </span>
                    )}
                    {done && (
                      <span className="shrink-0 tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ok)' }}>
                        {new Date(done).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--hot)' }}
                      title="Delete item"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}

              {/* Add new item */}
              <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', marginLeft: 6 }}>+</span>
                <input
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addItem()}
                  placeholder="Add a step…"
                  className="flex-1 text-sm px-2 py-1.5 rounded-lg outline-none"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                />
                <button
                  onClick={addItem}
                  disabled={!newLabel.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-30 hover:brightness-110"
                  style={{ fontFamily: 'var(--font-mono)', background: 'var(--accent)', color: 'oklch(0.09 0.008 255)' }}
                >ADD</button>
              </div>
            </div>
          )}
        </Panel>

        <p className="text-[10px] text-center" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
          Drag ⠿ to reorder · click a step to rename · completions reset at midnight
        </p>
      </div>
    </Shell>
  )
}

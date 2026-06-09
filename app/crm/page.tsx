'use client'

import { useEffect, useState, useRef } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'

// ─── Types ────────────────────────────────────────────────────────────────────
type Priority = 'high' | 'medium' | 'low' | 'none'
type View = 'kanban' | 'smart'

interface Task {
  id: string
  title: string
  description: string | null
  urgency: string
  key: boolean
  priority_score: number
  time_estimate_min: number | null
  tags: string[]
  due_date: string | null
  completed_at: string | null
}

// ─── Priority ─────────────────────────────────────────────────────────────────
const PRIORITY_CFG: Record<Priority, { label: string; color: string; score: number }> = {
  high:   { label: 'HIGH', color: 'oklch(0.65 0.22 20)',  score: 100 },
  medium: { label: 'MED',  color: 'oklch(0.75 0.18 65)',  score: 50  },
  low:    { label: 'LOW',  color: 'oklch(0.70 0.16 250)', score: 10  },
  none:   { label: '—',    color: 'var(--ink-4)',          score: 0   },
}
const PRIORITY_ORDER: Priority[] = ['high', 'medium', 'low', 'none']

function scoreToPriority(s: number): Priority {
  if (s >= 75) return 'high'
  if (s >= 25) return 'medium'
  if (s >= 1)  return 'low'
  return 'none'
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function localDateStr(d: Date) { return d.toLocaleDateString('en-CA') }
function todayStr()            { return localDateStr(new Date()) }

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_NAMES   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function getWeekDays(): { str: string; label: string; sub: string }[] {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dow    = today.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(today); monday.setDate(today.getDate() + offset)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    return { str: localDateStr(d), label: DAY_NAMES[i], sub: `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}` }
  })
}

function fmtDate(s: string) {
  const [, m, d] = s.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${d}`
}

// ─── Column colors ────────────────────────────────────────────────────────────
const COL_COLORS = {
  overdue:    'oklch(0.62 0.22 18)',
  today:      'oklch(0.72 0.18 240)',
  day:        'oklch(0.60 0.08 240)',
  this_week:  'oklch(0.65 0.13 200)',
  this_month: 'oklch(0.68 0.14 55)',
  someday:    'oklch(0.58 0.07 240)',
}

// ─── Bucketing ────────────────────────────────────────────────────────────────
function getBucket(task: Task, today: string, weekDates: Set<string>): string {
  const due = task.due_date
  if (due) {
    if (due < today)        return 'overdue'
    if (due === today)      return 'today'
    if (weekDates.has(due)) return `day:${due}`
    // Future date outside this week — bucket by month
    if (due.slice(0, 7) === today.slice(0, 7)) return 'this_month'
    return 'someday'
  }
  if (task.urgency === 'today')      return 'today'
  if (task.urgency === 'this_month') return 'this_month'
  if (task.urgency === 'someday')    return 'someday'
  return 'someday'
}

// ─── Primitives ───────────────────────────────────────────────────────────────
function Chip({ label, color, filled = false }: { label: string; color: string; filled?: boolean }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
      padding: '1px 5px', borderRadius: 4, lineHeight: 1.4, whiteSpace: 'nowrap',
      color:      filled ? 'oklch(0.10 0.01 255)' : color,
      background: filled ? color : `color-mix(in oklch, ${color} 14%, transparent)`,
      border:     `1px solid color-mix(in oklch, ${color} 32%, transparent)`,
    }}>{label}</span>
  )
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onClick, onComplete, onDelete, showDate = false }: {
  task: Task; onClick: () => void; onComplete: () => void; onDelete: () => void; showDate?: boolean
}) {
  const p    = scoreToPriority(task.priority_score)
  const pCfg = PRIORITY_CFG[p]
  const today   = todayStr()
  const overdue = !!(task.due_date && task.due_date < today)

  return (
    <div
      onClick={onClick}
      className="panel cursor-pointer group transition-all"
      style={{ padding: '7px 9px', borderLeftWidth: 2, borderLeftColor: p !== 'none' ? pCfg.color : 'transparent' }}
    >
      <div className="flex items-start gap-1.5">
        {task.key && <span className="text-[10px] mt-0.5 shrink-0 leading-none" style={{ color: 'var(--danger)' }}>★</span>}
        <p className="text-xs flex-1 leading-relaxed line-clamp-2" style={{ color: 'var(--foreground)' }}>
          {task.title}
        </p>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-0.5">
          <button onClick={e => { e.stopPropagation(); onComplete() }}
            className="text-[10px] px-1 py-0.5 rounded leading-none"
            style={{ color: 'var(--ok)', background: 'oklch(0.72 0.18 145 / 0.15)' }}>✓</button>
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="text-[10px] px-1 py-0.5 rounded leading-none"
            style={{ color: 'var(--danger)', background: 'oklch(0.65 0.22 20 / 0.15)' }}>✕</button>
        </div>
      </div>
      <div className="flex gap-1 mt-1.5 flex-wrap items-center">
        {p !== 'none' && <Chip label={pCfg.label} color={pCfg.color} filled={p === 'high'} />}
        {showDate && task.due_date && (
          <Chip
            label={overdue ? `OVERDUE ${fmtDate(task.due_date)}` : fmtDate(task.due_date)}
            color={overdue ? 'var(--danger)' : 'var(--ink-4)'}
            filled={overdue}
          />
        )}
        {task.time_estimate_min != null && (
          <span className="font-mono" style={{ fontSize: 9, color: 'var(--ink-4)' }}>~{task.time_estimate_min}m</span>
        )}
        {(task.tags ?? []).filter(t => !t.startsWith('@')).map(tag => (
          <span key={tag} className="font-mono" style={{ fontSize: 9, color: 'var(--ink-4)' }}>#{tag}</span>
        ))}
      </div>
    </div>
  )
}

// ─── ColHeader ────────────────────────────────────────────────────────────────
function ColHeader({ label, sub, count, color, accent = false }: {
  label: string; sub: string; count: number; color: string; accent?: boolean
}) {
  return (
    <div
      className="px-1 pb-1.5 flex items-start gap-2 shrink-0"
      style={{ borderBottom: `1px solid ${accent ? color : `color-mix(in oklch, ${color} 40%, transparent)`}` }}
    >
      <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-mono font-semibold uppercase tracking-widest leading-tight" style={{ color }}>
          {label}
        </div>
        <div className="text-[10px] font-mono leading-tight mt-0.5" style={{ color: 'var(--ink-4)' }}>{sub}</div>
      </div>
      {count > 0 && (
        <span className="text-[10px] font-mono mt-0.5 shrink-0" style={{ color: 'var(--ink-4)' }}>{count}</span>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CRMPage() {
  const [tasks,   setTasks]   = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('pos-crm-view') as View) ?? 'kanban' : 'kanban'
  )
  const [weekOpen, setWeekOpen] = useState(false)

  const weekDays    = getWeekDays()
  const today       = todayStr()
  const weekDateSet = new Set(weekDays.map(d => d.str))

  // Header add-task form
  const [newTitle,    setNewTitle]    = useState('')
  const [newPriority, setNewPriority] = useState<Priority>('medium')
  const [newDate,     setNewDate]     = useState(today)
  const [newUrgency,  setNewUrgency]  = useState('')
  const [newKey,      setNewKey]      = useState(false)
  const [adding,      setAdding]      = useState(false)

  // Per-column quick-add
  const [quickColId, setQuickColId] = useState<string | null>(null)
  const [quickTitle, setQuickTitle] = useState('')
  const quickRef = useRef<HTMLInputElement>(null)

  // Drawer
  const [selected,     setSelected]     = useState<Task | null>(null)
  const [editTitle,    setEditTitle]     = useState('')
  const [editDesc,     setEditDesc]      = useState('')
  const [editPriority, setEditPriority]  = useState<Priority>('none')
  const [editDate,     setEditDate]      = useState('')
  const [editUrgency,  setEditUrgency]   = useState('')
  const [editKey,      setEditKey]       = useState(false)
  const [saving,       setSaving]        = useState(false)

  // Smart view
  const [smartQuery,   setSmartQuery]   = useState('')
  const [smartIds,     setSmartIds]     = useState<string[] | null>(null)
  const [smartLoading, setSmartLoading] = useState(false)

  const dirtyRef = useRef(false)

  useEffect(() => { fetchTasks() }, [])
  useEffect(() => { if (quickColId) setTimeout(() => quickRef.current?.focus(), 40) }, [quickColId])

  // Close week overlay on Escape
  useEffect(() => {
    if (!weekOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setWeekOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [weekOpen])

  async function fetchTasks() {
    const res = await fetch('/api/tasks?status=open')
    const { tasks: data } = await res.json()
    if (!dirtyRef.current) setTasks(data ?? [])
    setLoading(false)
  }

  function setViewPersist(v: View) { setView(v); localStorage.setItem('pos-crm-view', v) }

  async function addTask(opts?: { colId?: string; title?: string; urgency?: string; date?: string }) {
    const title = (opts?.title ?? newTitle).trim()
    if (!title) return
    setAdding(true)
    dirtyRef.current = true

    let urgency  = opts?.urgency ?? (newUrgency || 'someday')
    let due_date = opts?.date ?? (newUrgency ? null : newDate || null)

    if (due_date && !opts?.urgency) {
      if (due_date === today) urgency = 'today'
      else if (weekDateSet.has(due_date)) urgency = 'this_week'
      else urgency = 'someday'
    }

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        urgency,
        key: opts?.colId ? false : newKey,
        priority_score: PRIORITY_CFG[opts?.colId ? 'medium' : newPriority].score,
        due_date: due_date || null,
      }),
    })
    const { task } = await res.json()
    setTasks(prev => [task, ...prev])

    if (opts?.colId) { setQuickTitle(''); setQuickColId(null) }
    else { setNewTitle(''); setNewKey(false) }
    setAdding(false)
  }

  async function completeTask(id: string) {
    dirtyRef.current = true
    setTasks(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed_at: new Date().toISOString() }),
    })
    if (selected?.id === id) setSelected(null)
  }

  async function deleteTask(id: string) {
    dirtyRef.current = true
    setTasks(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (selected?.id === id) setSelected(null)
  }

  function openDrawer(task: Task) {
    setSelected(task)
    setEditTitle(task.title)
    setEditDesc(task.description ?? '')
    setEditPriority(scoreToPriority(task.priority_score))
    setEditDate(task.due_date ?? '')
    setEditUrgency(task.due_date ? '' : (task.urgency === 'this_week' ? '' : task.urgency))
    setEditKey(task.key)
  }

  async function saveDrawer() {
    if (!selected) return
    setSaving(true)
    dirtyRef.current = true
    const pScore = PRIORITY_CFG[editPriority].score
    let urgency = editUrgency || 'someday'
    if (editDate) {
      if (editDate === today) urgency = 'today'
      else if (weekDateSet.has(editDate)) urgency = 'this_week'
      else urgency = 'someday'
    }
    const updated: Task = { ...selected, title: editTitle, description: editDesc, priority_score: pScore,
      due_date: editDate || null, urgency, key: editKey }
    setTasks(prev => prev.map(t => t.id === selected.id ? updated : t))
    setSelected(updated)
    await fetch(`/api/tasks/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, description: editDesc, priority_score: pScore,
        due_date: editDate || null, urgency, key: editKey }),
    })
    setSaving(false)
  }

  async function runSmartSearch() {
    if (!smartQuery.trim()) return
    setSmartLoading(true)
    const res = await fetch('/api/tasks/smart', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: smartQuery }),
    })
    const data = await res.json()
    setSmartIds(data.ids ?? [])
    setSmartLoading(false)
  }

  // ── Bucketed task lists ────────────────────────────────────────────────────
  const sorted = (arr: Task[]) => [...arr].sort((a, b) => b.priority_score - a.priority_score)

  const overdueTasks   = sorted(tasks.filter(t => getBucket(t, today, weekDateSet) === 'overdue'))
  const todayTasks     = sorted(tasks.filter(t => getBucket(t, today, weekDateSet) === 'today'))
  const thisMonthTasks = sorted(tasks.filter(t => getBucket(t, today, weekDateSet) === 'this_month'))
  const somedayTasks   = sorted(tasks.filter(t => getBucket(t, today, weekDateSet) === 'someday'))

  function dayTasks(dateStr: string) {
    return sorted(tasks.filter(t => getBucket(t, today, weekDateSet) === `day:${dateStr}`))
  }

  // For the overlay: today's column uses the 'today' bucket
  function overlayDayTasks(dateStr: string) {
    return dateStr === today ? todayTasks : dayTasks(dateStr)
  }

  // This Week column on main board: all week days except today
  const thisWeekNonTodayTasks = sorted(
    weekDays.filter(d => d.str !== today).flatMap(d => dayTasks(d.str))
  )
  const thisWeekTotal = thisWeekNonTodayTasks.length + todayTasks.length

  const smartResults = (smartIds ?? []).map(id => tasks.find(t => t.id === id)).filter(Boolean) as Task[]

  // ── Quick-add column handler ───────────────────────────────────────────────
  function handleQuickAdd(colId: string) {
    const title = quickTitle.trim()
    if (!title) return
    if (colId === 'today') {
      addTask({ colId, title, urgency: 'today', date: today })
    } else if (colId.startsWith('day:')) {
      const dateStr = colId.slice(4)
      addTask({ colId, title, urgency: 'this_week', date: dateStr })
    } else if (colId === 'this_month') {
      addTask({ colId, title, urgency: 'this_month' })
    } else if (colId === 'someday') {
      addTask({ colId, title, urgency: 'someday' })
    } else {
      addTask({ colId, title, urgency: 'someday' })
    }
  }

  // ── Column component ───────────────────────────────────────────────────────
  function KanbanCol({ colId, label, sub, color, taskList, showDate = false, accent = false, isPast = false, wide = false }: {
    colId: string; label: string; sub: string; color: string; taskList: Task[];
    showDate?: boolean; accent?: boolean; isPast?: boolean; wide?: boolean
  }) {
    const isActive = quickColId === colId
    return (
      <div
        className="flex flex-col gap-2 group/col"
        style={{ flex: '1 1 0', minWidth: wide ? 160 : 140, opacity: isPast ? 0.55 : 1 }}
      >
        <ColHeader label={label} sub={sub} count={taskList.length} color={color} accent={accent} />
        <div className="flex flex-col gap-1.5 overflow-y-auto flex-1">
          {loading && accent ? (
            <p className="text-[10px] px-1 font-mono" style={{ color: 'var(--ink-4)' }}>…</p>
          ) : taskList.map(t => (
            <TaskCard key={t.id} task={t} showDate={showDate}
              onClick={() => openDrawer(t)}
              onComplete={() => completeTask(t.id)}
              onDelete={() => deleteTask(t.id)}
            />
          ))}
        </div>
        {/* Quick-add */}
        {isActive ? (
          <div className="flex flex-col gap-1 mt-0.5">
            <input ref={quickRef} value={quickTitle} onChange={e => setQuickTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleQuickAdd(colId)
                if (e.key === 'Escape') { setQuickColId(null); setQuickTitle('') }
              }}
              onBlur={() => { if (!quickTitle.trim()) { setQuickColId(null) } }}
              placeholder="Task title…"
              className="w-full text-xs px-2 py-1 rounded outline-none"
              style={{ background: 'var(--ink-2)', border: `1px solid ${color}`, color: 'var(--foreground)' }}
            />
            <div className="flex gap-1">
              <button onClick={() => handleQuickAdd(colId)} disabled={!quickTitle.trim()}
                className="flex-1 text-[10px] py-0.5 rounded disabled:opacity-40 font-medium"
                style={{ background: color, color: 'oklch(0.10 0.01 255)' }}>Add</button>
              <button onClick={() => { setQuickColId(null); setQuickTitle('') }}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ color: 'var(--ink-4)', background: 'var(--ink-2)' }}>✕</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setQuickColId(colId); if (colId.startsWith('day:')) setNewDate(colId.slice(4)) }}
            className="w-full text-left text-[10px] px-1 py-1 rounded opacity-0 group-hover/col:opacity-100 transition-opacity"
            style={{ color: 'var(--ink-4)' }}
          >+ Add task</button>
        )}
      </div>
    )
  }

  // ── Week Overlay ───────────────────────────────────────────────────────────
  function WeekOverlay() {
    const weekStart = weekDays[0]
    const weekEnd   = weekDays[6]
    const range     = `${weekStart.sub} – ${weekEnd.sub}`

    return (
      <>
        <style>{`
          @keyframes weekSlideUp {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0);    }
          }
          .week-overlay { animation: weekSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) both; }
        `}</style>

        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'oklch(0.04 0.01 240 / 0.72)', backdropFilter: 'blur(8px)' }}
          onClick={() => setWeekOpen(false)}
        />

        {/* Sheet */}
        <div
          className="fixed inset-x-0 bottom-0 z-50 week-overlay flex flex-col"
          style={{
            top: '52px',
            background: 'var(--background)',
            borderTop: '1px solid oklch(1 0 0 / 0.1)',
            borderRadius: '16px 16px 0 0',
            boxShadow: '0 -24px 80px oklch(0 0 0 / 0.5)',
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-8 h-1 rounded-full" style={{ background: 'oklch(1 0 0 / 0.15)' }} />
          </div>

          {/* Header */}
          <div
            className="flex items-center gap-4 px-6 py-3 shrink-0"
            style={{ borderBottom: '1px solid oklch(1 0 0 / 0.07)' }}
          >
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COL_COLORS.this_week }} />
            <div>
              <div
                className="text-[11px] font-mono font-bold uppercase tracking-widest"
                style={{ color: COL_COLORS.this_week }}
              >
                This Week
              </div>
              <div className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--ink-4)' }}>{range}</div>
            </div>

            <div className="flex-1" />

            <div className="font-mono text-[10px] tabular-nums" style={{ color: 'var(--ink-4)' }}>
              {thisWeekTotal} task{thisWeekTotal !== 1 ? 's' : ''} this week
            </div>

            <button
              onClick={() => setWeekOpen(false)}
              className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70"
              style={{ background: 'var(--ink-2)', color: 'var(--ink-4)', border: '1px solid oklch(1 0 0 / 0.08)' }}
            >
              ✕ Close
            </button>
          </div>

          {/* Day columns */}
          <div className="flex-1 flex gap-3 px-5 py-4 overflow-x-auto overflow-y-hidden">
            {weekDays.map(day => {
              const isToday  = day.str === today
              const isPast   = day.str < today
              const colColor = isToday ? COL_COLORS.today : COL_COLORS.day

              return (
                <div
                  key={day.str}
                  className="flex flex-col gap-0"
                  style={{
                    flex: '1 1 0',
                    minWidth: 168,
                    borderRadius: 10,
                    padding: isToday ? '10px' : '0 4px',
                    background: isToday
                      ? `color-mix(in oklch, ${COL_COLORS.today} 6%, transparent)`
                      : 'transparent',
                    border: isToday
                      ? `1px solid color-mix(in oklch, ${COL_COLORS.today} 20%, transparent)`
                      : '1px solid transparent',
                    opacity: isPast ? 0.5 : 1,
                  }}
                >
                  <KanbanCol
                    colId={`day:${day.str}`}
                    label={isToday ? `${day.label} · Today` : day.label}
                    sub={day.sub}
                    color={colColor}
                    taskList={overlayDayTasks(day.str)}
                    accent={isToday}
                    isPast={false}
                    wide={true}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </>
    )
  }

  // ── Header slot options ────────────────────────────────────────────────────
  const slotOptions = [
    { value: 'today',      label: 'Today' },
    { value: '',           label: 'Pick date →' },
    { value: 'this_month', label: 'This Month' },
    { value: 'someday',    label: 'Someday' },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Shell>
      {/* Week overlay — rendered at Shell root so it covers full content area */}
      {weekOpen && <WeekOverlay />}

      <div className="flex gap-4 h-[calc(100vh-64px)]">

        {/* Main area */}
        <div className="flex-1 flex flex-col gap-3 overflow-hidden min-w-0">

          {/* Header */}
          <Panel>
            <div className="flex items-center gap-3 flex-wrap">
              {/* View tabs */}
              <div className="flex gap-1">
                {(['kanban', 'smart'] as View[]).map(v => (
                  <button key={v} onClick={() => setViewPersist(v)}
                    className="px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors"
                    style={{
                      background: view === v ? 'var(--accent-dim)' : 'transparent',
                      color: view === v ? 'var(--accent)' : 'var(--ink-4)',
                    }}>{v}</button>
                ))}
              </div>

              <div className="flex-1" />

              {/* Add task form */}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                  placeholder="New task…"
                  className="text-xs px-3 py-1.5 rounded-lg outline-none w-44"
                  style={{ background: 'var(--ink-2)', border: '1px solid oklch(1 0 0 / 0.08)', color: 'var(--foreground)' }}
                />

                <select
                  value={newUrgency}
                  onChange={e => setNewUrgency(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-lg outline-none"
                  style={{ background: 'var(--ink-2)', border: '1px solid oklch(1 0 0 / 0.08)', color: 'var(--foreground)' }}
                >
                  {slotOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                {newUrgency === '' && (
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-lg outline-none"
                    style={{ background: 'var(--ink-2)', border: '1px solid oklch(1 0 0 / 0.08)', color: 'var(--foreground)' }}
                  />
                )}

                <div className="flex gap-1">
                  {PRIORITY_ORDER.filter(p => p !== 'none').map(p => (
                    <button key={p} onClick={() => setNewPriority(p)}
                      className="text-[10px] px-2 py-1 rounded font-mono font-semibold transition-all"
                      style={{
                        background: newPriority === p ? `color-mix(in oklch, ${PRIORITY_CFG[p].color} 20%, transparent)` : 'var(--ink-2)',
                        color: newPriority === p ? PRIORITY_CFG[p].color : 'var(--ink-4)',
                        border: `1px solid ${newPriority === p ? PRIORITY_CFG[p].color : 'oklch(1 0 0 / 0.08)'}`,
                      }}
                    >{PRIORITY_CFG[p].label}</button>
                  ))}
                </div>

                <button onClick={() => setNewKey(k => !k)}
                  className="text-xs px-2 py-1.5 rounded-lg transition-colors"
                  style={{
                    background: newKey ? 'oklch(0.65 0.22 20 / 0.2)' : 'var(--ink-2)',
                    color: newKey ? 'var(--danger)' : 'var(--ink-4)',
                    border: '1px solid oklch(1 0 0 / 0.08)',
                  }}>★</button>

                <button onClick={() => addTask()} disabled={adding || !newTitle.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: 'var(--ink-0)' }}>Add</button>
              </div>
            </div>
          </Panel>

          {/* ── Kanban ─────────────────────────────────────────────────────── */}
          {view === 'kanban' && (
            <div className="flex-1 overflow-hidden">
              <div className="flex w-full h-full overflow-x-auto pb-2 gap-3">

                {/* ── Overdue (conditional) ── */}
                {overdueTasks.length > 0 && (
                  <>
                    <div className="flex flex-col gap-2" style={{ flex: '1 1 0', minWidth: 140 }}>
                      <ColHeader label="Overdue" sub="Past due" count={overdueTasks.length}
                        color={COL_COLORS.overdue} />
                      <div className="flex flex-col gap-1.5 overflow-y-auto flex-1">
                        {overdueTasks.map(t => (
                          <TaskCard key={t.id} task={t} showDate
                            onClick={() => openDrawer(t)}
                            onComplete={() => completeTask(t.id)}
                            onDelete={() => deleteTask(t.id)}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="w-px shrink-0 self-stretch" style={{ background: 'oklch(1 0 0 / 0.06)' }} />
                  </>
                )}

                {/* ── Today ── */}
                <KanbanCol
                  colId="today"
                  label="Today"
                  sub={`${MONTH_NAMES[new Date().getMonth()]} ${new Date().getDate()}`}
                  color={COL_COLORS.today}
                  taskList={todayTasks}
                  accent={true}
                />

                <div className="w-px shrink-0 self-stretch" style={{ background: 'oklch(1 0 0 / 0.06)' }} />

                {/* ── This Week (clickable → expands to overlay) ── */}
                <div className="flex flex-col gap-2 group/week" style={{ flex: '1 1 0', minWidth: 140 }}>
                  {/* Clickable header */}
                  <button
                    onClick={() => setWeekOpen(true)}
                    className="w-full text-left px-1 pb-1.5 flex items-start gap-2 shrink-0 transition-opacity hover:opacity-100"
                    style={{
                      borderBottom: `1px solid color-mix(in oklch, ${COL_COLORS.this_week} 40%, transparent)`,
                      opacity: 0.85,
                    }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: COL_COLORS.this_week }} />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[11px] font-mono font-semibold uppercase tracking-widest leading-tight flex items-center gap-1"
                        style={{ color: COL_COLORS.this_week }}
                      >
                        This Week
                        <span style={{ opacity: 0.55, fontSize: 10, letterSpacing: 0 }}>↗</span>
                      </div>
                      <div className="text-[10px] font-mono leading-tight mt-0.5" style={{ color: 'var(--ink-4)' }}>
                        {weekDays[0].sub} – {weekDays[6].sub}
                      </div>
                    </div>
                    {thisWeekTotal > 0 && (
                      <span className="text-[10px] font-mono mt-0.5 shrink-0" style={{ color: 'var(--ink-4)' }}>
                        {thisWeekTotal}
                      </span>
                    )}
                  </button>

                  {/* Task list preview (non-today week tasks) */}
                  <div className="flex flex-col gap-1.5 overflow-y-auto flex-1">
                    {loading ? (
                      <p className="text-[10px] px-1 font-mono" style={{ color: 'var(--ink-4)' }}>…</p>
                    ) : thisWeekNonTodayTasks.length === 0 ? (
                      <p className="text-[10px] px-1 font-mono" style={{ color: 'var(--ink-4)', opacity: 0.5 }}>
                        No tasks
                      </p>
                    ) : thisWeekNonTodayTasks.map(t => (
                      <TaskCard key={t.id} task={t} showDate
                        onClick={() => openDrawer(t)}
                        onComplete={() => completeTask(t.id)}
                        onDelete={() => deleteTask(t.id)}
                      />
                    ))}
                  </div>

                  {/* Expand prompt */}
                  <button
                    onClick={() => setWeekOpen(true)}
                    className="w-full text-left text-[10px] px-1 py-1 rounded opacity-0 group-hover/week:opacity-100 transition-opacity"
                    style={{ color: COL_COLORS.this_week }}
                  >
                    ↗ View by day
                  </button>
                </div>

                <div className="w-px shrink-0 self-stretch" style={{ background: 'oklch(1 0 0 / 0.06)' }} />

                {/* ── This Month ── */}
                <KanbanCol
                  colId="this_month"
                  label="This Month"
                  sub="No date"
                  color={COL_COLORS.this_month}
                  taskList={thisMonthTasks}
                />

                {/* ── Someday ── */}
                <KanbanCol
                  colId="someday"
                  label="Someday"
                  sub="No date"
                  color={COL_COLORS.someday}
                  taskList={somedayTasks}
                />

              </div>
            </div>
          )}

          {/* ── Smart view ─────────────────────────────────────────────────── */}
          {view === 'smart' && (
            <div className="flex flex-col gap-4 flex-1 overflow-y-auto">
              <Panel>
                <div className="flex gap-2">
                  <input
                    value={smartQuery}
                    onChange={e => setSmartQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runSmartSearch()}
                    placeholder="What should I work on this morning? What's blocking me?"
                    className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
                    style={{ background: 'var(--ink-2)', border: '1px solid oklch(1 0 0 / 0.08)', color: 'var(--foreground)' }}
                  />
                  <button onClick={runSmartSearch} disabled={smartLoading}
                    className="text-xs px-4 py-2 rounded-lg font-medium disabled:opacity-40"
                    style={{ background: 'var(--accent)', color: 'var(--ink-0)' }}
                  >{smartLoading ? '…' : 'Ask'}</button>
                </div>
              </Panel>
              {smartIds !== null && (
                smartResults.length === 0
                  ? <p className="text-xs px-1" style={{ color: 'var(--ink-4)' }}>No matching tasks found.</p>
                  : <div className="flex flex-col gap-2">
                      {smartResults.map((task, i) => (
                        <div key={task.id} className="flex items-center gap-2">
                          <span className="font-mono text-xs w-5 text-right shrink-0" style={{ color: 'var(--accent)' }}>{i + 1}</span>
                          <div className="flex-1">
                            <TaskCard task={task} showDate
                              onClick={() => openDrawer(task)}
                              onComplete={() => completeTask(task.id)}
                              onDelete={() => deleteTask(task.id)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
              )}
            </div>
          )}

        </div>

        {/* ── Side drawer ────────────────────────────────────────────────────── */}
        {selected && (
          <div className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto">
            <Panel className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-widest" style={{ color: 'var(--ink-4)' }}>
                  Edit Task
                </span>
                <button onClick={() => setSelected(null)} style={{ color: 'var(--ink-4)' }}>✕</button>
              </div>

              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                className="w-full text-sm px-2 py-1.5 rounded outline-none font-medium"
                style={{ background: 'var(--ink-2)', color: 'var(--foreground)', border: '1px solid oklch(1 0 0 / 0.08)' }}
              />

              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                placeholder="Description…" rows={3}
                className="w-full text-xs px-2 py-1.5 rounded outline-none resize-none"
                style={{ background: 'var(--ink-2)', color: 'var(--foreground)', border: '1px solid oklch(1 0 0 / 0.08)' }}
              />

              {/* Priority */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--ink-4)' }}>Priority</label>
                <div className="grid grid-cols-4 gap-1">
                  {PRIORITY_ORDER.map(p => {
                    const cfg = PRIORITY_CFG[p]; const active = editPriority === p
                    return (
                      <button key={p} onClick={() => setEditPriority(p)}
                        className="text-[10px] py-1.5 rounded font-mono font-semibold transition-all"
                        style={{
                          background: active ? `color-mix(in oklch, ${cfg.color} 20%, transparent)` : 'var(--ink-2)',
                          color: active ? cfg.color : 'var(--ink-4)',
                          border: `1px solid ${active ? cfg.color : 'oklch(1 0 0 / 0.06)'}`,
                        }}>{cfg.label}</button>
                    )
                  })}
                </div>
              </div>

              {/* Column slot */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--ink-4)' }}>Column</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'today',      label: 'Today' },
                    { id: 'this_month', label: 'This Month' },
                    { id: 'someday',    label: 'Someday' },
                  ].map(slot => {
                    const active = editUrgency === slot.id && !editDate
                    return (
                      <button key={slot.id} onClick={() => { setEditUrgency(slot.id); setEditDate('') }}
                        className="text-[10px] py-1.5 rounded font-mono transition-all"
                        style={{
                          background: active ? 'oklch(0.72 0.18 240 / 0.15)' : 'var(--ink-2)',
                          color: active ? 'var(--accent)' : 'var(--ink-4)',
                          border: `1px solid ${active ? 'var(--accent)' : 'oklch(1 0 0 / 0.06)'}`,
                        }}>{slot.label}</button>
                    )
                  })}
                </div>
              </div>

              {/* Due date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--ink-4)' }}>
                  Specific Date
                </label>
                <input type="date" value={editDate}
                  onChange={e => { setEditDate(e.target.value); if (e.target.value) setEditUrgency('') }}
                  className="w-full text-xs px-2 py-1.5 rounded outline-none"
                  style={{ background: 'var(--ink-2)', color: 'var(--foreground)', border: '1px solid oklch(1 0 0 / 0.08)' }}
                />
                {editDate && (
                  <button onClick={() => setEditDate('')}
                    className="text-[10px] text-left opacity-60 hover:opacity-100"
                    style={{ color: 'var(--ink-4)' }}>Clear date</button>
                )}
              </div>

              {/* Key task */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div onClick={() => setEditKey(k => !k)}
                  className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                  style={{ background: editKey ? 'var(--danger)' : 'transparent', borderColor: editKey ? 'var(--danger)' : 'oklch(1 0 0 / 0.2)' }}
                >
                  {editKey && <span className="text-[10px] leading-none" style={{ color: 'oklch(0.10 0 0)' }}>★</span>}
                </div>
                <span className="text-xs" style={{ color: 'var(--ink-4)' }}>Mark as key task</span>
              </label>

              {/* Actions */}
              <div className="flex gap-2 mt-auto pt-1">
                <button onClick={saveDrawer} disabled={saving}
                  className="flex-1 py-1.5 rounded text-xs font-medium disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: 'var(--ink-0)' }}>{saving ? '…' : 'Save'}</button>
                <button onClick={() => completeTask(selected.id)}
                  className="flex-1 py-1.5 rounded text-xs"
                  style={{ background: 'oklch(0.72 0.18 145 / 0.15)', color: 'var(--ok)' }}>✓ Done</button>
                <button onClick={() => deleteTask(selected.id)}
                  className="py-1.5 px-2 rounded text-xs"
                  style={{ background: 'oklch(0.65 0.22 20 / 0.15)', color: 'var(--danger)' }}>🗑</button>
              </div>
            </Panel>
          </div>
        )}

      </div>
    </Shell>
  )
}

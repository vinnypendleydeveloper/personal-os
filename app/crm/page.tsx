'use client'

import { useEffect, useState, useRef } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'

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

const PRIORITY_CFG: Record<Priority, { label: string; color: string; score: number }> = {
  high:   { label: 'HIGH', color: 'oklch(0.65 0.22 20)',  score: 100 },
  medium: { label: 'MED',  color: 'oklch(0.75 0.18 65)',  score: 50  },
  low:    { label: 'LOW',  color: 'oklch(0.70 0.16 250)', score: 10  },
  none:   { label: '—',    color: 'var(--ink-4)',          score: 0   },
}

const PRIORITY_ORDER: Priority[] = ['high', 'medium', 'low', 'none']

function scoreToPriority(score: number): Priority {
  if (score >= 75) return 'high'
  if (score >= 25) return 'medium'
  if (score >= 1)  return 'low'
  return 'none'
}

function localDateStr(d: Date): string {
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD
}

function todayStr(): string {
  return localDateStr(new Date())
}

function getWeekCols(): { str: string; label: string; sub: string }[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dow = today.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(today)
  monday.setDate(today.getDate() + offset)

  const DAY  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const MON  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return {
      str:   localDateStr(d),
      label: DAY[i],
      sub:   `${MON[d.getMonth()]} ${d.getDate()}`,
    }
  })
}

function fmtDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${MON[m - 1]} ${d}`
}

function Chip({ label, color, filled = false }: { label: string; color: string; filled?: boolean }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
      padding: '1px 5px', borderRadius: 4, lineHeight: 1.4, whiteSpace: 'nowrap',
      color: filled ? 'oklch(0.10 0.01 255)' : color,
      background: filled ? color : `color-mix(in oklch, ${color} 14%, transparent)`,
      border: `1px solid color-mix(in oklch, ${color} 32%, transparent)`,
    }}>{label}</span>
  )
}

// ── Task card ──────────────────────────────────────────────────────────────

function TaskCard({ task, onClick, onComplete, onDelete, showDate = false }: {
  task: Task
  onClick: () => void
  onComplete: () => void
  onDelete: () => void
  showDate?: boolean
}) {
  const p = scoreToPriority(task.priority_score)
  const pCfg = PRIORITY_CFG[p]
  const today = todayStr()
  const overdue = !!(task.due_date && task.due_date < today)

  return (
    <div
      onClick={onClick}
      className="panel cursor-pointer group transition-all"
      style={{
        padding: '8px 10px',
        borderLeftWidth: 2,
        borderLeftColor: p !== 'none' ? pCfg.color : 'transparent',
      }}
    >
      <div className="flex items-start gap-1.5">
        {task.key && (
          <span className="text-[10px] mt-0.5 shrink-0 leading-none" style={{ color: 'var(--danger)' }}>★</span>
        )}
        <p className="text-xs flex-1 leading-relaxed line-clamp-2" style={{ color: 'var(--foreground)' }}>
          {task.title}
        </p>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
          <button
            onClick={e => { e.stopPropagation(); onComplete() }}
            className="text-[10px] px-1 py-0.5 rounded leading-none"
            style={{ color: 'var(--ok)', background: 'oklch(0.72 0.18 145 / 0.15)' }}
          >✓</button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="text-[10px] px-1 py-0.5 rounded leading-none"
            style={{ color: 'var(--danger)', background: 'oklch(0.65 0.22 20 / 0.15)' }}
          >✕</button>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex gap-1 mt-1.5 flex-wrap items-center">
        {p !== 'none' && (
          <Chip label={pCfg.label} color={pCfg.color} filled={p === 'high'} />
        )}
        {showDate && task.due_date && (
          <Chip
            label={overdue ? `OVERDUE ${fmtDate(task.due_date)}` : fmtDate(task.due_date)}
            color={overdue ? 'var(--danger)' : 'var(--ink-4)'}
            filled={overdue}
          />
        )}
        {task.time_estimate_min != null && (
          <span className="font-mono" style={{ fontSize: 9, color: 'var(--ink-4)' }}>
            ~{task.time_estimate_min}m
          </span>
        )}
        {(task.tags ?? []).filter(t => !t.startsWith('@')).map(tag => (
          <span key={tag} className="font-mono" style={{ fontSize: 9, color: 'var(--ink-4)' }}>
            #{tag}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function CRMPage() {
  const [tasks, setTasks]   = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('pos-crm-view') as View) ?? 'kanban'
    }
    return 'kanban'
  })

  const weekCols = getWeekCols()
  const today    = todayStr()
  const monday   = weekCols[0].str
  const sunday   = weekCols[6].str

  // Header add-task form
  const [newTitle,    setNewTitle]    = useState('')
  const [newPriority, setNewPriority] = useState<Priority>('medium')
  const [newDate,     setNewDate]     = useState(today)
  const [newKey,      setNewKey]      = useState(false)
  const [adding,      setAdding]      = useState(false)

  // Per-column quick-add
  const [quickCol,   setQuickCol]   = useState<string | null>(null)
  const [quickTitle, setQuickTitle] = useState('')
  const quickRef = useRef<HTMLInputElement>(null)

  // Drawer
  const [selected,      setSelected]      = useState<Task | null>(null)
  const [editTitle,     setEditTitle]      = useState('')
  const [editDesc,      setEditDesc]       = useState('')
  const [editPriority,  setEditPriority]   = useState<Priority>('none')
  const [editDate,      setEditDate]       = useState('')
  const [editKey,       setEditKey]        = useState(false)
  const [saving,        setSaving]         = useState(false)

  // Smart view
  const [smartQuery,   setSmartQuery]   = useState('')
  const [smartIds,     setSmartIds]     = useState<string[] | null>(null)
  const [smartLoading, setSmartLoading] = useState(false)

  const dirtyRef = useRef(false)

  useEffect(() => { fetchTasks() }, [])

  useEffect(() => {
    if (quickCol) setTimeout(() => quickRef.current?.focus(), 40)
  }, [quickCol])

  async function fetchTasks() {
    const res = await fetch('/api/tasks?status=open')
    const { tasks: data } = await res.json()
    if (!dirtyRef.current) setTasks(data ?? [])
    setLoading(false)
  }

  function setViewPersist(v: View) {
    setView(v)
    localStorage.setItem('pos-crm-view', v)
  }

  async function addTask(opts?: { date?: string; title?: string }) {
    const title = (opts?.title ?? newTitle).trim()
    if (!title) return
    setAdding(true)
    dirtyRef.current = true

    const priority = opts?.date ? 'medium' : newPriority
    const dueDate  = opts?.date ?? newDate ?? null

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        urgency: 'someday',
        key: opts?.date ? false : newKey,
        priority_score: PRIORITY_CFG[priority].score,
        due_date: dueDate || null,
      }),
    })
    const { task } = await res.json()
    setTasks(prev => [task, ...prev])

    if (opts?.date) {
      setQuickTitle('')
      setQuickCol(null)
    } else {
      setNewTitle('')
      setNewKey(false)
    }
    setAdding(false)
  }

  async function completeTask(id: string) {
    dirtyRef.current = true
    setTasks(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
    setEditKey(task.key)
  }

  async function saveDrawer() {
    if (!selected) return
    setSaving(true)
    dirtyRef.current = true
    const pScore = PRIORITY_CFG[editPriority].score
    const updated: Task = {
      ...selected,
      title: editTitle,
      description: editDesc,
      priority_score: pScore,
      due_date: editDate || null,
      key: editKey,
    }
    setTasks(prev => prev.map(t => t.id === selected.id ? updated : t))
    setSelected(updated)
    await fetch(`/api/tasks/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editTitle,
        description: editDesc,
        priority_score: pScore,
        due_date: editDate || null,
        key: editKey,
      }),
    })
    setSaving(false)
  }

  async function runSmartSearch() {
    if (!smartQuery.trim()) return
    setSmartLoading(true)
    const res = await fetch('/api/tasks/smart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: smartQuery }),
    })
    const data = await res.json()
    setSmartIds(data.ids ?? [])
    setSmartLoading(false)
  }

  // Column bucketing
  function colTasks(dateStr: string) {
    return tasks
      .filter(t => t.due_date === dateStr)
      .sort((a, b) => b.priority_score - a.priority_score)
  }

  const overdueTasks = tasks
    .filter(t => t.due_date && t.due_date < monday)
    .sort((a, b) => b.priority_score - a.priority_score)

  const backlogTasks = tasks
    .filter(t => !t.due_date || t.due_date > sunday)
    .sort((a, b) => b.priority_score - a.priority_score)

  const smartResults = (smartIds ?? [])
    .map(id => tasks.find(t => t.id === id))
    .filter(Boolean) as Task[]

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Shell>
      <div className="flex gap-4 h-[calc(100vh-64px)]">

        {/* Main area */}
        <div className="flex-1 flex flex-col gap-3 overflow-hidden min-w-0">

          {/* Header panel */}
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
                    }}
                  >{v}</button>
                ))}
              </div>

              <div className="flex-1" />

              {/* Add task row */}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                  placeholder="New task…"
                  className="text-xs px-3 py-1.5 rounded-lg outline-none w-44"
                  style={{ background: 'var(--ink-2)', border: '1px solid oklch(1 0 0 / 0.08)', color: 'var(--foreground)' }}
                />

                {/* Priority picker */}
                <div className="flex gap-1">
                  {PRIORITY_ORDER.filter(p => p !== 'none').map(p => (
                    <button key={p} onClick={() => setNewPriority(p)}
                      className="text-[10px] px-2 py-1 rounded font-mono font-semibold transition-all"
                      style={{
                        background: newPriority === p
                          ? `color-mix(in oklch, ${PRIORITY_CFG[p].color} 20%, transparent)`
                          : 'var(--ink-2)',
                        color: newPriority === p ? PRIORITY_CFG[p].color : 'var(--ink-4)',
                        border: `1px solid ${newPriority === p ? PRIORITY_CFG[p].color : 'oklch(1 0 0 / 0.08)'}`,
                      }}
                    >{PRIORITY_CFG[p].label}</button>
                  ))}
                </div>

                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-lg outline-none"
                  style={{ background: 'var(--ink-2)', border: '1px solid oklch(1 0 0 / 0.08)', color: 'var(--foreground)' }}
                />

                <button onClick={() => setNewKey(k => !k)}
                  className="text-xs px-2 py-1.5 rounded-lg transition-colors"
                  style={{
                    background: newKey ? 'oklch(0.65 0.22 20 / 0.2)' : 'var(--ink-2)',
                    color: newKey ? 'var(--danger)' : 'var(--ink-4)',
                    border: '1px solid oklch(1 0 0 / 0.08)',
                  }}
                >★</button>

                <button onClick={() => addTask()} disabled={adding || !newTitle.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: 'var(--ink-0)' }}
                >Add</button>
              </div>
            </div>
          </Panel>

          {/* ── Kanban view ─────────────────────────────────────────────── */}
          {view === 'kanban' && (
            <div className="flex-1 overflow-hidden">
              <div className="flex gap-2.5 h-full overflow-x-auto pb-2">

                {/* Overdue column — only appears when there are overdue tasks */}
                {overdueTasks.length > 0 && (
                  <div className="w-44 shrink-0 flex flex-col gap-2">
                    <ColHeader label="Overdue" sub="Past due" count={overdueTasks.length} color="oklch(0.65 0.22 20)" />
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
                )}

                {/* Day columns — Mon through Sun */}
                {weekCols.map(col => {
                  const isToday = col.str === today
                  const isPast  = col.str < today
                  const tasks   = colTasks(col.str)

                  return (
                    <div key={col.str} className="w-44 shrink-0 flex flex-col gap-2 group/col">

                      {/* Column header */}
                      <div
                        className="px-1 pb-1.5 flex items-start gap-2"
                        style={{
                          borderBottom: `1px solid ${isToday
                            ? 'color-mix(in oklch, var(--accent) 60%, transparent)'
                            : 'oklch(1 0 0 / 0.08)'}`,
                          opacity: isPast && !isToday ? 0.5 : 1,
                        }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full mt-1 shrink-0"
                          style={{ background: isToday ? 'var(--accent)' : 'var(--ink-4)' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-[11px] font-mono font-semibold uppercase tracking-widest leading-tight"
                            style={{ color: isToday ? 'var(--accent)' : 'var(--foreground)' }}
                          >
                            {col.label}
                            {isToday && <span className="ml-1.5 text-[9px] opacity-70">TODAY</span>}
                          </div>
                          <div className="text-[10px] font-mono leading-tight mt-0.5" style={{ color: 'var(--ink-4)' }}>
                            {col.sub}
                          </div>
                        </div>
                        {tasks.length > 0 && (
                          <span className="text-[10px] font-mono mt-0.5 shrink-0" style={{ color: 'var(--ink-4)' }}>
                            {tasks.length}
                          </span>
                        )}
                      </div>

                      {/* Task list */}
                      <div className="flex flex-col gap-1.5 overflow-y-auto flex-1">
                        {loading && isToday ? (
                          <p className="text-xs px-1" style={{ color: 'var(--ink-4)' }}>…</p>
                        ) : tasks.map(t => (
                          <TaskCard key={t.id} task={t}
                            onClick={() => openDrawer(t)}
                            onComplete={() => completeTask(t.id)}
                            onDelete={() => deleteTask(t.id)}
                          />
                        ))}
                      </div>

                      {/* Quick-add */}
                      {quickCol === col.str ? (
                        <div className="flex flex-col gap-1 mt-1">
                          <input
                            ref={quickRef}
                            value={quickTitle}
                            onChange={e => setQuickTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') addTask({ date: col.str, title: quickTitle })
                              if (e.key === 'Escape') { setQuickCol(null); setQuickTitle('') }
                            }}
                            onBlur={() => { if (!quickTitle.trim()) { setQuickCol(null) } }}
                            placeholder="Task title…"
                            className="w-full text-xs px-2 py-1 rounded outline-none"
                            style={{
                              background: 'var(--ink-2)',
                              border: '1px solid var(--accent)',
                              color: 'var(--foreground)',
                            }}
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={() => addTask({ date: col.str, title: quickTitle })}
                              disabled={!quickTitle.trim()}
                              className="flex-1 text-[10px] py-0.5 rounded disabled:opacity-40 font-medium"
                              style={{ background: 'var(--accent)', color: 'var(--ink-0)' }}
                            >Add</button>
                            <button
                              onClick={() => { setQuickCol(null); setQuickTitle('') }}
                              className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{ color: 'var(--ink-4)', background: 'var(--ink-2)' }}
                            >✕</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setQuickCol(col.str); setNewDate(col.str) }}
                          className="w-full text-left text-[10px] px-1 py-1 rounded transition-all opacity-0 group-hover/col:opacity-100"
                          style={{ color: 'var(--ink-4)' }}
                        >+ Add task</button>
                      )}
                    </div>
                  )
                })}

                {/* Backlog column — tasks with no date or dates beyond this week */}
                <div className="w-44 shrink-0 flex flex-col gap-2">
                  <ColHeader
                    label="Backlog"
                    sub="No date"
                    count={backlogTasks.length}
                    color="var(--ink-4)"
                  />
                  <div className="flex flex-col gap-1.5 overflow-y-auto flex-1">
                    {backlogTasks.map(t => (
                      <TaskCard key={t.id} task={t} showDate={!!t.due_date}
                        onClick={() => openDrawer(t)}
                        onComplete={() => completeTask(t.id)}
                        onDelete={() => deleteTask(t.id)}
                      />
                    ))}
                    {!loading && backlogTasks.length === 0 && (
                      <p className="text-[10px] px-1 font-mono" style={{ color: 'var(--ink-4)' }}>Empty</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── Smart view ──────────────────────────────────────────────── */}
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
                          <span className="font-mono text-xs w-5 text-right shrink-0" style={{ color: 'var(--accent)' }}>
                            {i + 1}
                          </span>
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

        {/* ── Side drawer ─────────────────────────────────────────────────── */}
        {selected && (
          <div className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto">
            <Panel className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-widest" style={{ color: 'var(--ink-4)' }}>
                  Edit Task
                </span>
                <button onClick={() => setSelected(null)} style={{ color: 'var(--ink-4)' }}>✕</button>
              </div>

              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full text-sm px-2 py-1.5 rounded outline-none font-medium"
                style={{ background: 'var(--ink-2)', color: 'var(--foreground)', border: '1px solid oklch(1 0 0 / 0.08)' }}
              />

              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                placeholder="Description…"
                rows={3}
                className="w-full text-xs px-2 py-1.5 rounded outline-none resize-none"
                style={{ background: 'var(--ink-2)', color: 'var(--foreground)', border: '1px solid oklch(1 0 0 / 0.08)' }}
              />

              {/* Priority */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--ink-4)' }}>
                  Priority
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {PRIORITY_ORDER.map(p => {
                    const cfg = PRIORITY_CFG[p]
                    const active = editPriority === p
                    return (
                      <button key={p} onClick={() => setEditPriority(p)}
                        className="text-[10px] py-1.5 rounded font-mono font-semibold transition-all"
                        style={{
                          background: active ? `color-mix(in oklch, ${cfg.color} 20%, transparent)` : 'var(--ink-2)',
                          color: active ? cfg.color : 'var(--ink-4)',
                          border: `1px solid ${active ? cfg.color : 'oklch(1 0 0 / 0.06)'}`,
                        }}
                      >{cfg.label}</button>
                    )
                  })}
                </div>
              </div>

              {/* Due date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--ink-4)' }}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded outline-none"
                  style={{ background: 'var(--ink-2)', color: 'var(--foreground)', border: '1px solid oklch(1 0 0 / 0.08)' }}
                />
                {editDate && (
                  <button
                    onClick={() => setEditDate('')}
                    className="text-[10px] text-left opacity-60 hover:opacity-100"
                    style={{ color: 'var(--ink-4)' }}
                  >
                    Clear → move to backlog
                  </button>
                )}
              </div>

              {/* Key task */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setEditKey(k => !k)}
                  className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                  style={{
                    background: editKey ? 'var(--danger)' : 'transparent',
                    borderColor: editKey ? 'var(--danger)' : 'oklch(1 0 0 / 0.2)',
                  }}
                >
                  {editKey && <span className="text-[10px] leading-none" style={{ color: 'oklch(0.10 0 0)' }}>★</span>}
                </div>
                <span className="text-xs" style={{ color: 'var(--ink-4)' }}>Mark as key task</span>
              </label>

              {/* Actions */}
              <div className="flex gap-2 mt-auto pt-1">
                <button
                  onClick={saveDrawer}
                  disabled={saving}
                  className="flex-1 py-1.5 rounded text-xs font-medium disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: 'var(--ink-0)' }}
                >{saving ? '…' : 'Save'}</button>
                <button
                  onClick={() => completeTask(selected.id)}
                  className="flex-1 py-1.5 rounded text-xs"
                  style={{ background: 'oklch(0.72 0.18 145 / 0.15)', color: 'var(--ok)' }}
                >✓ Done</button>
                <button
                  onClick={() => deleteTask(selected.id)}
                  className="py-1.5 px-2 rounded text-xs"
                  style={{ background: 'oklch(0.65 0.22 20 / 0.15)', color: 'var(--danger)' }}
                >🗑</button>
              </div>
            </Panel>
          </div>
        )}

      </div>
    </Shell>
  )
}

// ── Column header component ────────────────────────────────────────────────

function ColHeader({ label, sub, count, color }: {
  label: string
  sub: string
  count: number
  color: string
}) {
  return (
    <div
      className="px-1 pb-1.5 flex items-start gap-2"
      style={{ borderBottom: `1px solid color-mix(in oklch, ${color} 35%, transparent)` }}
    >
      <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div
          className="text-[11px] font-mono font-semibold uppercase tracking-widest leading-tight"
          style={{ color }}
        >{label}</div>
        <div className="text-[10px] font-mono leading-tight mt-0.5" style={{ color: 'var(--ink-4)' }}>{sub}</div>
      </div>
      {count > 0 && (
        <span className="text-[10px] font-mono mt-0.5 shrink-0" style={{ color: 'var(--ink-4)' }}>{count}</span>
      )}
    </div>
  )
}

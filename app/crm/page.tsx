'use client'

import { useEffect, useState, useRef } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'

type Urgency = 'today' | 'this_week' | 'this_month' | 'someday'
type DisplayTier = 'overdue' | 'today' | 'this_week' | 'this_month' | 'someday'
type View = 'kanban' | 'smart'

interface Task {
  id: string
  title: string
  description: string | null
  urgency: Urgency
  key: boolean
  priority_score: number
  time_estimate_min: number | null
  tags: string[]
  due_date: string | null
  completed_at: string | null
}

const TIERS: { key: DisplayTier; label: string; color: string }[] = [
  { key: 'overdue',    label: 'Overdue',    color: 'oklch(0.55 0.22 20)' },
  { key: 'today',      label: 'Today',      color: 'var(--danger)' },
  { key: 'this_week',  label: 'This Week',  color: 'var(--warn)' },
  { key: 'this_month', label: 'This Month', color: 'var(--accent)' },
  { key: 'someday',    label: 'Someday',    color: 'var(--ink-4)' },
]

const URGENCY_LABELS: Record<Urgency, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
  someday: 'Someday',
}

function isOverdue(task: Task) {
  if (!task.due_date) return false
  return new Date(task.due_date) < new Date(new Date().toDateString())
}

export default function CRMPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('pos-crm-view') as View) ?? 'kanban'
    }
    return 'kanban'
  })

  // New task form
  const [newTitle, setNewTitle] = useState('')
  const [newUrgency, setNewUrgency] = useState<Urgency>('this_week')
  const [newKey, setNewKey] = useState(false)
  const [adding, setAdding] = useState(false)

  // Drawer
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editUrgency, setEditUrgency] = useState<Urgency>('someday')
  const [editKey, setEditKey] = useState(false)

  // Smart search
  const [smartQuery, setSmartQuery] = useState('')
  const [smartIds, setSmartIds] = useState<string[] | null>(null)
  const [smartLoading, setSmartLoading] = useState(false)

  const dirtyRef = useRef(false)

  useEffect(() => {
    fetchTasks()
  }, [])

  async function fetchTasks() {
    const res = await fetch('/api/tasks?status=open')
    const data = await res.json()
    if (!dirtyRef.current) {
      setTasks(data.tasks ?? [])
    }
    setLoading(false)
  }

  function setViewPersist(v: View) {
    setView(v)
    localStorage.setItem('pos-crm-view', v)
  }

  async function addTask() {
    if (!newTitle.trim()) return
    setAdding(true)
    dirtyRef.current = true

    const topScore = tasks
      .filter(t => t.urgency === newUrgency)
      .reduce((max, t) => Math.max(max, t.priority_score), 0)

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        urgency: newUrgency,
        key: newKey,
        priority_score: topScore + 1,
      }),
    })
    const data = await res.json()
    setTasks(prev => [data.task, ...prev])
    setNewTitle('')
    setNewKey(false)
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
    if (selectedTask?.id === id) setSelectedTask(null)
  }

  async function deleteTask(id: string) {
    dirtyRef.current = true
    setTasks(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (selectedTask?.id === id) setSelectedTask(null)
  }

  function openDrawer(task: Task) {
    setSelectedTask(task)
    setEditTitle(task.title)
    setEditDesc(task.description ?? '')
    setEditUrgency(task.urgency)
    setEditKey(task.key)
  }

  async function saveDrawer() {
    if (!selectedTask) return
    dirtyRef.current = true
    const updated = { ...selectedTask, title: editTitle, description: editDesc, urgency: editUrgency, key: editKey }
    setTasks(prev => prev.map(t => t.id === selectedTask.id ? updated : t))
    setSelectedTask(updated)
    await fetch(`/api/tasks/${selectedTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, description: editDesc, urgency: editUrgency, key: editKey }),
    })
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

  const byTier = (tier: DisplayTier) => {
    if (tier === 'overdue') return tasks.filter(t => isOverdue(t)).sort((a, b) => b.priority_score - a.priority_score)
    return tasks.filter(t => t.urgency === tier && !isOverdue(t)).sort((a, b) => b.priority_score - a.priority_score)
  }

  const smartResults = smartIds
    ? smartIds.map(id => tasks.find(t => t.id === id)).filter(Boolean) as Task[]
    : []

  return (
    <Shell>
      <div className="flex gap-4 h-[calc(100vh-64px)]">
        {/* Main CRM area */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Header + add task */}
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

              {/* Add task */}
              <div className="flex items-center gap-2">
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                  placeholder="New task…"
                  className="text-xs px-3 py-1.5 rounded-lg outline-none w-48"
                  style={{ background: 'var(--ink-2)', border: '1px solid oklch(1 0 0 / 0.08)', color: 'var(--foreground)' }}
                />
                <select value={newUrgency} onChange={e => setNewUrgency(e.target.value as Urgency)}
                  className="text-xs px-2 py-1.5 rounded-lg outline-none"
                  style={{ background: 'var(--ink-2)', border: '1px solid oklch(1 0 0 / 0.08)', color: 'var(--foreground)' }}
                >
                  {TIERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <button onClick={() => setNewKey(k => !k)}
                  className="text-xs px-2 py-1.5 rounded-lg transition-colors"
                  style={{ background: newKey ? 'oklch(0.65 0.22 20 / 0.2)' : 'var(--ink-2)', color: newKey ? 'var(--danger)' : 'var(--ink-4)', border: '1px solid oklch(1 0 0 / 0.08)' }}
                >★ Key</button>
                <button onClick={addTask} disabled={adding || !newTitle.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: 'var(--ink-0)' }}
                >Add</button>
              </div>
            </div>
          </Panel>

          {/* Views */}
          {view === 'kanban' && (
            <div className="grid grid-cols-5 gap-3 flex-1 overflow-hidden">
              {TIERS.map(tier => (
                <div key={tier.key} className="flex flex-col gap-2 overflow-hidden">
                  {/* Tier header */}
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: tier.color }} />
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-widest" style={{ color: tier.color }}>
                      {tier.label}
                    </span>
                    <span className="text-[10px] font-mono ml-auto" style={{ color: 'var(--ink-4)' }}>
                      {byTier(tier.key).length}
                    </span>
                  </div>

                  {/* Tasks */}
                  <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-1">
                    {loading ? (
                      <div className="text-xs" style={{ color: 'var(--ink-4)' }}>Loading…</div>
                    ) : byTier(tier.key).map(task => (
                      <TaskCard key={task.id} task={task} tierColor={tier.color}
                        onClick={() => openDrawer(task)}
                        onComplete={() => completeTask(task.id)}
                        onDelete={() => deleteTask(task.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

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
                            <TaskCard task={task}
                              tierColor={TIERS.find(t => t.key === task.urgency)?.color ?? 'var(--ink-4)'}
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

        {/* Side drawer */}
        {selectedTask && (
          <div className="w-72 flex flex-col gap-3 overflow-y-auto">
            <Panel className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-widest" style={{ color: 'var(--ink-4)' }}>Edit Task</span>
                <button onClick={() => setSelectedTask(null)} className="text-xs" style={{ color: 'var(--ink-4)' }}>✕</button>
              </div>

              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                className="w-full text-sm px-2 py-1.5 rounded outline-none font-medium"
                style={{ background: 'var(--ink-2)', color: 'var(--foreground)', border: '1px solid oklch(1 0 0 / 0.08)' }}
              />

              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                placeholder="Description…" rows={4}
                className="w-full text-xs px-2 py-1.5 rounded outline-none resize-none"
                style={{ background: 'var(--ink-2)', color: 'var(--foreground)', border: '1px solid oklch(1 0 0 / 0.08)' }}
              />

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--ink-4)' }}>Urgency</label>
                <div className="grid grid-cols-2 gap-1">
                  {TIERS.filter(t => t.key !== 'overdue').map(t => (
                    <button key={t.key} onClick={() => setEditUrgency(t.key as Urgency)}
                      className="text-xs py-1 rounded transition-colors"
                      style={{
                        background: editUrgency === t.key ? `${t.color}22` : 'var(--ink-2)',
                        color: editUrgency === t.key ? t.color : 'var(--ink-4)',
                        border: `1px solid ${editUrgency === t.key ? t.color : 'oklch(1 0 0 / 0.06)'}`,
                      }}
                    >{t.label}</button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setEditKey(k => !k)}
                  className="w-4 h-4 rounded border flex items-center justify-center"
                  style={{ background: editKey ? 'var(--danger)' : 'transparent', borderColor: editKey ? 'var(--danger)' : 'oklch(1 0 0 / 0.2)' }}
                >
                  {editKey && <span className="text-[10px] text-black">★</span>}
                </div>
                <span className="text-xs" style={{ color: 'var(--ink-4)' }}>Mark as key task</span>
              </label>

              <div className="flex gap-2 mt-auto">
                <button onClick={saveDrawer}
                  className="flex-1 py-1.5 rounded text-xs font-medium"
                  style={{ background: 'var(--accent)', color: 'var(--ink-0)' }}
                >Save</button>
                <button onClick={() => completeTask(selectedTask.id)}
                  className="flex-1 py-1.5 rounded text-xs"
                  style={{ background: 'oklch(0.72 0.18 145 / 0.15)', color: 'var(--ok)' }}
                >✓ Done</button>
                <button onClick={() => deleteTask(selectedTask.id)}
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

function TaskCard({ task, tierColor, onClick, onComplete, onDelete }: {
  task: Task
  tierColor: string
  onClick: () => void
  onComplete: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="panel p-2.5 cursor-pointer group hover:border-white/10 transition-colors"
      style={{ borderColor: 'oklch(1 0 0 / 0.05)' }}
    >
      <div className="flex items-start gap-1.5">
        {task.key && <span className="text-[10px] mt-0.5 shrink-0" style={{ color: 'var(--danger)' }}>★</span>}
        <p className="text-xs flex-1 leading-relaxed" style={{ color: 'var(--foreground)' }}>{task.title}</p>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={e => { e.stopPropagation(); onComplete() }}
            className="text-[10px] px-1 py-0.5 rounded"
            style={{ color: 'var(--ok)', background: 'oklch(0.72 0.18 145 / 0.15)' }}
          >✓</button>
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="text-[10px] px-1 py-0.5 rounded"
            style={{ color: 'var(--danger)', background: 'oklch(0.65 0.22 20 / 0.15)' }}
          >✕</button>
        </div>
      </div>
      {(task.tags?.length > 0 || task.time_estimate_min) && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {task.time_estimate_min && (
            <span className="font-mono text-[10px] px-1 rounded" style={{ background: 'var(--ink-2)', color: 'var(--ink-4)' }}>
              ~{task.time_estimate_min}m
            </span>
          )}
          {task.tags?.map(tag => (
            <span key={tag} className="text-[10px] px-1 rounded" style={{ background: 'var(--ink-2)', color: tierColor }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

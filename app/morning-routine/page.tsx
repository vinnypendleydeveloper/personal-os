'use client'

import { useEffect, useState, useRef, useCallback, DragEvent, KeyboardEvent } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'

interface CalEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  location?: string
  tag?: string
}

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
    <Panel index={1} title="Today's Schedule" action={
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
                    <p className="text-xs font-medium" style={{ color: isNow ? 'var(--fg)' : 'var(--fg)' }}>
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

function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function WeightInput({ onSaved }: { onSaved: (logged: boolean) => void }) {
  const today = localDate()
  const [saved, setSaved] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Stable ref so useEffect doesn't re-run when parent re-renders
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
    <Panel index={0} title="Weight" action={
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
        <p className="font-mono text-[10px]" style={{ color: 'var(--hot)' }}>
          {error}
        </p>
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
    // optimistic
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

  // ── Drag and drop reorder ──
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
  // Weight is a required step — counts as 1 of N+1 in the progress bar
  const progressCompleted = completedItems + (weightLogged ? 1 : 0)
  const progressTotal = totalItems + 1
  const pct = progressTotal ? Math.round((progressCompleted / progressTotal) * 100) : 0
  const allDone = weightLogged && totalItems > 0 && completedItems === totalItems

  return (
    <Shell>
      <div className="flex flex-col gap-4" style={{ maxWidth: 640, margin: '0 auto' }}>

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

        <Panel index={2} title="Today" status={allDone ? 'online' : 'none'} action={
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
                    {/* Drag handle */}
                    <span className="shrink-0 select-none opacity-30 group-hover:opacity-60 transition-opacity" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-3)', cursor: 'grab' }}>
                      ⠿
                    </span>

                    {/* Index */}
                    <span className="shrink-0 w-4 text-right tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)' }}>
                      {idx + 1}
                    </span>

                    {/* Checkbox */}
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

                    {/* Label (click to rename) */}
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

                    {/* Completion timestamp */}
                    {done && (
                      <span className="shrink-0 tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ok)' }}>
                        {new Date(done).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}

                    {/* Delete */}
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

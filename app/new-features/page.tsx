'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'

const CATEGORIES = ['feature', 'bug', 'improvement', 'design', 'infra'] as const
const EFFORTS = ['xs', 'sm', 'md', 'lg', 'xl'] as const
const PRIORITIES = ['High', 'Medium', 'Low'] as const

interface Feature {
  id: string
  title: string
  notes: string | null
  when_to_add: string | null
  created_at: string
  sort_order: number
  is_expanded: boolean
  category: string | null
  effort: string | null
  priority: string | null
}

interface Suggestion {
  priority: 'High' | 'Medium' | 'Low'
  suggestedRank: number
  reasoning: string
}

function formatDate(dateStr: string, isDateOnly = false): string {
  const d = isDateOnly ? new Date(dateStr + 'T00:00:00') : new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
}

function nextCategory(cat: string | null): string | null {
  if (!cat) return 'feature'
  const i = CATEGORIES.indexOf(cat as typeof CATEGORIES[number])
  return i === CATEGORIES.length - 1 ? null : CATEGORIES[i + 1]
}

function nextEffort(eff: string | null): string | null {
  if (!eff) return 'xs'
  const i = EFFORTS.indexOf(eff as typeof EFFORTS[number])
  return i === EFFORTS.length - 1 ? null : EFFORTS[i + 1]
}

function nextPriority(p: string | null): string | null {
  if (!p) return 'High'
  const i = PRIORITIES.indexOf(p as typeof PRIORITIES[number])
  return i === PRIORITIES.length - 1 ? null : PRIORITIES[i + 1]
}

function categoryStyle(cat: string | null): Record<string, string> | null {
  switch (cat) {
    case 'feature':     return { color: 'var(--accent)',  background: 'var(--accent-dim)',  border: '1px solid var(--accent-glow)' }
    case 'bug':         return { color: 'var(--hot)',     background: 'var(--hot-dim)',     border: '1px solid oklch(0.66 0.22 22 / 0.25)' }
    case 'improvement': return { color: 'var(--ok)',      background: 'var(--ok-dim)',      border: '1px solid oklch(0.74 0.17 148 / 0.25)' }
    case 'design':      return { color: 'var(--water)',   background: 'var(--water-dim)',   border: '1px solid var(--water-border)' }
    case 'infra':       return { color: 'var(--warn)',    background: 'var(--warn-dim)',    border: '1px solid oklch(0.82 0.16 76 / 0.25)' }
    default: return null
  }
}

function effortStyle(eff: string | null): Record<string, string> | null {
  switch (eff) {
    case 'xs': case 'sm': return { color: 'var(--ok)',     background: 'var(--ok-dim)',     border: '1px solid oklch(0.74 0.17 148 / 0.25)' }
    case 'md':            return { color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)' }
    case 'lg':            return { color: 'var(--warn)',   background: 'var(--warn-dim)',   border: '1px solid oklch(0.82 0.16 76 / 0.25)' }
    case 'xl':            return { color: 'var(--hot)',    background: 'var(--hot-dim)',    border: '1px solid oklch(0.66 0.22 22 / 0.25)' }
    default: return null
  }
}

function priorityStyle(p: string | null): Record<string, string> | null {
  switch (p) {
    case 'High':   return { color: 'var(--hot)',  background: 'var(--hot-dim)',  border: '1px solid oklch(0.66 0.22 22 / 0.25)' }
    case 'Medium': return { color: 'var(--warn)', background: 'var(--warn-dim)', border: '1px solid oklch(0.82 0.16 76 / 0.25)' }
    case 'Low':    return { color: 'var(--ok)',   background: 'var(--ok-dim)',   border: '1px solid oklch(0.74 0.17 148 / 0.25)' }
    default: return null
  }
}

// ─── TagChip ───────────────────────────────────────────────

function TagChip({
  value,
  chipStyle,
  placeholder,
  onClick,
}: {
  value: string | null
  chipStyle: Record<string, string> | null
  placeholder: string
  onClick: () => void
}) {
  return value ? (
    <button
      onClick={onClick}
      className="card-label"
      style={{
        padding: '2px 7px',
        borderRadius: 4,
        cursor: 'pointer',
        transition: 'filter 120ms ease',
        ...chipStyle,
      }}
      title="Click to change"
    >
      {value}
    </button>
  ) : (
    <button
      onClick={onClick}
      className="card-label"
      style={{
        padding: '2px 7px',
        borderRadius: 4,
        cursor: 'pointer',
        color: 'var(--fg-4)',
        background: 'transparent',
        border: '1px dashed var(--border)',
        transition: 'color 120ms ease, border-color 120ms ease',
      }}
      title="Click to add"
    >
      {placeholder}
    </button>
  )
}

// ─── DropLine ──────────────────────────────────────────────

function DropLine() {
  return (
    <div
      style={{
        height: 2,
        background: 'linear-gradient(90deg, transparent, var(--accent) 20%, var(--accent) 80%, transparent)',
        borderRadius: 1,
        boxShadow: '0 0 8px var(--accent-glow)',
        margin: '1px 0',
        pointerEvents: 'none',
      }}
    />
  )
}

// ─── FeatureCard ───────────────────────────────────────────

interface CardProps {
  feature: Feature
  isDragging: boolean
  isDropTarget: boolean
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  onDragEnd: () => void
  onToggleExpand: (id: string, next: boolean) => void
  onDelete: (id: string) => void
  onUpdateField: (id: string, field: string, value: string | boolean | null) => void
  animIdx: number
}

function FeatureCard({
  feature,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onToggleExpand,
  onDelete,
  onUpdateField,
  animIdx,
}: CardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <Fragment>
      {isDropTarget && <DropLine />}
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={(e) => { e.preventDefault(); onDragOver() }}
        onDrop={(e) => { e.stopPropagation(); onDrop() }}
        onDragEnd={onDragEnd}
        className="panel group animate-fade-up"
        style={{
          opacity: isDragging ? 0.35 : 1,
          transition: 'opacity 180ms ease, transform 150ms ease, border-color 200ms ease, box-shadow 200ms ease',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '10px 12px 10px 8px',
          animationDelay: `${animIdx * 35}ms`,
          cursor: isDragging ? 'grabbing' : 'default',
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            cursor: 'grab',
            color: 'var(--fg-4)',
            fontSize: 13,
            padding: '1px 4px 0 2px',
            userSelect: 'none',
            flexShrink: 0,
            lineHeight: 1.2,
            marginTop: 1,
            letterSpacing: -1,
            transition: 'color 150ms ease',
          }}
          title="Drag to reorder"
        >
          ⠿
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>

          {/* Title row */}
          <div className="flex items-start flex-wrap gap-2">
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--fg)',
                lineHeight: 1.4,
                flex: 1,
                minWidth: 120,
              }}
            >
              {feature.title}
            </span>

            {/* Tags shown inline when collapsed */}
            {!feature.is_expanded && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                <TagChip
                  value={feature.priority}
                  chipStyle={priorityStyle(feature.priority)}
                  placeholder="+ pri"
                  onClick={() => onUpdateField(feature.id, 'priority', nextPriority(feature.priority))}
                />
                <TagChip
                  value={feature.category}
                  chipStyle={categoryStyle(feature.category)}
                  placeholder="+ cat"
                  onClick={() => onUpdateField(feature.id, 'category', nextCategory(feature.category))}
                />
                <TagChip
                  value={feature.effort}
                  chipStyle={effortStyle(feature.effort)}
                  placeholder="+ eff"
                  onClick={() => onUpdateField(feature.id, 'effort', nextEffort(feature.effort))}
                />
              </div>
            )}
          </div>

          {/* Expanded body */}
          {feature.is_expanded && (
            <>
              {feature.notes && (
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--fg-3)',
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  {feature.notes}
                </p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <TagChip
                  value={feature.priority}
                  chipStyle={priorityStyle(feature.priority)}
                  placeholder="+ priority"
                  onClick={() => onUpdateField(feature.id, 'priority', nextPriority(feature.priority))}
                />
                <TagChip
                  value={feature.category}
                  chipStyle={categoryStyle(feature.category)}
                  placeholder="+ category"
                  onClick={() => onUpdateField(feature.id, 'category', nextCategory(feature.category))}
                />
                <TagChip
                  value={feature.effort}
                  chipStyle={effortStyle(feature.effort)}
                  placeholder="+ effort"
                  onClick={() => onUpdateField(feature.id, 'effort', nextEffort(feature.effort))}
                />
                {feature.when_to_add && (
                  <span
                    className="card-label"
                    style={{
                      padding: '2px 7px',
                      borderRadius: 4,
                      color: 'var(--accent)',
                      background: 'var(--accent-dim)',
                      border: '1px solid var(--accent-glow)',
                    }}
                  >
                    {formatDate(feature.when_to_add, true)}
                  </span>
                )}
                <span className="card-label" style={{ color: 'var(--fg-4)' }}>
                  {formatDate(feature.created_at)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginTop: 1 }}
        >
          {confirmDelete ? (
            <>
              <button
                onClick={() => onDelete(feature.id)}
                className="card-label"
                style={{
                  padding: '2px 7px',
                  borderRadius: 4,
                  color: 'var(--hot)',
                  background: 'var(--hot-dim)',
                  border: '1px solid oklch(0.66 0.22 22 / 0.25)',
                  cursor: 'pointer',
                }}
              >
                YES
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="card-label"
                style={{
                  padding: '2px 7px',
                  borderRadius: 4,
                  color: 'var(--fg-3)',
                  background: 'var(--bg-3)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                NO
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onToggleExpand(feature.id, !feature.is_expanded)}
                className="card-label opacity-0 group-hover:opacity-100"
                style={{
                  padding: '2px 7px',
                  borderRadius: 4,
                  color: 'var(--fg-3)',
                  background: 'var(--bg-3)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'opacity 150ms ease',
                }}
                title={feature.is_expanded ? 'Collapse' : 'Expand'}
              >
                {feature.is_expanded ? '−' : '+'}
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="card-label opacity-0 group-hover:opacity-100"
                style={{
                  padding: '2px 7px',
                  borderRadius: 4,
                  color: 'var(--fg-3)',
                  background: 'var(--bg-3)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'opacity 150ms ease',
                }}
                title="Delete"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>
    </Fragment>
  )
}

// ─── FilterPill ────────────────────────────────────────────

function FilterPill({
  label,
  active,
  chipStyle,
  onClick,
}: {
  label: string
  active: boolean
  chipStyle?: Record<string, string> | null
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="card-label"
      style={{
        padding: '3px 9px',
        borderRadius: 4,
        cursor: 'pointer',
        transition: 'all 120ms ease',
        ...(active && chipStyle
          ? chipStyle
          : active
          ? { color: 'var(--fg)', background: 'var(--bg-3)', border: '1px solid var(--border-2)' }
          : { color: 'var(--fg-4)', background: 'transparent', border: '1px dashed var(--border)' }),
      }}
    >
      {label}
    </button>
  )
}

// ─── Page ──────────────────────────────────────────────────

export default function NewFeaturesPage() {
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [whenToAdd, setWhenToAdd] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  // Suggestion flow
  const [suggesting, setSuggesting] = useState(false)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [overridePriority, setOverridePriority] = useState<string | null>(null)
  const [overrideRank, setOverrideRank] = useState<number | null>(null)
  const [showOverride, setShowOverride] = useState(false)

  // Filter state
  const [filterPriority, setFilterPriority] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterEffort, setFilterEffort] = useState<string | null>(null)

  // "What to build next?"
  const [nextRec, setNextRec] = useState<string | null>(null)
  const [loadingNext, setLoadingNext] = useState(false)

  // Drag-and-drop state
  const dragSrcRef = useRef<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

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

  // Filtered view (client-side)
  const displayed = features.filter(f => {
    if (filterPriority && f.priority !== filterPriority) return false
    if (filterCategory && f.category !== filterCategory) return false
    if (filterEffort && f.effort !== filterEffort) return false
    return true
  })

  // ── Form submit → get suggestion ───────────────────────

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSuggesting(true)
    setSuggestion(null)
    setShowOverride(false)
    setOverridePriority(null)
    setOverrideRank(null)
    try {
      const res = await fetch('/api/new-features/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, notes, totalFeatures: features.length }),
      })
      const data = await res.json()
      if (data.priority) {
        setSuggestion(data)
      } else {
        await saveFinal(null, features.length)
      }
    } catch {
      await saveFinal(null, features.length)
    }
    setSuggesting(false)
  }

  async function saveFinal(priority: string | null, rank: number) {
    setAdding(true)
    const clampedRank = Math.max(0, Math.min(rank, features.length))
    try {
      const res = await fetch('/api/new-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          notes,
          when_to_add: whenToAdd || null,
          sort_order: features.length,
          priority,
        }),
      })
      const data = await res.json()
      if (data.feature) {
        const next = [...features, data.feature]
        const newCard = next.pop()!
        next.splice(clampedRank, 0, newCard)
        setFeatures(next)
        await persistOrder(next)
        resetForm()
      }
    } catch {}
    setAdding(false)
  }

  function resetForm() {
    setTitle('')
    setNotes('')
    setWhenToAdd('')
    setShowForm(false)
    setSuggestion(null)
    setShowOverride(false)
    setOverridePriority(null)
    setOverrideRank(null)
  }

  async function removeFeature(id: string) {
    setFeatures(prev => prev.filter(f => f.id !== id))
    await fetch(`/api/new-features?id=${id}`, { method: 'DELETE' })
  }

  async function toggleExpand(id: string, nextExpanded: boolean) {
    setFeatures(prev => prev.map(f => f.id === id ? { ...f, is_expanded: nextExpanded } : f))
    await fetch('/api/new-features', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_expanded: nextExpanded }),
    })
  }

  async function updateField(id: string, field: string, value: string | boolean | null) {
    setFeatures(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f))
    await fetch('/api/new-features', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: value }),
    })
  }

  async function persistOrder(ordered: Feature[]) {
    await fetch('/api/new-features', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reorder: ordered.map(f => f.id) }),
    })
  }

  async function fetchNextRec() {
    if (features.length === 0) return
    setLoadingNext(true)
    setNextRec(null)
    try {
      const res = await fetch('/api/new-features/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features }),
      })
      const data = await res.json()
      if (data.recommendation) setNextRec(data.recommendation)
    } catch {}
    setLoadingNext(false)
  }

  // ── Drag handlers ──────────────────────────────────────

  function handleDragStart(idx: number) {
    dragSrcRef.current = idx
    setDraggingId(displayed[idx].id)
  }

  function handleDragOver(idx: number) {
    if (dragSrcRef.current !== null && dragSrcRef.current !== idx) {
      setDropIdx(idx)
    }
  }

  function handleDrop(idx: number) {
    const src = dragSrcRef.current
    if (src === null || src === idx) { setDropIdx(null); return }
    const srcId = displayed[src].id
    const tgtId = displayed[idx].id
    const srcGlobalIdx = features.findIndex(f => f.id === srcId)
    const tgtGlobalIdx = features.findIndex(f => f.id === tgtId)
    const next = [...features]
    const [moved] = next.splice(srcGlobalIdx, 1)
    next.splice(srcGlobalIdx < tgtGlobalIdx ? tgtGlobalIdx - 1 : tgtGlobalIdx, 0, moved)
    setFeatures(next)
    setDropIdx(null)
    setDraggingId(null)
    dragSrcRef.current = null
    persistOrder(next)
  }

  function handleDropEnd() {
    const src = dragSrcRef.current
    if (src === null) return
    const srcId = displayed[src].id
    const srcGlobalIdx = features.findIndex(f => f.id === srcId)
    const next = [...features]
    const [moved] = next.splice(srcGlobalIdx, 1)
    next.push(moved)
    setFeatures(next)
    setDropIdx(null)
    setDraggingId(null)
    dragSrcRef.current = null
    persistOrder(next)
  }

  function handleDragEnd() {
    setDropIdx(null)
    setDraggingId(null)
    dragSrcRef.current = null
  }

  return (
    <Shell>
      <div className="flex flex-col gap-6" style={{ maxWidth: 760 }}>
        <Panel
          index={1}
          title="New Features"
          action={
            <button
              onClick={() => { setShowForm(v => !v); if (showForm) resetForm() }}
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
            <div className="flex flex-col gap-3 pb-1">
              <form onSubmit={handleFormSubmit} className="flex flex-col gap-2">
                <input
                  ref={titleRef}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Feature title…"
                  required
                  disabled={!!suggestion || suggesting}
                  className="text-xs px-3 py-2 rounded-lg outline-none"
                  style={{
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--fg)',
                    fontFamily: 'var(--font-mono)',
                    opacity: (!!suggestion || suggesting) ? 0.5 : 1,
                  }}
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={whenToAdd}
                    onChange={e => setWhenToAdd(e.target.value)}
                    type="date"
                    disabled={!!suggestion || suggesting}
                    className="text-xs px-3 py-2 rounded-lg outline-none"
                    style={{
                      background: 'var(--bg-2)',
                      border: '1px solid var(--border)',
                      color: whenToAdd ? 'var(--fg)' : 'var(--fg-3)',
                      fontFamily: 'var(--font-mono)',
                      colorScheme: 'dark',
                      opacity: (!!suggestion || suggesting) ? 0.5 : 1,
                    }}
                  />
                  <input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Notes (optional)…"
                    disabled={!!suggestion || suggesting}
                    className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
                    style={{
                      background: 'var(--bg-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--fg)',
                      fontFamily: 'var(--font-mono)',
                      opacity: (!!suggestion || suggesting) ? 0.5 : 1,
                    }}
                  />
                </div>

                {!suggestion && (
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={suggesting || !title.trim()}
                      className="text-xs px-4 py-2 rounded-lg font-semibold disabled:opacity-30 transition-all hover:brightness-110"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        background: 'var(--accent)',
                        color: 'oklch(0.09 0.008 255)',
                      }}
                    >
                      {suggesting ? 'ANALYZING…' : 'SAVE'}
                    </button>
                  </div>
                )}
              </form>

              {/* Claude suggestion panel */}
              {suggestion && (
                <div
                  className="animate-fade-up"
                  style={{
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border-2)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="card-label" style={{ color: 'var(--fg-4)' }}>Claude suggests</span>
                    <span
                      className="card-label"
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        ...priorityStyle(suggestion.priority),
                      }}
                    >
                      {suggestion.priority}
                    </span>
                    <span className="card-label" style={{ color: 'var(--fg-3)' }}>
                      · rank #{suggestion.suggestedRank + 1} of {features.length + 1}
                    </span>
                  </div>

                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--fg-3)',
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {suggestion.reasoning}
                  </p>

                  {/* Override controls */}
                  {showOverride && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="card-label" style={{ color: 'var(--fg-4)', minWidth: 52 }}>Priority</span>
                        {PRIORITIES.map(p => (
                          <button
                            key={p}
                            onClick={() => setOverridePriority(p)}
                            className="card-label"
                            style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              cursor: 'pointer',
                              transition: 'all 120ms ease',
                              ...(overridePriority === p ? (priorityStyle(p) ?? {}) : {
                                color: 'var(--fg-4)',
                                background: 'transparent',
                                border: '1px dashed var(--border)',
                              }),
                            }}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="card-label" style={{ color: 'var(--fg-4)', minWidth: 52 }}>Rank</span>
                        {Array.from({ length: features.length + 1 }, (_, i) => i).map(i => (
                          <button
                            key={i}
                            onClick={() => setOverrideRank(i)}
                            className="card-label"
                            style={{
                              padding: '2px 7px',
                              borderRadius: 4,
                              cursor: 'pointer',
                              transition: 'all 120ms ease',
                              ...(overrideRank === i
                                ? { color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)' }
                                : { color: 'var(--fg-4)', background: 'transparent', border: '1px dashed var(--border)' }),
                            }}
                          >
                            #{i + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => saveFinal(suggestion.priority, suggestion.suggestedRank)}
                      disabled={adding}
                      className="card-label"
                      style={{
                        padding: '4px 12px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: 'var(--accent)',
                        color: 'oklch(0.09 0.008 255)',
                        border: 'none',
                        opacity: adding ? 0.5 : 1,
                        transition: 'all 120ms ease',
                      }}
                    >
                      {adding ? '…' : 'ACCEPT'}
                    </button>
                    {!showOverride ? (
                      <button
                        onClick={() => {
                          setShowOverride(true)
                          setOverridePriority(suggestion.priority)
                          setOverrideRank(suggestion.suggestedRank)
                        }}
                        className="card-label"
                        style={{
                          padding: '4px 12px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          color: 'var(--fg-3)',
                          background: 'var(--bg-3)',
                          border: '1px solid var(--border)',
                          transition: 'all 120ms ease',
                        }}
                      >
                        OVERRIDE
                      </button>
                    ) : (
                      <button
                        onClick={() => saveFinal(overridePriority, overrideRank ?? suggestion.suggestedRank)}
                        disabled={adding || !overridePriority}
                        className="card-label"
                        style={{
                          padding: '4px 12px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          color: 'var(--fg)',
                          background: 'var(--bg-3)',
                          border: '1px solid var(--border-2)',
                          opacity: (adding || !overridePriority) ? 0.4 : 1,
                          transition: 'all 120ms ease',
                        }}
                      >
                        {adding ? '…' : 'SAVE OVERRIDE'}
                      </button>
                    )}
                    <button
                      onClick={() => setSuggestion(null)}
                      className="card-label"
                      style={{
                        padding: '4px 10px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: 'var(--fg-4)',
                        background: 'transparent',
                        border: '1px dashed var(--border)',
                        transition: 'all 120ms ease',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filter bar */}
          {!loading && features.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingBottom: 4 }}>
              <span className="card-label" style={{ color: 'var(--fg-4)', alignSelf: 'center', marginRight: 2 }}>filter</span>

              {PRIORITIES.map(p => (
                <FilterPill
                  key={p}
                  label={p}
                  active={filterPriority === p}
                  chipStyle={priorityStyle(p)}
                  onClick={() => setFilterPriority(prev => prev === p ? null : p)}
                />
              ))}

              <span style={{ color: 'var(--border-2)', alignSelf: 'center', userSelect: 'none' }}>·</span>

              {CATEGORIES.map(c => (
                <FilterPill
                  key={c}
                  label={c}
                  active={filterCategory === c}
                  chipStyle={categoryStyle(c)}
                  onClick={() => setFilterCategory(prev => prev === c ? null : c)}
                />
              ))}

              <span style={{ color: 'var(--border-2)', alignSelf: 'center', userSelect: 'none' }}>·</span>

              {EFFORTS.map(e => (
                <FilterPill
                  key={e}
                  label={e}
                  active={filterEffort === e}
                  chipStyle={effortStyle(e)}
                  onClick={() => setFilterEffort(prev => prev === e ? null : e)}
                />
              ))}

              {(filterPriority || filterCategory || filterEffort) && (
                <>
                  <span style={{ color: 'var(--border-2)', alignSelf: 'center', userSelect: 'none' }}>·</span>
                  <button
                    onClick={() => { setFilterPriority(null); setFilterCategory(null); setFilterEffort(null) }}
                    className="card-label"
                    style={{
                      padding: '3px 9px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: 'var(--fg-4)',
                      background: 'transparent',
                      border: '1px dashed var(--border)',
                    }}
                  >
                    clear
                  </button>
                </>
              )}
            </div>
          )}

          {/* Board */}
          {loading ? (
            <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
              Loading…
            </p>
          ) : features.length === 0 ? (
            <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
              No features queued. Add one above.
            </p>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropIdx(null)
              }}
            >
              {displayed.length === 0 ? (
                <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', padding: '4px 0' }}>
                  No features match the current filters.
                </p>
              ) : (
                displayed.map((f, i) => (
                  <FeatureCard
                    key={f.id}
                    feature={f}
                    animIdx={i}
                    isDragging={draggingId === f.id}
                    isDropTarget={dropIdx === i}
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={() => handleDragOver(i)}
                    onDrop={() => handleDrop(i)}
                    onDragEnd={handleDragEnd}
                    onToggleExpand={toggleExpand}
                    onDelete={removeFeature}
                    onUpdateField={updateField}
                  />
                ))
              )}

              {/* Bottom drop zone — only visible when no filters active */}
              {!filterPriority && !filterCategory && !filterEffort && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (dragSrcRef.current !== null) setDropIdx(displayed.length)
                  }}
                  onDrop={(e) => { e.stopPropagation(); handleDropEnd() }}
                  style={{
                    height: 28,
                    borderRadius: 6,
                    border: dropIdx === displayed.length
                      ? '1px dashed var(--accent)'
                      : '1px dashed transparent',
                    background: dropIdx === displayed.length
                      ? 'var(--accent-dim)'
                      : 'transparent',
                    transition: 'all 150ms ease',
                  }}
                />
              )}
            </div>
          )}

          {/* "What should I build next?" */}
          {!loading && features.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={fetchNextRec}
                  disabled={loadingNext}
                  className="card-label"
                  style={{
                    padding: '4px 12px',
                    borderRadius: 4,
                    cursor: loadingNext ? 'default' : 'pointer',
                    color: 'var(--accent)',
                    background: 'var(--accent-dim)',
                    border: '1px solid var(--accent-glow)',
                    opacity: loadingNext ? 0.6 : 1,
                    transition: 'all 120ms ease',
                  }}
                >
                  {loadingNext ? 'THINKING…' : '✦ WHAT SHOULD I BUILD NEXT?'}
                </button>
                {nextRec && (
                  <button
                    onClick={() => setNextRec(null)}
                    className="card-label"
                    style={{
                      color: 'var(--fg-4)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 4px',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {nextRec && (
                <div
                  className="animate-fade-up"
                  style={{
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border-2)',
                    borderRadius: 8,
                    padding: '12px 14px',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--fg-2)',
                      lineHeight: 1.7,
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {nextRec}
                  </p>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </Shell>
  )
}

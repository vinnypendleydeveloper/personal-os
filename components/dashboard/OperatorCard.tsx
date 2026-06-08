'use client'

import { useEffect, useState, useRef, KeyboardEvent } from 'react'
import { Panel } from './Panel'

interface Profile { focus: string; school: string; status: string }

const DEFAULT_PROFILE: Profile = {
  focus: 'IB Internship Search',
  school: 'USC → Fall 2026',
  status: 'ACTIVE',
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Consecutive days (ending today) with ≥1 completed habit.
 *  Today not-yet-done doesn't break the streak; any earlier empty day does. */
function computeStreak(habits: Record<string, { done?: string[] }>): number {
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const hit = (habits[dateKey(d)]?.done?.length ?? 0) > 0
    if (hit) streak++
    else if (i === 0) continue // today not done yet — don't break
    else break
  }
  return streak
}

export function OperatorCard() {
  const [streak, setStreak] = useState(0)
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)

  useEffect(() => {
    fetch('/api/habits?days=120')
      .then(r => r.json())
      .then(data => setStreak(computeStreak(data.habits ?? {})))
      .catch(() => {})

    fetch('/api/profile')
      .then(r => r.json())
      .then(data => { if (data.profile) setProfile({ ...DEFAULT_PROFILE, ...data.profile }) })
      .catch(() => {})
  }, [])

  function save(field: keyof Profile, value: string) {
    const next = { ...profile, [field]: value }
    setProfile(next)
    fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    }).catch(console.error)
  }

  return (
    <Panel index={1} title="Operator" status="online" delay={0}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-semibold" style={{ color: 'var(--fg)' }}>Vinny Pendley</p>
            <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', fontSize: '11px' }}>
              Los Angeles, CA
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums leading-none" style={{ fontFamily: 'var(--font-mono)', color: streak > 0 ? 'var(--accent)' : 'var(--fg-2)' }}>
              {streak}
            </p>
            <p className="text-[9px] mt-0.5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)', letterSpacing: '0.1em' }}>
              DAY STREAK
            </p>
          </div>
        </div>

        <div className="h-px" style={{ background: 'var(--border)' }} />

        <div className="flex flex-col gap-1.5">
          <EditableRow label="FOCUS"  value={profile.focus}  onSave={v => save('focus', v)} />
          <EditableRow label="SCHOOL" value={profile.school} onSave={v => save('school', v)} />
          <EditableRow label="STATUS" value={profile.status} onSave={v => save('status', v)} status />
        </div>
      </div>
    </Panel>
  )
}

function EditableRow({
  label, value, onSave, status = false,
}: { label: string; value: string; onSave: (v: string) => void; status?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [justSaved, setJustSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  function commit() {
    const v = draft.trim()
    setEditing(false)
    if (v && v !== value) {
      onSave(v)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1200)
    } else {
      setDraft(value)
    }
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') { setDraft(value); setEditing(false) }
  }

  return (
    <div className="flex items-center justify-between gap-2 group">
      <span className="text-[10px] font-medium tracking-wider shrink-0" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
        {label}
      </span>

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={commit}
          autoFocus
          className="text-[11px] text-right outline-none rounded px-1.5 py-0.5 min-w-0 flex-1"
          style={{
            fontFamily: 'var(--font-mono)',
            background: 'var(--bg-2)',
            border: '1px solid var(--accent-glow)',
            color: 'var(--fg)',
          }}
        />
      ) : (
        <button
          onClick={() => { setDraft(value); setEditing(true) }}
          className="text-[11px] text-right rounded px-1.5 py-0.5 -mr-1.5 transition-colors hover:bg-[var(--bg-2)] cursor-text truncate"
          style={{
            fontFamily: 'var(--font-mono)',
            color: status ? 'var(--ok)' : 'var(--fg-2)',
          }}
          title="Click to edit"
        >
          {status && <span style={{ marginRight: 4 }}>●</span>}
          {value}
          {justSaved && <span style={{ marginLeft: 6, color: 'var(--ok)', fontSize: 9 }}>✓</span>}
        </button>
      )}
    </div>
  )
}

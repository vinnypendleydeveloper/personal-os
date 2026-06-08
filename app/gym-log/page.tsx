'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'
import { DAYS, getDay, ExerciseDef } from '@/lib/gymTemplates'

interface SetVal { weight: string; reps: string }
interface ProgressEntry { status: 'up' | 'same' | 'down' | 'new'; label: string }

function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}
function dayDiff(a: string, b: string) {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((+new Date(by, bm - 1, bd) - +new Date(ay, am - 1, ad)) / 86_400_000)
}

const PROG_COLOR: Record<string, string> = {
  up: 'var(--ok)', same: 'var(--fg-3)', down: 'var(--warn)', new: 'var(--accent)',
}

export default function GymLogPage() {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [entries, setEntries] = useState<Record<string, SetVal[]>>({})
  const [optIncluded, setOptIncluded] = useState<Record<string, boolean>>({})
  const [absIncluded, setAbsIncluded] = useState(true)
  const [absDue, setAbsDue] = useState(true)
  const [whoopStrain, setWhoopStrain] = useState('')
  const [sauna, setSauna] = useState(false)
  const [notes, setNotes] = useState('')
  const [lastAbsDate, setLastAbsDate] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [progress, setProgress] = useState<Record<string, ProgressEntry>>({})
  const [summary, setSummary] = useState<{ up: number; same: number; down: number; comparedTo: string | null } | null>(null)

  useEffect(() => {
    fetch('/api/gym-log').then(r => r.json()).then(d => {
      setLastAbsDate(d.lastAbsDate ?? null)
      const due = !d.lastAbsDate || dayDiff(d.lastAbsDate, todayKey()) >= 2
      setAbsDue(due)
      setAbsIncluded(due)
      if (typeof d.whoopStrain === 'number') setWhoopStrain(String(d.whoopStrain))
      // Resume today's session if already started
      if (d.today) {
        loadDay(d.today.day, d.today)
        setWhoopStrain(d.today.whoop_strain != null ? String(d.today.whoop_strain) : '')
        setSauna(!!d.today.sauna)
        setNotes(d.today.notes ?? '')
        setAbsIncluded(!!d.today.abs_included)
      }
    }).catch(() => {})
  }, [])

  function loadDay(dayNum: number, existing?: { exercises: { name: string; sets: { weight: number | null; reps: number | null }[] }[] }) {
    const def = getDay(dayNum)
    if (!def) return
    setSelectedDay(dayNum)
    setSaved(false); setProgress({}); setSummary(null)
    const e: Record<string, SetVal[]> = {}
    const opt: Record<string, boolean> = {}
    for (const ex of def.exercises) {
      const ex0 = existing?.exercises.find(x => x.name === ex.name)
      e[ex.name] = Array.from({ length: ex.sets }, (_, i) => ({
        weight: ex0?.sets[i]?.weight != null ? String(ex0.sets[i].weight) : '',
        reps: ex0?.sets[i]?.reps != null ? String(ex0.sets[i].reps) : '',
      }))
      if (ex.optional) opt[ex.name] = !!ex0
    }
    setEntries(e)
    setOptIncluded(opt)
  }

  function setVal(name: string, idx: number, field: 'weight' | 'reps', val: string) {
    setEntries(prev => {
      const arr = [...(prev[name] ?? [])]
      arr[idx] = { ...arr[idx], [field]: val }
      return { ...prev, [name]: arr }
    })
  }

  const def = selectedDay ? getDay(selectedDay) : null

  async function save() {
    if (!def) return
    setSaving(true)
    const exercises = def.exercises
      .filter(ex => {
        if (ex.optional && !optIncluded[ex.name]) return false
        if (ex.isAbs && !absIncluded) return false
        return true
      })
      .map(ex => ({
        name: ex.name, group: ex.group, unit: ex.unit, target: ex.target,
        sets: (entries[ex.name] ?? []).map(s => ({
          weight: s.weight === '' ? null : Number(s.weight),
          reps: s.reps === '' ? null : Number(s.reps),
        })),
      }))
    const hasAbs = def.exercises.some(e => e.isAbs)
    const res = await fetch('/api/gym-log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day: def.day, label: def.label, exercises,
        abs_included: hasAbs && absIncluded,
        whoop_strain: whoopStrain === '' ? null : Number(whoopStrain),
        sauna, notes,
      }),
    })
    const d = await res.json()
    setProgress(d.progress ?? {})
    setSummary(d.summary ?? null)
    setSaved(true)
    setSaving(false)
  }

  // Group exercises preserving order
  const groups: { group: string; items: ExerciseDef[] }[] = []
  if (def) for (const ex of def.exercises) {
    const last = groups[groups.length - 1]
    if (last && last.group === ex.group) last.items.push(ex)
    else groups.push({ group: ex.group, items: [ex] })
  }

  return (
    <Shell>
      <div className="flex flex-col gap-4" style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="flex items-center justify-between">
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--fg)' }}>
            GYM LOG
          </h1>
          <Link href="/gym-log/history" className="card-label hover:opacity-70 transition-opacity" style={{ color: 'var(--accent)' }}>
            History →
          </Link>
        </div>

        {/* Day selector */}
        {!selectedDay ? (
          <Panel index={1} title="Select Today's Split">
            <div className="grid grid-cols-2 gap-2">
              {DAYS.map(d => (
                <button key={d.day} onClick={() => loadDay(d.day)}
                  className="flex flex-col items-start gap-1 p-3 rounded-lg text-left transition-all hover:brightness-110 active:scale-[0.99]"
                  style={{
                    background: d.rest ? 'var(--bg-2)' : 'var(--accent-dim)',
                    border: `1px solid ${d.rest ? 'var(--border)' : 'var(--accent-glow)'}`,
                  }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: d.rest ? 'var(--fg-2)' : 'var(--accent)' }}>
                    DAY {d.day}
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{d.label}</span>
                </button>
              ))}
            </div>
          </Panel>
        ) : (
          <>
            {/* Header with chosen day */}
            <Panel index={1} title={`Day ${def!.day} · ${def!.label}`} status="online" action={
              <button onClick={() => { setSelectedDay(null) }} className="card-label hover:opacity-70" style={{ color: 'var(--fg-2)' }}>
                ↺ change day
              </button>
            }>
              {summary && (
                <div className="rounded-lg p-2.5 flex items-center gap-3 flex-wrap" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                  <span className="card-label" style={{ color: 'var(--accent)' }}>PROGRESS VS LAST WEEK</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ok)' }}>↑ {summary.up} improved</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>= {summary.same} held</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--warn)' }}>↓ {summary.down} down</span>
                  {summary.comparedTo && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)', marginLeft: 'auto' }}>vs {summary.comparedTo}</span>}
                </div>
              )}
              {def!.rest && (
                <p className="text-xs" style={{ color: 'var(--fg-3)' }}>
                  Rest / light cardio day — just log how you recovered below.
                </p>
              )}
            </Panel>

            {/* Exercise groups */}
            {groups.map(({ group, items }) => {
              const isAbsGroup = items[0].isAbs
              const dimmed = isAbsGroup && !absIncluded
              return (
                <Panel key={group} title={group} action={
                  isAbsGroup && !absDue ? (
                    <button onClick={() => setAbsIncluded(v => !v)} className="card-label hover:opacity-70"
                      style={{ color: absIncluded ? 'var(--ok)' : 'var(--fg-2)' }}>
                      {absIncluded ? '✓ included' : 'REST DAY · include anyway'}
                    </button>
                  ) : null
                }>
                  <div className="flex flex-col gap-3" style={{ opacity: dimmed ? 0.4 : 1, pointerEvents: dimmed ? 'none' : 'auto' }}>
                    {items.map(ex => {
                      const prog = progress[ex.name]
                      const isOpt = ex.optional
                      const included = !isOpt || optIncluded[ex.name]
                      return (
                        <div key={ex.name} className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isOpt && (
                              <button onClick={() => setOptIncluded(p => ({ ...p, [ex.name]: !p[ex.name] }))}
                                className="w-4 h-4 rounded shrink-0 border flex items-center justify-center"
                                style={{ background: included ? 'var(--accent)' : 'transparent', borderColor: included ? 'var(--accent)' : 'var(--bg-3)' }}>
                                {included && <span style={{ fontSize: 9, color: 'var(--bg)' }}>✓</span>}
                              </button>
                            )}
                            <span className="text-sm font-medium" style={{ color: included ? 'var(--fg)' : 'var(--fg-2)' }}>
                              {ex.name}{isOpt && <span style={{ fontSize: 10, color: 'var(--fg-2)' }}> (optional)</span>}
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)' }}>
                              {ex.sets}× · {ex.target}
                            </span>
                            {prog && saved && (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, marginLeft: 'auto', color: PROG_COLOR[prog.status] }}>
                                {prog.status === 'up' ? '▲' : prog.status === 'down' ? '⚑' : prog.status === 'same' ? '=' : '★'} {prog.label}
                              </span>
                            )}
                          </div>
                          {included && (
                            <div className="flex flex-col gap-1 pl-0.5">
                              {(entries[ex.name] ?? []).map((s, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)', width: 38 }}>SET {i + 1}</span>
                                  {ex.unit === 'weight' && (
                                    <>
                                      <NumInput value={s.weight} onChange={v => setVal(ex.name, i, 'weight', v)} placeholder="lbs" />
                                      <span style={{ color: 'var(--fg-2)', fontSize: 11 }}>×</span>
                                      <NumInput value={s.reps} onChange={v => setVal(ex.name, i, 'reps', v)} placeholder="reps" />
                                    </>
                                  )}
                                  {ex.unit === 'reps' && (
                                    <NumInput value={s.reps} onChange={v => setVal(ex.name, i, 'reps', v)} placeholder="reps" wide />
                                  )}
                                  {ex.unit === 'time' && (
                                    <NumInput value={s.reps} onChange={v => setVal(ex.name, i, 'reps', v)} placeholder="seconds" wide />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </Panel>
              )
            })}

            {/* End of log */}
            <Panel index={9} title="End of Log">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>WHOOP STRAIN (0–21)</label>
                  <NumInput value={whoopStrain} onChange={setWhoopStrain} placeholder="0.0" wide />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>SAUNA TODAY?</label>
                  <div className="flex gap-1">
                    {[true, false].map(v => (
                      <button key={String(v)} onClick={() => setSauna(v)}
                        className="text-xs px-3 py-1 rounded-md transition-colors"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          background: sauna === v ? (v ? 'var(--ok-dim)' : 'var(--bg-3)') : 'var(--bg-2)',
                          color: sauna === v ? (v ? 'var(--ok)' : 'var(--fg-2)') : 'var(--fg-2)',
                          border: `1px solid ${sauna === v ? (v ? 'var(--ok)' : 'var(--fg-3)') : 'var(--border)'}`,
                        }}>{v ? 'YES' : 'NO'}</button>
                    ))}
                  </div>
                </div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notes (optional)…"
                  className="text-sm px-3 py-2 rounded-lg outline-none resize-none"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg)' }} />
              </div>
            </Panel>

            {/* Save */}
            <button onClick={save} disabled={saving}
              className="py-3 rounded-xl text-sm font-bold tracking-wider transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
              style={{ fontFamily: 'var(--font-mono)', background: saved ? 'var(--ok)' : 'var(--accent)', color: 'oklch(0.09 0.008 255)' }}>
              {saving ? 'SAVING…' : saved ? '✓ SAVED — SAVE AGAIN' : 'SAVE SESSION'}
            </button>
          </>
        )}
      </div>
    </Shell>
  )
}

function NumInput({ value, onChange, placeholder, wide }: { value: string; onChange: (v: string) => void; placeholder?: string; wide?: boolean }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="text-sm px-2 py-1 rounded-md outline-none tabular-nums"
      style={{
        background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg)',
        width: wide ? 96 : 64, fontFamily: 'var(--font-mono)',
      }}
    />
  )
}

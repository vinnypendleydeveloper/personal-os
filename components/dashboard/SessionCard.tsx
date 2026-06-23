'use client'

import { useEffect, useState, useRef } from 'react'
import { Panel } from './Panel'
import { Markdown } from '@/components/Markdown'

interface Msg { role: 'user' | 'assistant'; content: string }
interface Defaults { wake_time: string | null; recovery: number | null }
interface Intake { wake_time?: string; energy?: string; must_do?: string; protect?: string; confirmed_today?: string[] }
interface BriefingTask {
  id: string; title: string; urgency: string; priority_score: number; due_date: string | null
  description: string | null; tags: string[]
}

function briefingToday() { return new Date().toLocaleDateString('en-CA') }
function fmtDue(s: string) {
  const [, m, d] = s.split('-').map(Number)
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]} ${d}`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Still up, Vinny?'
  if (h < 12) return 'Good morning, Vinny.'
  if (h < 17) return 'Good afternoon, Vinny.'
  if (h < 21) return 'Good evening, Vinny.'
  return 'Winding down, Vinny.'
}

const ENERGY_OPTS = [
  { v: 'low', label: 'Low' },
  { v: 'medium', label: 'Medium' },
  { v: 'high', label: 'High' },
]

export function SessionCard() {
  const [plan, setPlan] = useState('')
  const [planLoading, setPlanLoading] = useState(true)
  const [defaults, setDefaults] = useState<Defaults>({ wake_time: null, recovery: null })
  const [formOpen, setFormOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  // Intake fields
  const [wake, setWake] = useState('')
  const [energy, setEnergy] = useState('')
  const [mustDo, setMustDo] = useState('')
  const [protect, setProtect] = useState('')
  const [confirmedToday, setConfirmedToday] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/plan')
      .then(r => r.json())
      .then(d => {
        setPlan(d.plan ?? '')
        setDefaults(d.defaults ?? { wake_time: null, recovery: null })
        const intake: Intake | null = d.intake ?? null
        if (intake) {
          setWake(intake.wake_time ?? d.defaults?.wake_time ?? '')
          setEnergy(intake.energy ?? '')
          setMustDo(intake.must_do ?? '')
          setProtect(intake.protect ?? '')
          if (intake.confirmed_today) setConfirmedToday(intake.confirmed_today)
        } else if (d.defaults?.wake_time) {
          setWake(d.defaults.wake_time)
        }
        setFormOpen(!d.intake) // show form until intake is submitted at least once today
        setPlanLoading(false)
      })
      .catch(() => setPlanLoading(false))
  }, [])

  const [tasks, setTasks] = useState<BriefingTask[]>([])

  useEffect(() => {
    fetch('/api/tasks?status=open')
      .then(r => r.json())
      .then(d => {
        const today = briefingToday()
        const relevant = ((d.tasks ?? []) as BriefingTask[])
          .filter(t => t.due_date && t.due_date <= today)
          .sort((a, b) => b.priority_score - a.priority_score)
        setTasks(relevant)
      })
      .catch(() => {})
  }, [])

  async function completeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed_at: new Date().toISOString() }),
    })
  }

  async function reorderTask(id: string, dir: 'up' | 'down') {
    const idx = tasks.findIndex(t => t.id === id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swapIdx < 0 || swapIdx >= tasks.length) return
    const a = tasks[idx]
    const b = tasks[swapIdx]
    setTasks(prev =>
      prev.map((t, i) => {
        if (i === idx) return { ...t, priority_score: b.priority_score }
        if (i === swapIdx) return { ...t, priority_score: a.priority_score }
        return t
      }).sort((x, y) => y.priority_score - x.priority_score)
    )
    await Promise.all([
      fetch(`/api/tasks/${a.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority_score: b.priority_score }),
      }),
      fetch(`/api/tasks/${b.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority_score: a.priority_score }),
      }),
    ])
  }

  async function generate() {
    setGenerating(true)
    try {
      const r = await fetch('/api/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wake_time: wake, energy, must_do: mustDo, protect, confirmed_today: confirmedToday }),
      })
      const d = await r.json()
      setPlan(d.plan ?? '')
      setFormOpen(false)
    } catch { /* keep form open */ }
    setGenerating(false)
  }

  function openReplan() {
    if (!wake && defaults.wake_time) setWake(defaults.wake_time)
    setFormOpen(true)
  }

  return (
    <>
      <Panel
        index={2}
        title="Briefing"
        status="online"
        action={
          plan && !formOpen ? (
            <button onClick={openReplan} className="card-label hover:opacity-70 transition-opacity" style={{ color: 'var(--fg-2)' }}>
              ↻ replan
            </button>
          ) : null
        }
      >
        {/* Greeting */}
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
          {greeting()}
        </div>

        {planLoading ? (
          <div className="flex flex-col gap-2 py-1">
            {[60, 90, 75, 85, 50].map((w, i) => (
              <div key={i} className="rounded" style={{ height: 9, width: `${w}%`, background: 'var(--bg-3)' }} />
            ))}
          </div>
        ) : formOpen ? (
          <IntakeForm
            wake={wake} setWake={setWake}
            energy={energy} setEnergy={setEnergy}
            mustDo={mustDo} setMustDo={setMustDo}
            protect={protect} setProtect={setProtect}
            recovery={defaults.recovery}
            generating={generating}
            onGenerate={generate}
            onCancel={plan ? () => setFormOpen(false) : undefined}
            tasks={tasks}
            confirmedToday={confirmedToday}
            setConfirmedToday={setConfirmedToday}
          />
        ) : plan ? (
          <>
            <div style={{ fontSize: 13 }}>
              <Markdown text={plan} />
            </div>
            {tasks.length > 0 && (
              <BriefingTaskList tasks={tasks} onComplete={completeTask} onReorder={reorderTask} />
            )}
          </>
        ) : (
          <button
            onClick={() => setFormOpen(true)}
            className="self-start text-xs px-3 py-2 rounded-lg font-medium transition-all hover:brightness-110"
            style={{ fontFamily: 'var(--font-mono)', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-glow)' }}
          >
            Build today&apos;s briefing →
          </button>
        )}

        {/* Chat affordance — only once a plan exists */}
        {!formOpen && plan && (
          <button
            onClick={() => setChatOpen(true)}
            className="mt-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-150 hover:brightness-110 active:scale-[0.99]"
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
              background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-glow)',
            }}
          >
            ›_ TALK THROUGH TODAY
          </button>
        )}
      </Panel>

      {chatOpen && <SessionChat plan={plan} onClose={() => setChatOpen(false)} />}
    </>
  )
}

// ── Intake form ───────────────────────────────────────────────────────────────
function IntakeForm({
  wake, setWake, energy, setEnergy, mustDo, setMustDo, protect, setProtect,
  recovery, generating, onGenerate, onCancel,
  tasks, confirmedToday, setConfirmedToday,
}: {
  wake: string; setWake: (v: string) => void
  energy: string; setEnergy: (v: string) => void
  mustDo: string; setMustDo: (v: string) => void
  protect: string; setProtect: (v: string) => void
  recovery: number | null
  generating: boolean
  onGenerate: () => void
  onCancel?: () => void
  tasks: BriefingTask[]
  confirmedToday: string[]
  setConfirmedToday: (v: string[]) => void
}) {
  const field = {
    background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg)',
  } as const
  const labelStyle = {
    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--fg-3)', textTransform: 'uppercase' as const,
  }

  return (
    <div className="flex flex-col gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <span style={{ ...labelStyle, color: 'var(--accent)' }}>Before I build your day</span>
        {onCancel && <button onClick={onCancel} style={{ color: 'var(--fg-3)', fontSize: 11 }}>✕</button>}
      </div>

      {/* Wake time */}
      <div className="flex flex-col gap-1">
        <label style={labelStyle}>What time did you wake up?</label>
        <input value={wake} onChange={e => setWake(e.target.value)}
          placeholder={recovery != null ? 'e.g. 7:10 AM' : '7:10 AM'}
          className="text-sm px-2.5 py-1.5 rounded-md outline-none" style={field} />
      </div>

      {/* Energy */}
      <div className="flex flex-col gap-1">
        <label style={labelStyle}>Energy right now</label>
        <div className="flex gap-1.5">
          {ENERGY_OPTS.map(o => (
            <button key={o.v} onClick={() => setEnergy(o.v)}
              className="flex-1 text-[11px] py-1.5 rounded-md transition-all"
              style={{
                fontFamily: 'var(--font-mono)',
                background: energy === o.v ? 'var(--accent-dim)' : 'var(--bg-2)',
                color: energy === o.v ? 'var(--accent)' : 'var(--fg-3)',
                border: `1px solid ${energy === o.v ? 'var(--accent-glow)' : 'var(--border)'}`,
              }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Committed tasks checklist */}
      {tasks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label style={labelStyle}>Which of these do you need to get done today — guaranteed?</label>
          {tasks.map(t => {
            const checked = confirmedToday.includes(t.id)
            const overdue = !!(t.due_date && t.due_date < briefingToday())
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setConfirmedToday(
                  checked ? confirmedToday.filter(id => id !== t.id) : [...confirmedToday, t.id]
                )}
                className="flex items-center gap-2 text-left rounded-md transition-all"
                style={{
                  padding: '6px 10px',
                  background: checked ? 'var(--accent-dim)' : 'var(--bg-2)',
                  border: `1px solid ${checked ? 'var(--accent-glow)' : 'var(--border)'}`,
                }}
              >
                <span style={{
                  width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                  background: checked ? 'var(--accent)' : 'transparent',
                  color: 'oklch(0.09 0.008 255)', fontSize: 9, lineHeight: 1,
                }}>
                  {checked ? '✓' : ''}
                </span>
                <span className="flex-1 text-xs leading-snug" style={{ color: checked ? 'var(--accent)' : 'var(--fg)' }}>
                  {t.title}
                </span>
                {t.due_date && (
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.06em', flexShrink: 0,
                    color: overdue ? 'oklch(0.65 0.22 20)' : 'var(--fg-3)',
                  }}>
                    {overdue ? 'OVERDUE' : 'TODAY'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Must do */}
      <div className="flex flex-col gap-1">
        <label style={labelStyle}>#1 must-get-done today</label>
        <input value={mustDo} onChange={e => setMustDo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onGenerate()}
          placeholder="The one thing that matters most…"
          className="text-sm px-2.5 py-1.5 rounded-md outline-none" style={field} />
      </div>

      {/* Protect */}
      <div className="flex flex-col gap-1">
        <label style={labelStyle}>Any free blocks to protect?</label>
        <input value={protect} onChange={e => setProtect(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onGenerate()}
          placeholder="e.g. keep 3–5pm free (optional)"
          className="text-sm px-2.5 py-1.5 rounded-md outline-none" style={field} />
      </div>

      <button onClick={onGenerate} disabled={generating}
        className="self-start text-xs px-3.5 py-2 rounded-lg font-semibold disabled:opacity-40 hover:brightness-110 transition-all"
        style={{ fontFamily: 'var(--font-mono)', background: 'var(--accent)', color: 'oklch(0.09 0.008 255)' }}>
        {generating ? 'BUILDING YOUR DAY…' : 'GENERATE BRIEFING'}
      </button>
    </div>
  )
}

// ── Briefing task list ────────────────────────────────────────────────────────
function BriefingTaskRow({ t, idx, total, today, onComplete, onReorder }: {
  t: BriefingTask; idx: number; total: number; today: string
  onComplete: (id: string) => void
  onReorder: (id: string, dir: 'up' | 'down') => void
}) {
  const isOverdue = !!(t.due_date && t.due_date < today)
  const accent = isOverdue ? 'oklch(0.65 0.22 20)' : 'var(--fg-3)'
  return (
    <div className="flex items-center gap-2 group">
      <button
        onClick={() => onComplete(t.id)}
        title="Mark complete"
        className="shrink-0 flex items-center justify-center transition-colors hover:border-[var(--ok)]"
        style={{ width: 13, height: 13, borderRadius: 3, border: '1px solid var(--border)', flexShrink: 0 }}
      />
      <span className="flex-1 text-xs leading-snug" style={{ color: 'var(--fg)' }}>{t.title}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', color: accent, flexShrink: 0 }}>
        {t.urgency.replace(/_/g, ' ').toUpperCase()}
      </span>
      {t.due_date && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: accent, flexShrink: 0 }}>
          {isOverdue ? `OVERDUE ${fmtDue(t.due_date)}` : fmtDue(t.due_date)}
        </span>
      )}
      <div className="flex flex-col shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ gap: 1 }}>
        <button onClick={() => onReorder(t.id, 'up')} disabled={idx === 0}
          className="text-[8px] leading-none disabled:opacity-20 hover:text-[var(--accent)] transition-colors"
          style={{ color: 'var(--fg-3)' }}>▲</button>
        <button onClick={() => onReorder(t.id, 'down')} disabled={idx === total - 1}
          className="text-[8px] leading-none disabled:opacity-20 hover:text-[var(--accent)] transition-colors"
          style={{ color: 'var(--fg-3)' }}>▼</button>
      </div>
    </div>
  )
}

function BriefingTaskList({ tasks, onComplete, onReorder }: {
  tasks: BriefingTask[]
  onComplete: (id: string) => void
  onReorder: (id: string, dir: 'up' | 'down') => void
}) {
  const today = briefingToday()
  const overdue = tasks.filter(t => t.due_date && t.due_date < today)
  const dueToday = tasks.filter(t => t.due_date === today)
  const label = { fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.10em', textTransform: 'uppercase' as const }

  return (
    <div className="flex flex-col gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
      <span style={{ ...label, color: 'var(--fg-3)' }}>Tasks Due</span>

      {overdue.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span style={{ ...label, color: 'oklch(0.65 0.22 20)' }}>Overdue</span>
          {overdue.map(t => (
            <BriefingTaskRow key={t.id} t={t} idx={tasks.indexOf(t)} total={tasks.length}
              today={today} onComplete={onComplete} onReorder={onReorder} />
          ))}
        </div>
      )}

      {dueToday.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {overdue.length > 0 && <span style={{ ...label, color: 'var(--accent)' }}>Due Today</span>}
          {dueToday.map(t => (
            <BriefingTaskRow key={t.id} t={t} idx={tasks.indexOf(t)} total={tasks.length}
              today={today} onComplete={onComplete} onReorder={onReorder} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Full chat overlay — purpose-built, terminal transcript (no bubbles) ─────────
function SessionChat({ plan, onClose }: { plan: string; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streaming])
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || streaming) return
    const next: Msg[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setStreaming(true)
    setMessages(m => [...m, { role: 'assistant', content: '' }])

    let answer = ''
    try {
      const res = await fetch('/api/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: next, plan }),
      })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          answer += chunk
          setMessages(m => {
            const copy = [...m]
            copy[copy.length - 1] = { role: 'assistant', content: copy[copy.length - 1].content + chunk }
            return copy
          })
        }
      }
      // Persist the completed turn for longer-term continuity
      if (answer.trim()) {
        fetch('/api/brain/conversations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: content, answer }),
        }).catch(() => {})
      }
    } catch {
      setMessages(m => {
        const copy = [...m]
        copy[copy.length - 1] = { role: 'assistant', content: 'Connection error. Try again.' }
        return copy
      })
    }
    setStreaming(false)
  }

  const QUICK = ['Move my afternoon earlier', 'What should I skip?', "How's my recovery?", 'Add a gym block at 6pm']

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-up"
      style={{ background: 'oklch(0.05 0.008 255 / 0.72)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="flex flex-col w-full"
        style={{
          maxWidth: 640, height: '82vh',
          background: 'var(--bg-1)', border: '1px solid var(--accent-glow)', borderRadius: 16,
          boxShadow: '0 24px 80px oklch(0 0 0 / 0.6), 0 0 0 1px var(--accent-dim), 0 0 40px var(--accent-dim)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="card-label dot-online" style={{ color: 'var(--ok)' }}>●</span>
            <span className="card-label" style={{ color: 'var(--fg-2)' }}>TODAY · ASSISTANT</span>
          </div>
          <button onClick={onClose} className="card-label hover:opacity-70 transition-opacity" style={{ color: 'var(--fg-2)' }}>
            ESC ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {/* The plan pinned at top */}
          {plan && (
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-2)', borderLeft: '2px solid var(--accent)', fontSize: 13 }}>
              <div className="card-label mb-2" style={{ color: 'var(--accent)' }}>TODAY&apos;S PLAN</div>
              <Markdown text={plan} />
            </div>
          )}

          {/* Conversation — terminal transcript, not bubbles */}
          {messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} className="flex gap-2 items-start">
                <span className="shrink-0 select-none" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent)', lineHeight: 1.6 }}>›</span>
                <p className="flex-1" style={{ fontSize: 13.5, color: 'var(--fg)', fontWeight: 500, lineHeight: 1.55 }}>{m.content}</p>
              </div>
            ) : (
              <div key={i} className="pl-3" style={{ borderLeft: '2px solid var(--accent-glow)', fontSize: 13 }}>
                {m.content
                  ? <Markdown text={m.content} />
                  : <span className="animate-pulse" style={{ color: 'var(--fg-2)' }}>▋</span>}
              </div>
            )
          ))}
          <div ref={endRef} />
        </div>

        {/* Quick prompts + input */}
        <div className="px-4 py-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border)' }}>
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map(q => (
                <button key={q} onClick={() => send(q)}
                  className="text-[10px] px-2 py-1 rounded-md transition-all hover:brightness-110 active:scale-95"
                  style={{ fontFamily: 'var(--font-mono)', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-glow)' }}>
                  {q}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-center">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>›_</span>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Reshape your day, ask what to skip, move a block…"
              className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg)', fontFamily: 'var(--font-sans)' }}
            />
            <button onClick={() => send()} disabled={streaming || !input.trim()}
              className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-bold transition-all disabled:opacity-30 hover:scale-105 active:scale-95"
              style={{ background: 'var(--accent)', color: 'oklch(0.09 0.008 255)' }}>
              {streaming ? '·' : '↑'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

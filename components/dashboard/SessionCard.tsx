'use client'

import { useEffect, useState, useRef } from 'react'
import { Panel } from './Panel'
import { Markdown } from '@/components/Markdown'

interface Msg { role: 'user' | 'assistant'; content: string }

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Still up, Vinny?'
  if (h < 12) return 'Good morning, Vinny.'
  if (h < 17) return 'Good afternoon, Vinny.'
  if (h < 21) return 'Good evening, Vinny.'
  return 'Winding down, Vinny.'
}

export function SessionCard() {
  const [plan, setPlan] = useState<string>('')
  const [planLoading, setPlanLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    fetch('/api/plan')
      .then(r => r.json())
      .then(d => { setPlan(d.plan ?? ''); setPlanLoading(false) })
      .catch(() => setPlanLoading(false))
  }, [])

  async function refreshPlan() {
    setRefreshing(true)
    try {
      const r = await fetch('/api/plan?refresh=1')
      const d = await r.json()
      setPlan(d.plan ?? '')
    } catch {}
    setRefreshing(false)
  }

  return (
    <>
      <Panel
        index={2}
        title="Session"
        status="online"
        action={
          <button
            onClick={refreshPlan}
            disabled={refreshing}
            className="card-label hover:opacity-70 transition-opacity"
            style={{ color: 'var(--fg-4)' }}
          >
            {refreshing ? 'planning…' : '↻ replan'}
          </button>
        }
      >
        {/* Greeting */}
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
          {greeting()}
        </div>

        {/* Daily plan */}
        {planLoading ? (
          <div className="flex items-center gap-2 py-2" style={{ color: 'var(--fg-4)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>BUILDING YOUR DAY</span>
            <span className="animate-pulse">▋</span>
          </div>
        ) : plan ? (
          <div style={{ fontSize: 13 }}>
            <Markdown text={plan} />
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--fg-4)' }}>
            Couldn&apos;t build a plan — add tasks and connect your calendar, then hit replan.
          </p>
        )}

        {/* Chat affordance */}
        <button
          onClick={() => setChatOpen(true)}
          className="mt-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-150 hover:brightness-110 active:scale-[0.99]"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            background: 'var(--accent-dim)',
            color: 'var(--accent)',
            border: '1px solid var(--accent-glow)',
          }}
        >
          💬 CHAT ABOUT TODAY
        </button>
      </Panel>

      {chatOpen && <SessionChat plan={plan} onClose={() => setChatOpen(false)} />}
    </>
  )
}

// ── Full chat overlay ─────────────────────────────────────────
function SessionChat({ plan, onClose }: { plan: string; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streaming])

  // Close on Escape
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

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: next }),
      })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          setMessages(m => {
            const copy = [...m]
            copy[copy.length - 1] = { role: 'assistant', content: copy[copy.length - 1].content + chunk }
            return copy
          })
        }
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

  const QUICK = ['Reprioritize my day', 'What should I skip?', 'How\'s my recovery?']

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-up"
      style={{ background: 'oklch(0.05 0.008 255 / 0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="flex flex-col w-full"
        style={{
          maxWidth: 620,
          height: '82vh',
          background: 'var(--bg-1)',
          border: '1px solid var(--accent-glow)',
          borderRadius: 16,
          boxShadow: '0 24px 80px oklch(0 0 0 / 0.6), 0 0 0 1px var(--accent-dim), 0 0 40px var(--accent-dim)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="card-label dot-online" style={{ color: 'var(--ok)' }}>●</span>
            <span className="card-label" style={{ color: 'var(--fg-2)' }}>DAILY SESSION</span>
          </div>
          <button onClick={onClose} className="card-label hover:opacity-70 transition-opacity" style={{ color: 'var(--fg-4)' }}>
            ESC ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {/* The plan pinned at top */}
          {plan && (
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 13 }}>
              <div className="card-label mb-2" style={{ color: 'var(--accent)' }}>TODAY&apos;S PLAN</div>
              <Markdown text={plan} />
            </div>
          )}

          {/* Conversation */}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="rounded-2xl px-3.5 py-2.5"
                style={{
                  maxWidth: '85%',
                  fontSize: 13,
                  background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-2)',
                  color: m.role === 'user' ? 'oklch(0.09 0.008 255)' : 'var(--fg)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                }}
              >
                {m.role === 'assistant'
                  ? (m.content ? <Markdown text={m.content} /> : <span className="animate-pulse" style={{ color: 'var(--fg-4)' }}>▋</span>)
                  : m.content}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Quick prompts + input */}
        <div className="px-4 py-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border)' }}>
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-[10px] px-2 py-1 rounded-md transition-all hover:brightness-110 active:scale-95"
                  style={{ fontFamily: 'var(--font-mono)', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-glow)' }}
                >
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
              placeholder="Ask about your day, reprioritize, plan…"
              className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg)', fontFamily: 'var(--font-sans)' }}
            />
            <button
              onClick={() => send()}
              disabled={streaming || !input.trim()}
              className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-bold transition-all disabled:opacity-30 hover:scale-105 active:scale-95"
              style={{ background: 'var(--accent)', color: 'oklch(0.09 0.008 255)' }}
            >
              {streaming ? '·' : '↑'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

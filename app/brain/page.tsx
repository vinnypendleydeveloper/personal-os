'use client'

import { useState, useRef, useEffect } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'
import { Markdown } from '@/components/Markdown'

const SUGGESTIONS = [
  'What should I focus on today?',
  'How is my recovery trending?',
  'What\'s blocking my AI business?',
  'Am I on track for my summer goals?',
  'What tasks need to happen this week?',
  'How have my habits been?',
]

interface SearchResult {
  id: string
  text: string
  source_type: string
  created_at?: string
}

interface ConvMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

const SOURCE_COLOR: Record<string, string> = {
  task:    'var(--warn)',
  capture: 'var(--accent)',
  goal:    'var(--ok)',
  journal: 'oklch(0.74 0.15 200)',
  habit:   'oklch(0.72 0.18 30)',
  note:    'var(--fg-3)',
}

// Local (not UTC) Y-M-D key, matching the rest of the app's date handling.
function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateLabel(key: string): string {
  const today = new Date()
  const todayKey = localKey(today)
  const yest = new Date(today); yest.setDate(yest.getDate() - 1)
  const yestKey = localKey(yest)
  if (key === todayKey) return 'TODAY'
  if (key === yestKey) return 'YESTERDAY'
  return new Date(key + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  }).toUpperCase()
}

// Group chronological messages into date buckets, newest day first,
// messages within a day kept in chronological (oldest→newest) order.
function groupByDate(messages: ConvMsg[]): { date: string; label: string; messages: ConvMsg[] }[] {
  const buckets = new Map<string, ConvMsg[]>()
  for (const m of messages) {
    const key = localKey(new Date(m.created_at))
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(m)
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, msgs]) => ({ date, label: dateLabel(date), messages: msgs }))
}

export default function BrainPage() {
  const [askQuery, setAskQuery] = useState('')
  const [answer, setAnswer]     = useState('')
  const [asking, setAsking]     = useState(false)
  const [answered, setAnswered] = useState(false)

  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [searching, setSearching]         = useState(false)

  const [history, setHistory]             = useState<ConvMsg[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const answerEndRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (answer) answerEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [answer])

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    try {
      const res = await fetch('/api/brain/conversations?limit=200')
      const data = await res.json()
      setHistory(data.messages ?? [])
    } catch {
      setHistory([])
    }
    setLoadingHistory(false)
  }

  async function ask(q?: string) {
    const question = (q ?? askQuery).trim()
    if (!question) return
    setAskQuery(question)
    setAsking(true)
    setAnswer('')
    setAnswered(false)

    let full = ''
    let errored = false
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      if (!res.ok) throw new Error(`AI error (${res.status})`)
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          full += chunk
          setAnswer(prev => prev + chunk)
        }
      }
    } catch {
      errored = true
      setAnswer('Error connecting to AI. Try again.')
    }
    setAsking(false)
    setAnswered(true)

    // Persist the completed turn so the AI remembers it next session.
    if (!errored && full.trim()) {
      try {
        await fetch('/api/brain/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, answer: full }),
        })
        const now = new Date().toISOString()
        setHistory(prev => [
          ...prev,
          { id: `local-u-${now}`, role: 'user', content: question, created_at: now },
          { id: `local-a-${now}`, role: 'assistant', content: full, created_at: now },
        ])
      } catch { /* memory save is best-effort */ }
    }
  }

  async function search() {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch('/api/memory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      })
      const data = await res.json()
      setSearchResults(data.results ?? [])
    } catch {
      setSearchResults([])
    }
    setSearching(false)
  }

  function clear() {
    setAskQuery('')
    setAnswer('')
    setAnswered(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <Shell>
      <div className="flex flex-col gap-6" style={{ maxWidth: 760 }}>

        {/* ── Ask My OS ─────────────────────────────────────────── */}
        <Panel index={1} title="Ask My OS" status="online">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            Remembers every conversation. Knows your tasks, goals, 7-day habits, daily notes, Whoop data, and captures. Gets sharper over time.
          </p>

          {/* Input row */}
          <div className="flex gap-2 items-center">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', flexShrink: 0 }}>›_</span>
            <input
              ref={inputRef}
              value={askQuery}
              onChange={e => setAskQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ask()}
              placeholder="Ask anything about your life, goals, or tasks…"
              className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
                fontFamily: 'var(--font-mono)',
              }}
            />
            {answered ? (
              <button
                onClick={clear}
                className="text-xs px-3 py-2 rounded-lg font-medium transition-opacity hover:opacity-70"
                style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', color: 'var(--fg-3)', border: '1px solid var(--border)' }}
              >CLR</button>
            ) : (
              <button
                onClick={() => ask()}
                disabled={asking || !askQuery.trim()}
                className="text-xs px-3 py-2 rounded-lg font-semibold disabled:opacity-30 transition-all hover:brightness-110"
                style={{ fontFamily: 'var(--font-mono)', background: 'var(--accent)', color: 'oklch(0.09 0.008 255)' }}
              >{asking ? '…' : 'ASK'}</button>
            )}
          </div>

          {/* Suggested questions */}
          {!answer && !asking && (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="text-[10px] px-2 py-1 rounded-md transition-all hover:brightness-110 active:scale-95"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    background: 'var(--accent-dim)',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent-glow)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Streaming answer */}
          {(answer || asking) && (
            <div
              className="rounded-xl p-4 text-sm leading-relaxed relative"
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
                minHeight: 80,
              }}
            >
              {asking && !answer && (
                <div className="flex items-center gap-2" style={{ color: 'var(--fg-4)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>THINKING</span>
                  <span className="animate-pulse">▋</span>
                </div>
              )}
              {answer && <Markdown text={answer} />}
              {asking && answer && <span className="animate-pulse" style={{ color: 'var(--accent)' }}>▋</span>}
              <div ref={answerEndRef} />
            </div>
          )}
        </Panel>

        {/* ── Conversation History ───────────────────────────────── */}
        <Panel index={2} title="Conversation History" action={
          history.length > 0 ? (
            <span className="card-label" style={{ color: 'var(--fg-4)' }}>
              {history.filter(m => m.role === 'user').length} ASKED
            </span>
          ) : undefined
        }>
          {loadingHistory ? (
            <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>Loading memory…</p>
          ) : history.length === 0 ? (
            <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>
              No past conversations yet. Every exchange is remembered and replayed as context next time.
            </p>
          ) : (
            <div className="flex flex-col gap-4 overflow-y-auto pr-1" style={{ maxHeight: 420 }}>
              {groupByDate(history).map(group => (
                <div key={group.date} className="flex flex-col gap-2">
                  <div className="sticky top-0 z-10 -mx-1 px-1 py-1" style={{ background: 'var(--bg-1)' }}>
                    <span className="card-label" style={{ color: 'var(--accent)' }}>{group.label}</span>
                  </div>
                  {group.messages.map(m => (
                    <div
                      key={m.id}
                      className="rounded-lg p-2.5 text-xs leading-relaxed"
                      style={{
                        background: m.role === 'user' ? 'var(--bg-2)' : 'var(--accent-dim)',
                        border: `1px solid ${m.role === 'user' ? 'var(--border)' : 'var(--accent-glow)'}`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.1em',
                          color: m.role === 'user' ? 'var(--fg-3)' : 'var(--accent)',
                        }}>
                          {m.role === 'user' ? 'YOU' : 'OS'}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-4)' }}>
                          {new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                      {m.role === 'assistant'
                        ? <Markdown text={m.content} />
                        : <p style={{ color: 'var(--fg)' }}>{m.content}</p>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* ── Memory Search ──────────────────────────────────────── */}
        <Panel index={3} title="Memory Search">
          <p className="text-xs" style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            Semantic search across all your captures, tasks, and notes.
          </p>
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Search your memory…"
              className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
                fontFamily: 'var(--font-mono)',
              }}
            />
            <button
              onClick={search}
              disabled={searching || !searchQuery.trim()}
              className="text-xs px-3 py-2 rounded-lg font-semibold disabled:opacity-30 hover:brightness-110"
              style={{ fontFamily: 'var(--font-mono)', background: 'var(--accent)', color: 'oklch(0.09 0.008 255)' }}
            >{searching ? '…' : 'SEARCH'}</button>
          </div>

          {searchResults !== null && (
            searchResults.length === 0 ? (
              <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>No results found.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {searchResults.map(r => {
                  const c = SOURCE_COLOR[r.source_type] ?? 'var(--fg-3)'
                  return (
                    <div key={r.id} className="rounded-lg p-3 flex gap-3 items-start" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
                        padding: '2px 6px', borderRadius: 4, flexShrink: 0, marginTop: 2,
                        color: c,
                        background: `color-mix(in oklch, ${c} 14%, transparent)`,
                        border: `1px solid color-mix(in oklch, ${c} 35%, transparent)`,
                      }}>
                        {r.source_type.toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--fg)' }}>{r.text}</p>
                        {r.created_at && (
                          <p className="text-[10px] mt-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>
                            {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </Panel>

      </div>
    </Shell>
  )
}

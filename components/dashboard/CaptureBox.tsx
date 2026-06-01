'use client'

import { useState, KeyboardEvent, useRef, useEffect } from 'react'

export function CaptureBox() {
  const [text, setText] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [classification, setClassification] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        if (!text) setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [text])

  async function submit() {
    if (!text.trim()) return
    setStatus('sending')
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('done')
        setClassification(data.classification?.kind ?? null)
        setText('')
        setExpanded(false)
        setTimeout(() => { setStatus('idle'); setClassification(null) }, 3000)
      } else {
        setStatus('error')
        setTimeout(() => setStatus('idle'), 3000)
      }
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
    if (e.key === 'Escape') { setExpanded(false); setText('') }
  }

  const kindColor: Record<string, string> = {
    task: 'var(--warn)',
    goal: 'var(--ok)',
    note: 'var(--accent)',
    journal: 'var(--accent)',
    other: 'var(--fg-3)',
  }

  return (
    <div
      ref={boxRef}
      className="fixed bottom-5 left-1/2 z-50 transition-all duration-300 ease-out"
      style={{
        transform: 'translateX(-50%)',
        width: expanded ? '520px' : '300px',
      }}
    >
      {/* Toast notification */}
      {status === 'done' && (
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-md text-[11px] font-medium animate-fade-up"
          style={{
            fontFamily: 'var(--font-mono)',
            background: 'var(--ok-dim)',
            border: '1px solid oklch(0.74 0.17 148 / 0.3)',
            color: 'var(--ok)',
          }}
        >
          ✓ CAPTURED{classification ? ` AS ${classification.toUpperCase()}` : ''}
        </div>
      )}
      {status === 'error' && (
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-md text-[11px] font-medium animate-fade-up"
          style={{
            fontFamily: 'var(--font-mono)',
            background: 'var(--hot-dim)',
            border: '1px solid oklch(0.66 0.22 22 / 0.3)',
            color: 'var(--hot)',
          }}
        >
          ✕ ERROR — TRY AGAIN
        </div>
      )}

      {/* Main box */}
      <div
        className={expanded ? 'capture-expanded' : ''}
        style={{
          background: expanded ? 'var(--bg-1)' : 'oklch(0.12 0.010 255 / 0.85)',
          border: `1px solid ${expanded ? 'var(--accent-glow)' : 'var(--border)'}`,
          borderRadius: '10px',
          backdropFilter: 'blur(20px)',
          boxShadow: expanded
            ? '0 8px 40px oklch(0 0 0 / 0.5), 0 0 0 1px var(--accent-dim), 0 0 24px var(--accent-dim)'
            : '0 4px 20px oklch(0 0 0 / 0.4)',
          transition: 'border-color 200ms, box-shadow 200ms',
          padding: '10px 12px',
        }}
      >
        <div className="flex gap-2 items-end">
          {/* Prefix indicator */}
          <span
            className="text-[10px] font-semibold shrink-0 mb-1.5 select-none"
            style={{
              fontFamily: 'var(--font-mono)',
              color: expanded ? 'var(--accent)' : 'var(--fg-4)',
              transition: 'color 200ms',
            }}
          >
            &gt;_
          </span>

          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onFocus={() => setExpanded(true)}
            onKeyDown={handleKey}
            placeholder={expanded ? 'Capture anything… Shift+Enter for new line, Esc to close' : 'Capture anything…'}
            rows={expanded ? 3 : 1}
            className="flex-1 text-[12px] resize-none bg-transparent outline-none leading-relaxed placeholder:transition-opacity"
            style={{
              fontFamily: 'var(--font-sans)',
              color: 'var(--fg)',
              caretColor: 'var(--accent)',
            }}
          />

          <button
            onClick={submit}
            disabled={!text.trim() || status === 'sending'}
            className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold transition-all duration-150 disabled:opacity-30 hover:scale-110 active:scale-95 mb-0.5"
            style={{
              fontFamily: 'var(--font-mono)',
              background: text.trim() ? 'var(--accent)' : 'var(--bg-3)',
              color: text.trim() ? 'oklch(0.09 0.008 255)' : 'var(--fg-4)',
              boxShadow: text.trim() ? '0 0 12px var(--accent-dim)' : 'none',
              transition: 'background 200ms, box-shadow 200ms, transform 150ms',
            }}
          >
            {status === 'sending' ? '·' : '↑'}
          </button>
        </div>

        {/* Expanded hint */}
        {expanded && (
          <div className="flex items-center gap-3 mt-1.5 pt-1.5" style={{ borderTop: '1px solid var(--border)' }}>
            {['task', 'note', 'goal', 'journal'].map(k => (
              <span key={k} className="text-[9px] font-medium" style={{ fontFamily: 'var(--font-mono)', color: kindColor[k] }}>
                {k.toUpperCase()}
              </span>
            ))}
            <span className="ml-auto text-[9px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>AI routes automatically</span>
          </div>
        )}
      </div>
    </div>
  )
}

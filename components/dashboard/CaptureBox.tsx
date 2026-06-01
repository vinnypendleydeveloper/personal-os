'use client'

import { useState, KeyboardEvent, useRef } from 'react'

export function CaptureBox() {
  const [text, setText] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function submit() {
    if (!text.trim()) return
    setStatus('sending')
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      if (res.ok) {
        setText('')
        setStatus('done')
        setExpanded(false)
        setTimeout(() => setStatus('idle'), 2000)
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
    if (e.key === 'Escape') {
      setExpanded(false)
      setText('')
    }
  }

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 transition-all duration-200"
      style={{ width: expanded ? '480px' : '280px' }}
    >
      <div className="panel p-3 shadow-xl" style={{ boxShadow: '0 8px 32px oklch(0 0 0 / 0.4)' }}>
        {status === 'done' && (
          <p className="text-xs text-center font-mono mb-2" style={{ color: 'var(--ok)' }}>✓ Captured</p>
        )}
        {status === 'error' && (
          <p className="text-xs text-center font-mono mb-2" style={{ color: 'var(--danger)' }}>Error — try again</p>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onFocus={() => setExpanded(true)}
            onKeyDown={handleKey}
            placeholder="Capture anything… (Enter to send)"
            rows={expanded ? 3 : 1}
            className="flex-1 text-xs resize-none outline-none bg-transparent"
            style={{ color: 'var(--foreground)', caretColor: 'var(--accent)' }}
          />
          <button
            onClick={submit}
            disabled={!text.trim() || status === 'sending'}
            className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-opacity disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'var(--ink-0)' }}
          >
            {status === 'sending' ? '…' : '↑'}
          </button>
        </div>
      </div>
    </div>
  )
}

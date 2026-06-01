'use client'

import { useEffect, useState } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'

interface Capture {
  id: string
  raw_text: string
  classification: { kind: string; summary: string }
  created_at: string
  source: string
}

export default function JournalPage() {
  const [entries, setEntries] = useState<Capture[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/captures?limit=50')
      .then(r => r.json())
      .then(data => { setEntries(data.captures ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <Shell>
      <div className="max-w-2xl flex flex-col gap-4">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Journal</h1>
        <p className="text-xs" style={{ color: 'var(--ink-4)' }}>
          Everything you've captured — via the dashboard or Telegram.
        </p>
        {loading ? (
          <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Loading…</p>
        ) : entries.length === 0 ? (
          <Panel>
            <p className="text-xs" style={{ color: 'var(--ink-4)' }}>
              No captures yet. Use the capture box at the bottom of the home screen, or the Telegram bot.
            </p>
          </Panel>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map(entry => (
              <Panel key={entry.id}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                    {entry.classification?.kind ?? 'note'}
                  </span>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--ink-2)', color: 'var(--ink-4)' }}>
                    {entry.source}
                  </span>
                  <span className="text-[10px] font-mono ml-auto" style={{ color: 'var(--ink-4)' }}>
                    {new Date(entry.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>{entry.raw_text}</p>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}

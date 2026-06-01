'use client'

import { useState, useRef } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'

interface SearchResult {
  id: string
  text: string
  source_type: string
  created_at?: string
}

export default function BrainPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  const [askQuery, setAskQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [askLoading, setAskLoading] = useState(false)
  const answerRef = useRef<HTMLDivElement>(null)

  async function search() {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    const res = await fetch('/api/memory/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchQuery }),
    })
    const data = await res.json()
    setSearchResults(data.results ?? [])
    setSearchLoading(false)
  }

  async function ask() {
    if (!askQuery.trim()) return
    setAskLoading(true)
    setAnswer('')
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: askQuery }),
    })
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setAnswer(prev => prev + decoder.decode(value))
        answerRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
    setAskLoading(false)
  }

  return (
    <Shell>
      <div className="max-w-2xl flex flex-col gap-6">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Brain</h1>

        {/* Ask my OS */}
        <Panel title="Ask My OS">
          <p className="text-xs" style={{ color: 'var(--ink-4)' }}>
            Ask anything about your captures, tasks, and notes. AI searches your memory and answers with citations.
          </p>
          <div className="flex gap-2">
            <input
              value={askQuery}
              onChange={e => setAskQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ask()}
              placeholder="What was that idea I had about USC orientation?"
              className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
              style={{ background: 'var(--ink-2)', border: '1px solid oklch(1 0 0 / 0.08)', color: 'var(--foreground)' }}
            />
            <button onClick={ask} disabled={askLoading || !askQuery.trim()}
              className="text-xs px-4 py-2 rounded-lg font-medium disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--ink-0)' }}
            >{askLoading ? '…' : 'Ask'}</button>
          </div>
          {answer && (
            <div className="rounded-lg p-3 text-xs leading-relaxed" style={{ background: 'var(--ink-2)', color: 'var(--foreground)' }}>
              {answer}
              <div ref={answerRef} />
            </div>
          )}
        </Panel>

        {/* Memory search */}
        <Panel title="Memory Search">
          <p className="text-xs" style={{ color: 'var(--ink-4)' }}>
            Semantic search across all your captures and entries.
          </p>
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Search your memory…"
              className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
              style={{ background: 'var(--ink-2)', border: '1px solid oklch(1 0 0 / 0.08)', color: 'var(--foreground)' }}
            />
            <button onClick={search} disabled={searchLoading || !searchQuery.trim()}
              className="text-xs px-4 py-2 rounded-lg font-medium disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--ink-0)' }}
            >{searchLoading ? '…' : 'Search'}</button>
          </div>
          {searchResults !== null && (
            searchResults.length === 0
              ? <p className="text-xs" style={{ color: 'var(--ink-4)' }}>No results found.</p>
              : <div className="flex flex-col gap-2 mt-1">
                  {searchResults.map(r => (
                    <div key={r.id} className="rounded-lg p-2.5" style={{ background: 'var(--ink-2)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                          {r.source_type}
                        </span>
                        {r.created_at && (
                          <span className="text-[10px] font-mono" style={{ color: 'var(--ink-4)' }}>
                            {new Date(r.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--foreground)' }}>{r.text}</p>
                    </div>
                  ))}
                </div>
          )}
        </Panel>
      </div>
    </Shell>
  )
}

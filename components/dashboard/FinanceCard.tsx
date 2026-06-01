'use client'

import { useEffect, useState } from 'react'
import { Panel } from './Panel'

interface FinanceSnapshot {
  net_worth: number
  currency: string
  as_of: string
  categories: { name: string; value: number }[]
  notes?: string
  updated_at?: string
}

export function FinanceCard() {
  const [snapshot, setSnapshot] = useState<FinanceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { loadSnapshot() }, [])

  async function loadSnapshot() {
    const res = await fetch('/api/finance')
    const data = await res.json()
    setSnapshot(data.snapshot ?? null)
    setLoading(false)
  }

  async function refresh() {
    setRefreshing(true)
    await fetch('/api/finance/snapshot?refresh=1', { headers: { 'x-api-secret': '' } })
    await loadSnapshot()
    setRefreshing(false)
  }

  const notConfigured = !process.env.NEXT_PUBLIC_SUPABASE_URL // always false — just a placeholder check

  return (
    <Panel title="Finance Pulse" action={
      <button onClick={refresh} disabled={refreshing}
        className="text-[10px] font-mono disabled:opacity-40 transition-opacity"
        style={{ color: 'var(--accent)' }}
      >{refreshing ? 'Refreshing…' : '↻ Refresh'}</button>
    }>
      {loading ? (
        <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Loading…</p>
      ) : !snapshot ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs" style={{ color: 'var(--ink-4)' }}>
            No snapshot yet.
          </p>
          <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
            Add your Google Sheet ID and service account to .env.local, then hit Refresh.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[10px] font-mono" style={{ color: 'var(--ink-4)' }}>NET WORTH</p>
            <p className="text-2xl font-mono font-bold" style={{ color: 'var(--ok)' }}>
              {snapshot.currency === 'USD' ? '$' : ''}{snapshot.net_worth.toLocaleString()}
            </p>
            <p className="text-[10px] font-mono" style={{ color: 'var(--ink-4)' }}>as of {snapshot.as_of}</p>
          </div>

          {snapshot.categories?.length > 0 && (
            <div className="flex flex-col gap-1">
              {snapshot.categories.map(cat => (
                <div key={cat.name} className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--ink-4)' }}>{cat.name}</span>
                  <span className="font-mono" style={{ color: 'var(--foreground)' }}>
                    ${cat.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {snapshot.notes && (
            <p className="text-[10px] italic" style={{ color: 'var(--ink-4)' }}>{snapshot.notes}</p>
          )}
        </div>
      )}
    </Panel>
  )
}

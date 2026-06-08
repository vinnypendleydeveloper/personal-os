'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { Panel } from './Panel'

function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

interface HistoryEntry { date: string; weight_lbs: number }

export function WeightCard() {
  const today = localDate()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/weight?days=30')
      .then(r => r.json())
      .then(d => {
        setHistory(d.history ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [today])

  const todayEntry = history.find(h => h.date === today)
  const weight = todayEntry?.weight_lbs ?? null
  // Compare against the most recent prior entry (not strictly "yesterday"),
  // so the delta still shows for sporadic weigh-ins. History is ascending.
  const prior = weight != null
    ? [...history].reverse().find(h => h.date < today)
    : undefined
  const delta = weight != null && prior ? weight - prior.weight_lbs : null

  const chartData = history.map(h => ({ v: h.weight_lbs }))

  return (
    <Panel index={9} title="Weight" action={
      <Link href="/weight" className="font-mono text-[10px] hover:brightness-125 transition-all" style={{ color: 'var(--fg-2)' }}>
        ALL →
      </Link>
    }>
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1.5">
          {loading ? (
            <span className="font-mono text-sm" style={{ color: 'var(--fg-2)' }}>—</span>
          ) : weight != null ? (
            <>
              <span className="font-mono font-bold" style={{ fontSize: '2rem', lineHeight: 1, color: 'var(--warn)' }}>
                {weight.toFixed(1)}
              </span>
              <span className="font-mono text-xs" style={{ color: 'var(--fg-3)' }}>lbs</span>
            </>
          ) : (
            <span className="font-mono text-sm" style={{ color: 'var(--fg-2)' }}>not logged</span>
          )}
        </div>
        {delta != null && (
          <span
            className="font-mono text-xs font-semibold"
            style={{ color: delta < 0 ? 'var(--ok)' : delta > 0 ? 'var(--hot)' : 'var(--fg-2)' }}
          >
            {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {Math.abs(delta).toFixed(1)}
          </span>
        )}
      </div>

      {chartData.length > 1 && (
        <div style={{ height: 48, marginLeft: -4, marginRight: -4 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div style={{
                      background: 'var(--bg-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--warn)',
                    }}>
                      {Number(payload[0].value).toFixed(1)} lbs
                    </div>
                  )
                }}
              />
              <Line
                type="monotone"
                dataKey="v"
                stroke="var(--warn)"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: 'var(--warn)', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {!loading && chartData.length === 0 && (
        <p className="font-mono text-[10px]" style={{ color: 'var(--fg-2)' }}>
          Log weight in Morning Routine
        </p>
      )}
    </Panel>
  )
}

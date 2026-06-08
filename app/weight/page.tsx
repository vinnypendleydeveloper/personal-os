'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer,
  Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'

interface WeightEntry { date: string; weight_lbs: number }

function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function fmtDate(d: string) {
  const [, m, day] = d.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(day)}`
}

export default function WeightPage() {
  const today = localDate()
  const [history, setHistory] = useState<WeightEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [saved, setSaved] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/weight?days=365').then(r => r.json()),
      fetch(`/api/weight?date=${today}`).then(r => r.json()),
    ]).then(([hist, todayEntry]) => {
      setHistory(hist.history ?? [])
      if (todayEntry.weight_lbs != null) {
        setSaved(todayEntry.weight_lbs)
        setInput(todayEntry.weight_lbs.toFixed(1))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [today])

  async function save() {
    const val = parseFloat(input)
    if (saving) return
    if (!val || val < 50 || val > 999) { setError('Enter a weight between 50–999 lbs'); return }
    const rounded = Math.round(val * 10) / 10
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, weight_lbs: rounded }),
      })
      if (!res.ok) throw new Error()
      setSaved(rounded)
      setInput(rounded.toFixed(1))
      setDirty(false)
      const hist = await fetch('/api/weight?days=365').then(r => r.json())
      setHistory(hist.history ?? [])
    } catch {
      setError('Could not save — try again')
    }
    setSaving(false)
  }

  const weights = history.map(d => d.weight_lbs)
  const current = history[history.length - 1]?.weight_lbs ?? null
  const minW = weights.length ? Math.min(...weights) : null
  const maxW = weights.length ? Math.max(...weights) : null

  const ago30 = new Date(today)
  ago30.setDate(ago30.getDate() - 30)
  const ago30Str = ago30.toISOString().split('T')[0]
  const inWindow = history.length >= 2 && history[0].date <= ago30Str
  const baseline = inWindow ? [...history].reverse().find(d => d.date <= ago30Str) : undefined
  const trend = current != null && baseline ? current - baseline.weight_lbs : null

  const chartData = history.map(d => ({ date: d.date.slice(5), weight: d.weight_lbs }))
  const weightDomain: [number, number] | undefined = weights.length >= 2
    ? [Math.floor(Math.min(...weights) - 3), Math.ceil(Math.max(...weights) + 3)]
    : undefined

  const isEditing = dirty || saved == null

  return (
    <Shell>
      <div className="flex flex-col gap-4" style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--fg)' }}>
            WEIGHT
          </h1>
          {current != null && (
            <div className="flex items-baseline gap-1.5">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--warn)', lineHeight: 1 }}>
                {current.toFixed(1)}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)' }}>lbs</span>
            </div>
          )}
        </div>

        {/* Today's log */}
        <Panel index={0} title="Today" action={
          saved != null && !dirty
            ? <span className="font-mono text-[10px]" style={{ color: 'var(--ok)' }}>LOGGED ●</span>
            : <span className="font-mono text-[10px]" style={{ color: 'var(--hot)' }}>NOT LOGGED</span>
        }>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="number"
                min={50} max={999} step={0.1}
                value={input}
                onChange={e => { setInput(e.target.value); setDirty(true); if (error) setError(null) }}
                onKeyDown={e => e.key === 'Enter' && save()}
                placeholder="0.0"
                className="w-full font-mono font-bold rounded px-3 py-2 outline-none text-right"
                style={{
                  fontSize: '1.75rem',
                  background: 'var(--bg-2)',
                  border: `1px solid ${isEditing ? 'var(--warn)' : 'var(--border)'}`,
                  color: 'var(--warn)',
                  boxShadow: isEditing ? '0 0 8px oklch(0.82 0.16 76 / 0.15)' : 'none',
                  transition: 'border-color 200ms, box-shadow 200ms',
                }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs pointer-events-none" style={{ color: 'var(--fg-2)' }}>
                lbs
              </span>
            </div>
            {isEditing && (
              <button
                onClick={save}
                disabled={saving || !input || parseFloat(input) <= 0}
                className="font-mono text-xs px-5 py-3 rounded font-bold disabled:opacity-40 hover:brightness-110 shrink-0"
                style={{ background: 'var(--warn)', color: 'var(--bg)', transition: 'filter 150ms' }}
              >
                {saving ? '…' : 'LOG'}
              </button>
            )}
          </div>
          {error && <p className="font-mono text-[10px]" style={{ color: 'var(--hot)' }}>{error}</p>}
          {!error && saved != null && !dirty && (
            <p className="font-mono text-[10px]" style={{ color: 'var(--fg-2)' }}>
              {saved.toFixed(1)} lbs logged today · click to update
            </p>
          )}
        </Panel>

        {/* Stats row */}
        {weights.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'CURRENT', value: current?.toFixed(1) ?? '—', color: 'var(--warn)' },
              { label: 'MIN', value: minW?.toFixed(1) ?? '—', color: 'var(--ok)' },
              { label: 'MAX', value: maxW?.toFixed(1) ?? '—', color: 'var(--hot)' },
              {
                label: inWindow ? '30D TREND' : 'TREND',
                value: trend != null ? `${trend > 0 ? '+' : ''}${trend.toFixed(1)}` : '—',
                color: trend == null ? 'var(--fg-2)' : trend < 0 ? 'var(--ok)' : trend > 0 ? 'var(--hot)' : 'var(--fg-2)',
              },
            ].map(s => (
              <div key={s.label} className="rounded p-3 text-center" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                <div className="font-mono text-base font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[9px] font-mono tracking-wider mt-0.5" style={{ color: 'var(--fg-2)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* History chart */}
        <Panel title="History">
          {loading ? (
            <p className="font-mono text-xs" style={{ color: 'var(--fg-2)' }}>Loading…</p>
          ) : chartData.length < 2 ? (
            <p className="font-mono text-xs" style={{ color: 'var(--fg-2)' }}>
              {chartData.length === 0 ? 'No entries yet. Log your first weight above.' : 'Log at least 2 days to see the chart.'}
            </p>
          ) : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--fg-2)' }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.max(0, Math.floor(chartData.length / 6) - 1)}
                  />
                  <YAxis
                    domain={weightDomain}
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--fg-2)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => `${v}`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 10px' }}>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-2)', marginBottom: 2 }}>{label}</p>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--warn)' }}>
                            {Number(payload[0].value).toFixed(1)} lbs
                          </p>
                        </div>
                      )
                    }}
                  />
                  {current != null && (
                    <ReferenceLine y={current} stroke="oklch(0.82 0.16 76 / 0.25)" strokeDasharray="3 4" />
                  )}
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="var(--warn)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: 'var(--warn)', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        {/* Log table */}
        {history.length > 0 && (
          <Panel title="Log">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {['DATE', 'WEIGHT', 'CHANGE'].map((h, i) => (
                    <th
                      key={h}
                      className={`font-mono text-[10px] uppercase tracking-widest pb-2 ${i > 0 ? 'text-right' : 'text-left'}`}
                      style={{ color: 'var(--fg-2)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((entry, idx, arr) => {
                  const prev = arr[idx + 1]
                  const delta = prev ? entry.weight_lbs - prev.weight_lbs : null
                  const isToday = entry.date === today
                  return (
                    <tr key={entry.date} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-1.5 font-mono" style={{ color: isToday ? 'var(--accent)' : 'var(--fg)' }}>
                        {isToday ? 'TODAY' : fmtDate(entry.date)}
                      </td>
                      <td className="py-1.5 text-right font-mono font-bold" style={{ color: 'var(--warn)' }}>
                        {entry.weight_lbs.toFixed(1)} lbs
                      </td>
                      <td className="py-1.5 text-right font-mono text-[11px]" style={{
                        color: delta == null ? 'var(--fg-2)' : delta < 0 ? 'var(--ok)' : delta > 0 ? 'var(--hot)' : 'var(--fg-2)',
                      }}>
                        {delta == null ? '—' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Panel>
        )}
      </div>
    </Shell>
  )
}

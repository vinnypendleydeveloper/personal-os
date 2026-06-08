'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer,
  Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'
import { WaterCard } from '@/components/dashboard/WaterCard'

interface WaterDay { date: string; total_ml: number }
interface WeightDay { date: string; weight_lbs: number }

const GOAL_ML = 3000

function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function HealthPage() {
  const today = localDate()
  const [waterHistory, setWaterHistory] = useState<WaterDay[]>([])
  const [weightHistory, setWeightHistory] = useState<WeightDay[]>([])
  const [loadingWater, setLoadingWater] = useState(true)
  const [loadingWeight, setLoadingWeight] = useState(true)

  useEffect(() => {
    fetch('/api/water?days=30')
      .then(r => r.json())
      .then(d => { setWaterHistory(d.history ?? []); setLoadingWater(false) })
      .catch(() => setLoadingWater(false))

    fetch('/api/weight?days=365')
      .then(r => r.json())
      .then(d => { setWeightHistory(d.history ?? []); setLoadingWeight(false) })
      .catch(() => setLoadingWeight(false))
  }, [])

  // ── Water stats ──────────────────────────────────────────
  const loggedWaterDays = waterHistory.filter(d => d.total_ml > 0)
  const avgMl = loggedWaterDays.length > 0
    ? Math.round(loggedWaterDays.reduce((s, d) => s + d.total_ml, 0) / loggedWaterDays.length)
    : 0
  const goalsMet = loggedWaterDays.filter(d => d.total_ml >= GOAL_ML).length

  // ── Weight stats ─────────────────────────────────────────
  const weights = weightHistory.map(d => d.weight_lbs)
  const current = weightHistory[weightHistory.length - 1]?.weight_lbs ?? null
  const minW = weights.length ? Math.min(...weights) : null
  const maxW = weights.length ? Math.max(...weights) : null
  // Nearest logged entry on or before 30 days ago (history is ascending by date)
  const ago30 = new Date(today)
  ago30.setDate(ago30.getDate() - 30)
  const ago30Str = ago30.toISOString().split('T')[0]
  const inWindow = weightHistory.length >= 2
    && weightHistory[0].date <= ago30Str   // only label "30D" if data spans ≥30 days
  const baseline = inWindow
    ? [...weightHistory].reverse().find(d => d.date <= ago30Str)
    : undefined
  const trend = current != null && baseline ? current - baseline.weight_lbs : null
  const trendLabel = baseline ? '30D TREND' : 'TREND'

  const weightChartData = weightHistory.map(d => ({
    date: d.date.slice(5),   // MM-DD
    weight: d.weight_lbs,
  }))

  const weightDomain: [number, number] | undefined = weights.length >= 2
    ? [Math.floor(Math.min(...weights) - 3), Math.ceil(Math.max(...weights) + 3)]
    : undefined

  return (
    <Shell>
      <div className="flex flex-col gap-4 max-w-2xl">
        <h1 className="text-lg font-semibold font-mono" style={{ color: 'var(--fg)' }}>
          HEALTH
        </h1>

        {/* ── Weight ──────────────────────────────────────── */}
        {weights.length > 0 && (
          <Panel title="Weight History">
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'CURRENT', value: current != null ? current.toFixed(1) : '—', color: 'var(--warn)' },
                { label: 'MIN', value: minW != null ? minW.toFixed(1) : '—', color: 'var(--ok)' },
                { label: 'MAX', value: maxW != null ? maxW.toFixed(1) : '—', color: 'var(--hot)' },
                {
                  label: trendLabel,
                  value: trend != null
                    ? `${trend > 0 ? '+' : ''}${trend.toFixed(1)}`
                    : '—',
                  color: trend == null ? 'var(--fg-2)' : trend < 0 ? 'var(--ok)' : trend > 0 ? 'var(--hot)' : 'var(--fg-2)',
                },
              ].map(s => (
                <div key={s.label} className="rounded p-2" style={{ background: 'var(--bg-2)' }}>
                  <div className="font-mono text-base font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[9px] font-mono tracking-wider" style={{ color: 'var(--fg-2)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Line chart */}
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightChartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid
                    strokeDasharray="2 4"
                    stroke="oklch(1 0 0 / 0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--fg-2)' }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.max(0, Math.floor(weightChartData.length / 6) - 1)}
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
                        <div style={{
                          background: 'var(--bg-2)',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          padding: '6px 10px',
                        }}>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-2)', marginBottom: 2 }}>
                            {label}
                          </p>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--warn)' }}>
                            {Number(payload[0].value).toFixed(1)} lbs
                          </p>
                        </div>
                      )
                    }}
                  />
                  {current != null && (
                    <ReferenceLine
                      y={current}
                      stroke="oklch(0.82 0.16 76 / 0.25)"
                      strokeDasharray="3 4"
                    />
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
          </Panel>
        )}

        {loadingWeight && (
          <Panel title="Weight History">
            <p className="font-mono text-xs" style={{ color: 'var(--fg-2)' }}>Loading…</p>
          </Panel>
        )}

        {!loadingWeight && weights.length === 0 && (
          <Panel title="Weight History">
            <p className="font-mono text-xs" style={{ color: 'var(--fg-2)' }}>
              No weight data yet. Log your weight in the Morning Routine.
            </p>
          </Panel>
        )}

        {/* ── Hydration ───────────────────────────────────── */}
        <WaterCard />

        {loggedWaterDays.length > 0 && (
          <Panel title="Hydration — 30-Day Summary">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'AVG / DAY', value: avgMl.toLocaleString() + ' ml', color: 'var(--water)' },
                { label: 'GOAL DAYS', value: `${goalsMet} / ${loggedWaterDays.length}`, color: 'var(--ok)' },
                { label: 'AVG %', value: Math.round((avgMl / GOAL_ML) * 100) + '%', color: 'var(--accent)' },
              ].map(s => (
                <div key={s.label} className="rounded p-2" style={{ background: 'var(--bg-2)' }}>
                  <div className="font-mono text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[9px] font-mono tracking-wider" style={{ color: 'var(--fg-2)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* History table */}
        <Panel>
          {loadingWater ? (
            <p className="text-xs font-mono" style={{ color: 'var(--fg-2)' }}>Loading…</p>
          ) : loggedWaterDays.length === 0 ? (
            <p className="text-xs font-mono" style={{ color: 'var(--fg-2)' }}>
              No water data yet. Log your first drink above.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: 'var(--fg-2)' }}>
                  <th className="text-left font-mono text-[10px] uppercase tracking-widest pb-2">Date</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-widest pb-2">Total</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-widest pb-2">%</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-widest pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {loggedWaterDays.map(day => {
                  const pct = Math.min(100, Math.round((day.total_ml / GOAL_ML) * 100))
                  const met = day.total_ml >= GOAL_ML
                  return (
                    <tr key={day.date} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2 font-mono" style={{ color: 'var(--fg)' }}>{day.date}</td>
                      <td className="py-2 text-right font-mono font-bold" style={{ color: 'var(--water)' }}>
                        {day.total_ml.toLocaleString()} ml
                      </td>
                      <td className="py-2 text-right font-mono" style={{ color: met ? 'var(--ok)' : 'var(--fg-3)' }}>
                        {pct}%
                      </td>
                      <td className="py-2 text-right">
                        <span
                          className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                          style={met
                            ? { color: 'var(--ok)', background: 'var(--ok-dim)' }
                            : { color: 'var(--warn)', background: 'var(--warn-dim)' }
                          }
                        >
                          {met ? 'MET' : 'PARTIAL'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </Shell>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'

interface DayData {
  date: string
  meals: { id: string; n: string; kcal: number; p: number; c: number; f: number }[]
}

export default function HealthPage() {
  const [days, setDays] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/nutrition?days=30')
      .then(r => r.json())
      .then(data => { setDays(data.days ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const loggedDays = days.filter(d => d.meals?.length > 0)
  const avg = loggedDays.length > 0 ? {
    kcal: Math.round(loggedDays.reduce((s, d) => s + d.meals.reduce((a, m) => a + m.kcal, 0), 0) / loggedDays.length),
    p: Math.round(loggedDays.reduce((s, d) => s + d.meals.reduce((a, m) => a + m.p, 0), 0) / loggedDays.length),
    c: Math.round(loggedDays.reduce((s, d) => s + d.meals.reduce((a, m) => a + m.c, 0), 0) / loggedDays.length),
    f: Math.round(loggedDays.reduce((s, d) => s + d.meals.reduce((a, m) => a + m.f, 0), 0) / loggedDays.length),
  } : null

  return (
    <Shell>
      <div className="flex flex-col gap-4 max-w-2xl">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Health — 30 Day Log</h1>

        {avg && (
          <Panel title="30-Day Averages (logged days only)">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'KCAL', value: avg.kcal, color: 'var(--warn)' },
                { label: 'PROTEIN', value: avg.p + 'g', color: 'var(--ok)' },
                { label: 'CARBS', value: avg.c + 'g', color: 'var(--accent)' },
                { label: 'FAT', value: avg.f + 'g', color: 'var(--danger)' },
              ].map(s => (
                <div key={s.label} className="rounded p-2" style={{ background: 'var(--ink-2)' }}>
                  <div className="font-mono text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[9px] font-mono" style={{ color: 'var(--ink-4)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <Panel>
          {loading ? (
            <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Loading…</p>
          ) : loggedDays.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--ink-4)' }}>No nutrition data yet. Add meals from the home dashboard.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: 'var(--ink-4)' }}>
                  <th className="text-left font-mono text-[10px] uppercase tracking-widest pb-2">Date</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-widest pb-2">Meals</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-widest pb-2">KCAL</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-widest pb-2">P</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-widest pb-2">C</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-widest pb-2">F</th>
                </tr>
              </thead>
              <tbody>
                {loggedDays.map(day => {
                  const totals = day.meals.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { kcal: 0, p: 0, c: 0, f: 0 })
                  const expanded = expandedDate === day.date
                  return (
                    <>
                      <tr key={day.date}
                        onClick={() => setExpandedDate(expanded ? null : day.date)}
                        className="cursor-pointer hover:opacity-80 transition-opacity border-t"
                        style={{ borderColor: 'oklch(1 0 0 / 0.06)' }}
                      >
                        <td className="py-2 font-mono" style={{ color: 'var(--foreground)' }}>{day.date}</td>
                        <td className="py-2 text-right" style={{ color: 'var(--ink-4)' }}>{day.meals.length}</td>
                        <td className="py-2 text-right font-mono font-bold" style={{ color: 'var(--warn)' }}>{Math.round(totals.kcal)}</td>
                        <td className="py-2 text-right font-mono" style={{ color: 'var(--ok)' }}>{Math.round(totals.p)}g</td>
                        <td className="py-2 text-right font-mono" style={{ color: 'var(--accent)' }}>{Math.round(totals.c)}g</td>
                        <td className="py-2 text-right font-mono" style={{ color: 'var(--danger)' }}>{Math.round(totals.f)}g</td>
                      </tr>
                      {expanded && day.meals.map(meal => (
                        <tr key={meal.id} style={{ background: 'oklch(1 0 0 / 0.02)' }}>
                          <td className="py-1 pl-4 text-[11px]" colSpan={2} style={{ color: 'var(--ink-4)' }}>↳ {meal.n}</td>
                          <td className="py-1 text-right text-[11px] font-mono" style={{ color: 'var(--warn)' }}>{Math.round(meal.kcal)}</td>
                          <td className="py-1 text-right text-[11px] font-mono" style={{ color: 'var(--ok)' }}>{Math.round(meal.p)}g</td>
                          <td className="py-1 text-right text-[11px] font-mono" style={{ color: 'var(--accent)' }}>{Math.round(meal.c)}g</td>
                          <td className="py-1 text-right text-[11px] font-mono" style={{ color: 'var(--danger)' }}>{Math.round(meal.f)}g</td>
                        </tr>
                      ))}
                    </>
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

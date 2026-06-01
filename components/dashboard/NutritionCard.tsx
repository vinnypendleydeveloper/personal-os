'use client'

import { useEffect, useState, useRef } from 'react'
import { Panel } from './Panel'

interface Meal {
  id: string
  n: string   // name
  kcal: number
  p: number   // protein
  c: number   // carbs
  f: number   // fat
  estimated: boolean
}

function localDateKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function NutritionCard() {
  const today = localDateKey()
  const storageKey = `pos-nutrition-${today}`

  const [meals, setMeals] = useState<Meal[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      const cached = localStorage.getItem(storageKey)
      if (cached) setMeals(JSON.parse(cached))
    } catch {}
    fetch(`/api/nutrition?days=1`)
      .then(r => r.json())
      .then(data => {
        const todayData = data.days?.find((d: { date: string }) => d.date === today)
        if (todayData?.meals) {
          setMeals(todayData.meals)
          localStorage.setItem(storageKey, JSON.stringify(todayData.meals))
        }
      }).catch(() => {})
  }, [today, storageKey])

  function saveMeals(next: Meal[]) {
    localStorage.setItem(storageKey, JSON.stringify(next))
    fetch('/api/nutrition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, meals: next }),
    }).catch(console.error)
  }

  async function addMeal() {
    if (!input.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/nutrition/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input.trim() }),
      })
      const macros = await res.json()
      const meal: Meal = { id: crypto.randomUUID(), n: input.trim(), estimated: true, ...macros }
      const next = [...meals, meal]
      setMeals(next)
      saveMeals(next)
      setInput('')
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  function updateMacro(id: string, field: 'kcal' | 'p' | 'c' | 'f', value: number) {
    const next = meals.map(m => {
      if (m.id !== id) return m
      const updated = { ...m, [field]: value }
      if (field !== 'kcal') {
        updated.kcal = Math.round(4 * updated.p + 4 * updated.c + 9 * updated.f)
      }
      return updated
    })
    setMeals(next)
    localStorage.setItem(storageKey, JSON.stringify(next))

    if (field === 'kcal') {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        const meal = next.find(m => m.id === id)!
        const res = await fetch('/api/nutrition/redistribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: meal.n, kcal: value }),
        })
        const macros = await res.json()
        const redistributed = next.map(m => m.id === id ? { ...m, ...macros } : m)
        setMeals(redistributed)
        saveMeals(redistributed)
      }, 600)
    } else {
      saveMeals(next)
    }
  }

  function removeMeal(id: string) {
    const next = meals.filter(m => m.id !== id)
    setMeals(next)
    saveMeals(next)
    if (editId === id) setEditId(null)
  }

  const totals = meals.reduce((acc, m) => ({
    kcal: acc.kcal + m.kcal,
    p: acc.p + m.p,
    c: acc.c + m.c,
    f: acc.f + m.f,
  }), { kcal: 0, p: 0, c: 0, f: 0 })

  return (
    <Panel title="Nutrition">
      {/* Totals bar */}
      {meals.length > 0 && (
        <div className="grid grid-cols-4 gap-1 text-center">
          {[
            { label: 'KCAL', value: Math.round(totals.kcal), color: 'var(--warn)' },
            { label: 'P', value: Math.round(totals.p) + 'g', color: 'var(--ok)' },
            { label: 'C', value: Math.round(totals.c) + 'g', color: 'var(--accent)' },
            { label: 'F', value: Math.round(totals.f) + 'g', color: 'var(--danger)' },
          ].map(stat => (
            <div key={stat.label} className="rounded p-1.5" style={{ background: 'var(--ink-2)' }}>
              <div className="font-mono text-sm font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-[9px] font-mono" style={{ color: 'var(--ink-4)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Meal list */}
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
        {meals.map(meal => (
          <div key={meal.id}>
            <div
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => setEditId(editId === meal.id ? null : meal.id)}
            >
              <p className="text-xs flex-1 truncate" style={{ color: 'var(--foreground)' }}>{meal.n}</p>
              <span className="font-mono text-[10px]" style={{ color: 'var(--warn)' }}>{Math.round(meal.kcal)}</span>
              <button onClick={e => { e.stopPropagation(); removeMeal(meal.id) }}
                className="opacity-0 group-hover:opacity-100 text-[10px] transition-opacity"
                style={{ color: 'var(--danger)' }}
              >✕</button>
            </div>
            {editId === meal.id && (
              <div className="grid grid-cols-4 gap-1 mt-1">
                {(['kcal', 'p', 'c', 'f'] as const).map(field => (
                  <div key={field} className="flex flex-col gap-0.5">
                    <label className="text-[9px] font-mono uppercase text-center" style={{ color: 'var(--ink-4)' }}>{field}</label>
                    <input
                      type="number"
                      value={Math.round(meal[field])}
                      onChange={e => updateMacro(meal.id, field, parseFloat(e.target.value) || 0)}
                      className="w-full text-center text-xs px-1 py-0.5 rounded outline-none font-mono"
                      style={{ background: 'var(--ink-2)', color: 'var(--foreground)', border: '1px solid oklch(1 0 0 / 0.08)' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add meal input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addMeal()}
          placeholder="Add a meal…"
          className="flex-1 text-xs px-2 py-1.5 rounded outline-none"
          style={{ background: 'var(--ink-2)', border: '1px solid oklch(1 0 0 / 0.08)', color: 'var(--foreground)' }}
        />
        <button onClick={addMeal} disabled={loading || !input.trim()}
          className="text-xs px-3 py-1.5 rounded font-medium disabled:opacity-40"
          style={{ background: 'var(--accent)', color: 'var(--ink-0)' }}
        >{loading ? '…' : '+'}
        </button>
      </div>
    </Panel>
  )
}

'use client'

import { useEffect, useState, KeyboardEvent } from 'react'
import { Panel } from './Panel'

interface GoalItem {
  id: string
  text: string
  done: boolean
}

export function GoalsCard() {
  const [weekItems, setWeekItems] = useState<GoalItem[]>([])
  const [monthItems, setMonthItems] = useState<GoalItem[]>([])
  const [weekInput, setWeekInput] = useState('')
  const [monthInput, setMonthInput] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/goals')
      .then(r => r.json())
      .then(data => {
        setWeekItems(data.week ?? [])
        setMonthItems(data.month ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function save(week: GoalItem[], month: GoalItem[]) {
    fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week, month }),
    }).catch(console.error)
  }

  function addGoal(scope: 'week' | 'month') {
    const text = scope === 'week' ? weekInput.trim() : monthInput.trim()
    if (!text) return
    const item: GoalItem = { id: crypto.randomUUID(), text, done: false }
    if (scope === 'week') {
      const next = [...weekItems, item]
      setWeekItems(next)
      setWeekInput('')
      save(next, monthItems)
    } else {
      const next = [...monthItems, item]
      setMonthItems(next)
      setMonthInput('')
      save(weekItems, next)
    }
  }

  function toggle(scope: 'week' | 'month', id: string) {
    if (scope === 'week') {
      const next = weekItems.map(i => i.id === id ? { ...i, done: !i.done } : i)
      setWeekItems(next)
      save(next, monthItems)
    } else {
      const next = monthItems.map(i => i.id === id ? { ...i, done: !i.done } : i)
      setMonthItems(next)
      save(weekItems, next)
    }
  }

  function remove(scope: 'week' | 'month', id: string) {
    if (scope === 'week') {
      const next = weekItems.filter(i => i.id !== id)
      setWeekItems(next)
      save(next, monthItems)
    } else {
      const next = monthItems.filter(i => i.id !== id)
      setMonthItems(next)
      save(weekItems, next)
    }
  }

  return (
    <Panel index={5} title="Goals">
      {loading ? (
        <div className="text-xs" style={{ color: 'var(--ink-4)' }}>Loading…</div>
      ) : (
        <div className="flex flex-col gap-4">
          <GoalSection
            label="This Week"
            items={weekItems}
            input={weekInput}
            onInputChange={setWeekInput}
            onAdd={() => addGoal('week')}
            onToggle={id => toggle('week', id)}
            onRemove={id => remove('week', id)}
          />
          <div className="h-px" style={{ background: 'oklch(1 0 0 / 0.06)' }} />
          <GoalSection
            label="This Month"
            items={monthItems}
            input={monthInput}
            onInputChange={setMonthInput}
            onAdd={() => addGoal('month')}
            onToggle={id => toggle('month', id)}
            onRemove={id => remove('month', id)}
          />
        </div>
      )}
    </Panel>
  )
}

function GoalSection({
  label, items, input, onInputChange, onAdd, onToggle, onRemove
}: {
  label: string
  items: GoalItem[]
  input: string
  onInputChange: (v: string) => void
  onAdd: () => void
  onToggle: (id: string) => void
  onRemove: (id: string) => void
}) {
  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onAdd()
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-mono font-semibold uppercase tracking-widest" style={{ color: 'var(--ink-4)' }}>
        {label}
      </span>
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-2 group">
          <button onClick={() => onToggle(item.id)}
            className="w-4 h-4 rounded shrink-0 border flex items-center justify-center transition-colors"
            style={{ background: item.done ? 'var(--ok)' : 'transparent', borderColor: item.done ? 'var(--ok)' : 'oklch(1 0 0 / 0.2)' }}
          >
            {item.done && <span className="text-[10px] text-black">✓</span>}
          </button>
          <span className="text-xs flex-1" style={{ color: item.done ? 'var(--ink-4)' : 'var(--foreground)', textDecoration: item.done ? 'line-through' : 'none' }}>
            {item.text}
          </span>
          <button onClick={() => onRemove(item.id)}
            className="opacity-0 group-hover:opacity-100 text-[10px] transition-opacity"
            style={{ color: 'var(--danger)' }}
          >✕</button>
        </div>
      ))}
      <div className="flex gap-2 mt-1">
        <input
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Add a goal…"
          className="flex-1 text-xs px-2 py-1 rounded outline-none"
          style={{ background: 'var(--ink-2)', border: '1px solid oklch(1 0 0 / 0.08)', color: 'var(--foreground)' }}
        />
        <button onClick={onAdd}
          className="text-xs px-2 py-1 rounded"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
        >+</button>
      </div>
    </div>
  )
}

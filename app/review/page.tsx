'use client'

import { useEffect, useState } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Panel } from '@/components/dashboard/Panel'

interface Review {
  wins: string
  slipped: string
  openLoops: string
  followUp: string
  healthPattern: string
  nextWeekTop3: string
}

const EMPTY: Review = {
  wins: '',
  slipped: '',
  openLoops: '',
  followUp: '',
  healthPattern: '',
  nextWeekTop3: '',
}

function weekLabel() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
  return `W${String(week).padStart(2, '0')}`
}

export default function ReviewPage() {
  const [review, setReview] = useState<Review>(EMPTY)
  const [week, setWeek] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setWeek(weekLabel())
    fetch('/api/review')
      .then(r => r.json())
      .then(data => {
        if (data.review) setReview(data.review)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function Field({ label, field, placeholder, rows = 3 }: {
    label: string
    field: keyof Review
    placeholder: string
    rows?: number
  }) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-mono font-semibold uppercase tracking-widest" style={{ color: 'var(--ink-4)' }}>
          {label}
        </label>
        <textarea
          value={review[field]}
          onChange={e => setReview(prev => ({ ...prev, [field]: e.target.value }))}
          placeholder={placeholder}
          rows={rows}
          className="w-full text-xs px-3 py-2 rounded-lg outline-none resize-none leading-relaxed"
          style={{
            background: 'var(--ink-2)',
            border: '1px solid oklch(1 0 0 / 0.08)',
            color: 'var(--foreground)',
          }}
        />
      </div>
    )
  }

  return (
    <Shell>
      <div className="max-w-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold font-mono" style={{ color: 'var(--foreground)' }}>
              WEEKLY REVIEW · {week}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-4)' }}>
              Auto-saved to your journal. Seal the week.
            </p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-mono font-medium disabled:opacity-40 transition-opacity"
            style={{ background: saved ? 'var(--ok)' : 'var(--accent)', color: 'var(--ink-0)' }}
          >
            {saving ? 'SAVING…' : saved ? '✓ SEALED' : 'SEAL WEEK'}
          </button>
        </div>

        {loading ? (
          <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Loading…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Panel index={1} title="Wins This Week">
              <Field
                label=""
                field="wins"
                placeholder="What shipped? What closed? What did you actually do?"
                rows={3}
              />
            </Panel>

            <Panel index={2} title="What Slipped">
              <Field
                label=""
                field="slipped"
                placeholder="What didn't happen? What got delayed or dropped?"
                rows={2}
              />
            </Panel>

            <Panel index={3} title="Open Loops">
              <Field
                label=""
                field="openLoops"
                placeholder="Unresolved threads, waiting-on items, things that need a next action…"
                rows={2}
              />
            </Panel>

            <Panel index={4} title="People to Follow Up With">
              <Field
                label=""
                field="followUp"
                placeholder="Names, context, what to say or ask…"
                rows={2}
              />
            </Panel>

            <Panel index={5} title="Health Pattern">
              <Field
                label=""
                field="healthPattern"
                placeholder="Sleep, training, energy levels, HRV, anything notable…"
                rows={2}
              />
            </Panel>

            <Panel index={6} title="Next Week — Top 3">
              <Field
                label=""
                field="nextWeekTop3"
                placeholder="1) … 2) … 3) …"
                rows={2}
              />
            </Panel>
          </div>
        )}
      </div>
    </Shell>
  )
}

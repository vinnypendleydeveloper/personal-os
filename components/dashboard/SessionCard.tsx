'use client'

import { useEffect, useState } from 'react'
import { Panel } from './Panel'
import Link from 'next/link'

interface Task {
  id: string
  title: string
  urgency: string
  key: boolean
  time_estimate_min: number | null
  priority_score: number
}

export function SessionCard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tasks?status=open&urgency=today&key=true')
      .then(r => r.json())
      .then(data => {
        setTasks((data.tasks ?? []).slice(0, 3))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <Panel index={2} title="Session" action={
      <Link href="/crm" className="text-[10px] font-mono" style={{ color: 'var(--accent)' }}>
        View all →
      </Link>
    }>
      {loading ? (
        <div className="text-xs" style={{ color: 'var(--ink-4)' }}>Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="text-xs" style={{ color: 'var(--ink-4)' }}>No key tasks for today.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task, i) => (
            <div key={task.id} className="flex items-start gap-2">
              <span className="font-mono text-xs mt-0.5 w-4 shrink-0" style={{ color: 'var(--accent)' }}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{task.title}</p>
                {task.time_estimate_min && (
                  <p className="text-[10px] font-mono" style={{ color: 'var(--ink-4)' }}>
                    ~{task.time_estimate_min}m
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

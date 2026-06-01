'use client'

import { useEffect, useRef, useState } from 'react'
import { Panel } from './Panel'

interface CalEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  location?: string
}

function fmt(date: Date, opts: Intl.DateTimeFormatOptions) {
  return date.toLocaleString('en-US', opts)
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export function CalendarCard() {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const nowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/calendar')
      .then(r => r.json())
      .then(data => setEvents(data.events ?? []))
      .catch(() => {})
  }, [])

  // Build 14-day strip
  const days: Date[] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    days.push(d)
  }

  const selectedEvents = events.filter(e => sameDay(new Date(e.start), selectedDate))
  const today = new Date()

  return (
    <Panel index={4} title="Calendar">
      {/* 14-day strip */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {days.map(day => {
          const hasEvents = events.some(e => sameDay(new Date(e.start), day))
          const isToday = sameDay(day, today)
          const isSelected = sameDay(day, selectedDate)
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg shrink-0 transition-colors"
              style={{
                background: isSelected ? 'var(--accent-dim)' : isToday ? 'var(--ink-2)' : 'transparent',
                border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
              }}
            >
              <span className="text-[9px] font-mono uppercase" style={{ color: isSelected ? 'var(--accent)' : 'var(--ink-4)' }}>
                {fmt(day, { weekday: 'short' })}
              </span>
              <span className="text-sm font-mono font-bold" style={{ color: isSelected ? 'var(--accent)' : isToday ? 'var(--foreground)' : 'var(--ink-4)' }}>
                {day.getDate()}
              </span>
              {hasEvents && (
                <div className="w-1 h-1 rounded-full" style={{ background: isSelected ? 'var(--accent)' : 'var(--ink-4)' }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day events */}
      <div className="flex flex-col gap-1.5 mt-1">
        {selectedEvents.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--ink-4)' }}>
            No events for {fmt(selectedDate, { month: 'short', day: 'numeric' })}.
          </p>
        ) : (
          selectedEvents.map(event => (
            <div key={event.id} className="flex gap-2 items-start">
              <div className="w-1 rounded-full mt-1.5 shrink-0 self-stretch" style={{ background: 'var(--accent)', minHeight: '8px' }} />
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{event.title}</p>
                <p className="text-[10px] font-mono" style={{ color: 'var(--ink-4)' }}>
                  {event.allDay ? 'All day' : `${fmt(new Date(event.start), { hour: 'numeric', minute: '2-digit' })} – ${fmt(new Date(event.end), { hour: 'numeric', minute: '2-digit' })}`}
                </p>
                {event.location && (
                  <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>📍 {event.location}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <div ref={nowRef} />
    </Panel>
  )
}

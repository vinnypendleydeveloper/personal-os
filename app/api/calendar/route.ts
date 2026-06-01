import { NextResponse } from 'next/server'
import ICAL from 'ical.js'

// Module-level cache — avoids re-fetching on every request
let cachedEvents: CalendarEvent[] | null = null
let cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export interface CalendarEvent {
  id: string
  title: string
  start: string // ISO
  end: string   // ISO
  allDay: boolean
  location?: string
}

export async function GET() {
  const icalUrl = process.env.GOOGLE_CALENDAR_ICAL_URL
  if (!icalUrl) {
    return NextResponse.json({ events: [] }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  }

  // Serve from cache if fresh
  if (cachedEvents && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json({ events: cachedEvents }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  }

  try {
    const res = await fetch(icalUrl, { cache: 'no-store' })
    const text = await res.text()

    const jcal = ICAL.parse(text)
    const comp = new ICAL.Component(jcal)
    const vevents = comp.getAllSubcomponents('vevent')

    const now = new Date()
    const windowStart = new Date(now)
    windowStart.setDate(windowStart.getDate() - 1)
    const windowEnd = new Date(now)
    windowEnd.setDate(windowEnd.getDate() + 14)

    const events: CalendarEvent[] = []

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent)

      if (event.isRecurring()) {
        const iter = event.iterator()
        let next = iter.next()
        while (next) {
          const dt = next.toJSDate()
          if (dt > windowEnd) break
          if (dt >= windowStart) {
            const duration = event.duration
            const end = new Date(dt.getTime() + duration.toSeconds() * 1000)
            events.push({
              id: `${event.uid}-${dt.toISOString()}`,
              title: event.summary,
              start: dt.toISOString(),
              end: end.toISOString(),
              allDay: event.startDate.isDate,
              location: event.location ?? undefined,
            })
          }
          next = iter.next()
        }
      } else {
        const start = event.startDate.toJSDate()
        const end = event.endDate.toJSDate()
        if (start >= windowStart && start <= windowEnd) {
          events.push({
            id: event.uid,
            title: event.summary,
            start: start.toISOString(),
            end: end.toISOString(),
            allDay: event.startDate.isDate,
            location: event.location ?? undefined,
          })
        }
      }
    }

    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    cachedEvents = events
    cacheTime = Date.now()

    return NextResponse.json({ events }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('Calendar parse error:', err)
    return NextResponse.json({ events: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
}

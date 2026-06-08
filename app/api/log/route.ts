import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import { ALL_HABITS } from '@/lib/personalContext'

const TZ = process.env.USER_TIMEZONE || 'America/Los_Angeles'
function laDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: TZ })
}

// Mirror of the morning-routine default items (id → label)
const DEFAULT_ROUTINE = [
  { id: 'wake', label: 'Wake up at 7:00 AM' },
  { id: 'water', label: 'Drink a glass of water' },
  { id: 'bed', label: 'Make my bed' },
  { id: 'shower', label: 'Shower' },
  { id: 'room', label: 'Clean my room' },
  { id: 'shake', label: 'Make my shake' },
  { id: 'supplements', label: 'Take supplements' },
  { id: 'coffee', label: 'Make my coffee' },
  { id: 'dressed', label: 'Get dressed' },
  { id: 'gym', label: 'Go to the gym' },
  { id: 'sauna', label: 'Sauna' },
  { id: 'shower-post', label: 'Shower (post-gym)' },
  { id: 'home', label: 'Come home' },
]

export async function GET(req: NextRequest) {
  const db = getServiceClient()
  const date = new URL(req.url).searchParams.get('date') || laDate(new Date())

  // Day row + config row
  const [{ data: dayRow }, { data: cfgRow }] = await Promise.all([
    db.from('daily_logs').select('notes').eq('user_id', USER_ID).eq('log_date', date).maybeSingle(),
    db.from('daily_logs').select('notes').eq('user_id', USER_ID).eq('log_date', '2000-01-01').maybeSingle(),
  ])
  const notes = dayRow?.notes ?? {}

  // Morning routine
  const items: { id: string; label: string }[] = cfgRow?.notes?.morning_routine_items ?? DEFAULT_ROUTINE
  const doneIds = new Set<string>(notes.morning_routine?.done ?? [])
  const routine = {
    total: items.length,
    done: items.filter(i => doneIds.has(i.id)).map(i => i.label),
    missed: items.filter(i => !doneIds.has(i.id)).map(i => i.label),
  }

  // Habits
  const habitsDone: string[] = notes.habits?.done ?? []
  const habits = {
    hit: ALL_HABITS.filter(h => habitsDone.includes(h)),
    missed: ALL_HABITS.filter(h => !habitsDone.includes(h)),
  }

  // Gym
  const gym = notes.gym_session ?? null

  // Tasks completed that day (filter by LA date of completed_at)
  const { data: doneTasks } = await db.from('tasks')
    .select('title, priority_score, tags, urgency, completed_at')
    .eq('user_id', USER_ID).not('completed_at', 'is', null)
  const tasks = (doneTasks ?? [])
    .filter(t => laDate(t.completed_at) === date)
    .sort((a, b) => +new Date(b.completed_at) - +new Date(a.completed_at))

  return NextResponse.json({ date, routine, habits, gym, tasks, notes: notes.log_notes ?? '' })
}

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const { date, notes: text } = await req.json()
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const { data: row } = await db.from('daily_logs')
    .select('id, notes').eq('user_id', USER_ID).eq('log_date', date).maybeSingle()
  const notes = row?.notes ?? {}
  notes.log_notes = String(text ?? '').slice(0, 5000)
  if (row) await db.from('daily_logs').update({ notes, updated_at: new Date().toISOString() }).eq('id', row.id)
  else await db.from('daily_logs').insert({ user_id: USER_ID, log_date: date, notes })

  return NextResponse.json({ ok: true })
}

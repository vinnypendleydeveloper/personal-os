import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'

// Routine ORDER lives on the permanent config row; today's COMPLETIONS live on
// the current day's row (so they naturally reset at midnight).
const CONFIG_DATE = '2000-01-01'
const TZ = process.env.USER_TIMEZONE || 'America/Los_Angeles'

interface RoutineItem { id: string; label: string }

const DEFAULT_ITEMS: RoutineItem[] = [
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

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ }) // YYYY-MM-DD
}

type DB = ReturnType<typeof getServiceClient>

async function getItems(db: DB): Promise<RoutineItem[]> {
  const { data } = await db.from('daily_logs')
    .select('notes').eq('user_id', USER_ID).eq('log_date', CONFIG_DATE).maybeSingle()
  const stored = data?.notes?.morning_routine_items
  return Array.isArray(stored) && stored.length ? stored : DEFAULT_ITEMS
}

// Consecutive days (ending today) with the full routine completed.
// Today not-yet-finished doesn't break the streak; any earlier incomplete day does.
async function computeStreak(db: DB): Promise<number> {
  const since = new Date(); since.setDate(since.getDate() - 400)
  const { data } = await db.from('daily_logs')
    .select('log_date, notes').eq('user_id', USER_ID)
    .gte('log_date', since.toISOString().slice(0, 10))
  const doneByDate: Record<string, boolean> = {}
  for (const r of data ?? []) doneByDate[r.log_date] = r.notes?.morning_routine_done === true

  let streak = 0
  for (let i = 0; i < 400; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('en-CA', { timeZone: TZ })
    if (doneByDate[key]) streak++
    else if (i === 0) continue // today not finished yet — don't break
    else break
  }
  return streak
}

async function upsertConfig(db: DB, mutate: (notes: Record<string, unknown>) => void) {
  const { data: row } = await db.from('daily_logs')
    .select('id, notes').eq('user_id', USER_ID).eq('log_date', CONFIG_DATE).maybeSingle()
  const notes = row?.notes ?? {}
  mutate(notes)
  if (row) await db.from('daily_logs').update({ notes, updated_at: new Date().toISOString() }).eq('id', row.id)
  else await db.from('daily_logs').insert({ user_id: USER_ID, log_date: CONFIG_DATE, notes })
}

async function upsertToday(db: DB, mutate: (notes: Record<string, unknown>) => void) {
  const today = todayKey()
  const { data: row } = await db.from('daily_logs')
    .select('id, notes').eq('user_id', USER_ID).eq('log_date', today).maybeSingle()
  const notes = row?.notes ?? {}
  mutate(notes)
  if (row) await db.from('daily_logs').update({ notes, updated_at: new Date().toISOString() }).eq('id', row.id)
  else await db.from('daily_logs').insert({ user_id: USER_ID, log_date: today, notes })
}

export async function GET() {
  const db = getServiceClient()
  const items = await getItems(db)
  const { data: todayRow } = await db.from('daily_logs')
    .select('notes').eq('user_id', USER_ID).eq('log_date', todayKey()).maybeSingle()
  const completions = (todayRow?.notes?.morning_routine ?? {}) as Record<string, string>
  const streak = await computeStreak(db)
  return NextResponse.json({ items, completions, streak })
}

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const body = await req.json()

  // 1) Save routine order / add / delete / rename
  if (body.kind === 'items' && Array.isArray(body.items)) {
    const items: RoutineItem[] = body.items
      .filter((i: RoutineItem) => i && i.id && typeof i.label === 'string')
      .map((i: RoutineItem) => ({ id: String(i.id), label: i.label.slice(0, 80) }))
    await upsertConfig(db, notes => { notes.morning_routine_items = items })
    return NextResponse.json({ ok: true, items })
  }

  // 2) Toggle a single item's completion for today
  if (body.kind === 'toggle' && body.itemId) {
    const items = await getItems(db)
    let completions: Record<string, string> = {}
    await upsertToday(db, notes => {
      const routine = (notes.morning_routine ?? {}) as Record<string, string>
      if (body.completed) routine[body.itemId] = new Date().toISOString()
      else delete routine[body.itemId]
      notes.morning_routine = routine
      notes.morning_routine_done = items.every(it => routine[it.id])
      completions = routine
    })
    const streak = await computeStreak(db)
    return NextResponse.json({ ok: true, completions, streak })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}

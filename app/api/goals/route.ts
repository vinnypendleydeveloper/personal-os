import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'

// Goals are stored on a sentinel date so they never auto-clear
const SENTINEL_DATE = '2000-01-01'

export async function GET() {
  const db = getServiceClient()

  const { data } = await db.from('daily_logs')
    .select('notes')
    .eq('user_id', USER_ID)
    .eq('log_date', SENTINEL_DATE)
    .single()

  return NextResponse.json({
    week: data?.notes?.goals_week_items ?? [],
    month: data?.notes?.goals_month_items ?? [],
  })
}

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const { week, month } = await req.json()

  const { data: existing } = await db.from('daily_logs')
    .select('id, notes').eq('user_id', USER_ID).eq('log_date', SENTINEL_DATE).single()

  const notes = existing?.notes ?? {}
  notes.goals_week_items = week
  notes.goals_month_items = month

  const { error } = existing
    ? await db.from('daily_logs').update({ notes, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : await db.from('daily_logs').insert({ user_id: USER_ID, log_date: SENTINEL_DATE, notes })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

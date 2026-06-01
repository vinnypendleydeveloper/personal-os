import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'

export async function POST(req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const db = getServiceClient()
  const { done } = await req.json()

  // Upsert into daily_logs.notes.habits
  const { data: existing } = await db.from('daily_logs')
    .select('id, notes').eq('user_id', USER_ID).eq('log_date', date).single()

  const notes = existing?.notes ?? {}
  notes.habits = { done, total: done.length }

  const { error } = existing
    ? await db.from('daily_logs').update({ notes, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : await db.from('daily_logs').insert({ user_id: USER_ID, log_date: date, notes })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

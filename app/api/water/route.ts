import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const db = getServiceClient()
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const days = parseInt(searchParams.get('days') ?? '1')

  if (date) {
    const { data, error } = await db.from('daily_logs')
      .select('notes')
      .eq('user_id', USER_ID)
      .eq('log_date', date)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const water = data?.notes?.water ?? { total_ml: 0, entries: [] }
    return NextResponse.json({ date, ...water })
  }

  // Multi-day history
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]

  const { data, error } = await db.from('daily_logs')
    .select('log_date, notes')
    .eq('user_id', USER_ID)
    .gte('log_date', sinceStr)
    .order('log_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const history = (data ?? []).map(row => ({
    date: row.log_date,
    total_ml: row.notes?.water?.total_ml ?? 0,
    entries: row.notes?.water?.entries ?? [],
  }))

  return NextResponse.json({ history })
}

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const { date, amount_ml } = await req.json()

  if (!date || !amount_ml || amount_ml <= 0) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { data: existing } = await db.from('daily_logs')
    .select('id, notes')
    .eq('user_id', USER_ID)
    .eq('log_date', date)
    .single()

  const notes = existing?.notes ?? {}
  const water = notes.water ?? { total_ml: 0, entries: [] }

  water.entries.push({ amount_ml, logged_at: new Date().toISOString() })
  water.total_ml = water.entries.reduce((sum: number, e: { amount_ml: number }) => sum + e.amount_ml, 0)
  notes.water = water

  const { error } = existing
    ? await db.from('daily_logs').update({ notes, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : await db.from('daily_logs').insert({ user_id: USER_ID, log_date: date, notes })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, total_ml: water.total_ml, entries: water.entries })
}

export async function DELETE(req: NextRequest) {
  const db = getServiceClient()
  const { date } = await req.json()

  const { data: existing } = await db.from('daily_logs')
    .select('id, notes')
    .eq('user_id', USER_ID)
    .eq('log_date', date)
    .single()

  if (!existing?.notes?.water?.entries?.length) {
    return NextResponse.json({ ok: true, total_ml: 0, removed_ml: 0, entries: [] })
  }

  const notes = existing.notes
  const entries: { amount_ml: number; logged_at: string }[] = [...notes.water.entries]
  const last = entries.pop()!
  const total_ml = entries.reduce((s, e) => s + e.amount_ml, 0)
  notes.water = { total_ml, entries }

  const { error } = await db.from('daily_logs')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', existing.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, total_ml, removed_ml: last.amount_ml, entries })
}

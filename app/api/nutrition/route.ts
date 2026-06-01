import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const db = getServiceClient()
  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') ?? '30')

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]

  const { data, error } = await db.from('daily_logs')
    .select('log_date, notes')
    .eq('user_id', USER_ID)
    .gte('log_date', sinceStr)
    .order('log_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const days_data = (data ?? [])
    .filter(row => row.notes?.nutrition?.meals?.length > 0)
    .map(row => ({ date: row.log_date, ...row.notes.nutrition }))

  return NextResponse.json({ days: days_data })
}

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const { date, meals } = await req.json()

  const { data: existing } = await db.from('daily_logs')
    .select('id, notes').eq('user_id', USER_ID).eq('log_date', date).single()

  const notes = existing?.notes ?? {}
  notes.nutrition = { meals }

  const { error } = existing
    ? await db.from('daily_logs').update({ notes, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : await db.from('daily_logs').insert({ user_id: USER_ID, log_date: date, notes })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

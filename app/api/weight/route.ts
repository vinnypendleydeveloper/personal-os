import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const db = getServiceClient()
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const days = parseInt(searchParams.get('days') ?? '90')

  if (date) {
    const { data, error } = await db
      .from('weight_logs')
      .select('weight_lbs, logged_at')
      .eq('user_id', USER_ID)
      .eq('log_date', date)
      .maybeSingle()

    // Table not yet created — return null gracefully
    if (error) return NextResponse.json({ date, weight_lbs: null })
    return NextResponse.json({ date, weight_lbs: data?.weight_lbs ?? null })
  }

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]

  const { data, error } = await db
    .from('weight_logs')
    .select('log_date, weight_lbs')
    .eq('user_id', USER_ID)
    .gte('log_date', sinceStr)
    .order('log_date', { ascending: true })

  if (error) return NextResponse.json({ history: [] })

  const history = (data ?? []).map(r => ({
    date: r.log_date,
    weight_lbs: Number(r.weight_lbs),
  }))

  return NextResponse.json({ history })
}

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const { date, weight_lbs } = await req.json()

  if (!date || weight_lbs == null || weight_lbs <= 0) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { data: existing } = await db
    .from('weight_logs')
    .select('id')
    .eq('user_id', USER_ID)
    .eq('log_date', date)
    .maybeSingle()

  if (existing) {
    const { error } = await db
      .from('weight_logs')
      .update({ weight_lbs, logged_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await db.from('weight_logs').insert({
      user_id: USER_ID,
      weight_lbs,
      log_date: date,
      logged_at: new Date().toISOString(),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, weight_lbs })
}

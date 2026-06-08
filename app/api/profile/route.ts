import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'

// Profile lives on the same config sentinel row as goals
const SENTINEL_DATE = '2000-01-01'

const DEFAULTS = {
  focus: 'IB Internship Search',
  school: 'USC → Fall 2026',
  status: 'ACTIVE',
}

export async function GET() {
  const db = getServiceClient()
  const { data } = await db.from('daily_logs')
    .select('notes').eq('user_id', USER_ID).eq('log_date', SENTINEL_DATE).single()
  return NextResponse.json({ profile: { ...DEFAULTS, ...(data?.notes?.profile ?? {}) } })
}

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const body = await req.json()

  // Whitelist editable fields
  const incoming: Record<string, string> = {}
  for (const k of ['focus', 'school', 'status']) {
    if (typeof body[k] === 'string') incoming[k] = body[k].slice(0, 80)
  }

  const { data: existing } = await db.from('daily_logs')
    .select('id, notes').eq('user_id', USER_ID).eq('log_date', SENTINEL_DATE).single()

  const notes = existing?.notes ?? {}
  notes.profile = { ...DEFAULTS, ...(notes.profile ?? {}), ...incoming }

  const { error } = existing
    ? await db.from('daily_logs').update({ notes, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : await db.from('daily_logs').insert({ user_id: USER_ID, log_date: SENTINEL_DATE, notes })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, profile: notes.profile })
}

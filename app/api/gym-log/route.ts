import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import { fetchSessions, computeProgress, todayKey, GymSession, SessionWithDate } from '@/lib/gymLog'

export async function GET() {
  const db = getServiceClient()
  const today = todayKey()
  const sessions = await fetchSessions(db)

  const todaySession = sessions.find(s => s.date === today) ?? null

  // Most recent date abs were logged (any session with abs_included)
  const lastAbs = sessions.find(s => s.abs_included)
  const lastAbsDate = lastAbs?.date ?? null

  // Live Whoop strain to prefill
  let whoopStrain: number | null = null
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/whoop/data`, {
      headers: { 'x-api-secret': process.env.API_SECRET! },
    })
    const j = await r.json()
    whoopStrain = j?.data?.strain ?? null
  } catch {}

  return NextResponse.json({ today: todaySession, lastAbsDate, whoopStrain })
}

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const body = await req.json() as Partial<GymSession>
  const today = todayKey()

  const session: GymSession = {
    day: body.day ?? 0,
    label: body.label ?? '',
    exercises: body.exercises ?? [],
    abs_included: body.abs_included ?? false,
    whoop_strain: typeof body.whoop_strain === 'number' ? body.whoop_strain : null,
    sauna: body.sauna ?? false,
    notes: body.notes ?? '',
    saved_at: new Date().toISOString(),
  }

  // Upsert into today's daily_log
  const { data: row } = await db.from('daily_logs')
    .select('id, notes').eq('user_id', USER_ID).eq('log_date', today).maybeSingle()
  const notes = row?.notes ?? {}
  notes.gym_session = session
  if (row) await db.from('daily_logs').update({ notes, updated_at: new Date().toISOString() }).eq('id', row.id)
  else await db.from('daily_logs').insert({ user_id: USER_ID, log_date: today, notes })

  // Progress vs previous same-day session
  const all = await fetchSessions(db)
  const current: SessionWithDate = { ...session, date: today }
  const { progress, summary } = computeProgress(current, all)

  return NextResponse.json({ ok: true, progress, summary })
}

import { NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'

export async function GET() {
  const db = getServiceClient()

  // Get most recent finance snapshot
  const { data } = await db.from('daily_logs')
    .select('log_date, notes')
    .eq('user_id', USER_ID)
    .not('notes->finance', 'is', null)
    .order('log_date', { ascending: false })
    .limit(1)
    .single()

  if (!data) return NextResponse.json({ snapshot: null })
  return NextResponse.json({ snapshot: data.notes.finance, date: data.log_date })
}

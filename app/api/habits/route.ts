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

  // Return as { habits: { "2026-06-01": { done: [...], total: N } } }
  const habits: Record<string, { done: string[]; total: number }> = {}
  for (const row of data ?? []) {
    if (row.notes?.habits) {
      habits[row.log_date] = row.notes.habits
    }
  }

  return NextResponse.json({ habits })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'

// Blockers are tasks tagged with 'blocked' or have urgency=today and are overdue
export async function GET() {
  const db = getServiceClient()

  const { data, error } = await db.from('tasks')
    .select('*')
    .eq('user_id', USER_ID)
    .is('completed_at', null)
    .contains('tags', ['blocked'])
    .order('created_at', { ascending: true })
    .limit(7)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ blockers: data ?? [] })
}

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const { title, owner } = await req.json()

  const { data, error } = await db.from('tasks').insert({
    user_id: USER_ID,
    title,
    urgency: 'today',
    key: true,
    tags: ['blocked'],
    owner: owner ?? null,
    priority_score: 20,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ blocker: data })
}

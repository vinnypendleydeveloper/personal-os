import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const db = getServiceClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // open | done
  const urgency = searchParams.get('urgency')
  const key = searchParams.get('key')

  let query = db.from('tasks').select('*').eq('user_id', USER_ID)
    // Cache bust to avoid stale Supabase reads
    .limit(100000 + (Date.now() % 100000))

  if (status === 'open') query = query.is('completed_at', null)
  if (status === 'done') query = query.not('completed_at', 'is', null)
  if (urgency) query = query.eq('urgency', urgency)
  if (key === 'true') query = query.eq('key', true)

  query = query.order('priority_score', { ascending: false }).order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: data })
}

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const body = await req.json()

  const { data, error } = await db.from('tasks').insert({
    user_id: USER_ID,
    title: body.title,
    description: body.description ?? null,
    urgency: body.urgency ?? 'someday',
    key: body.key ?? false,
    priority_score: body.priority_score ?? 0,
    time_estimate_min: body.time_estimate_min ?? null,
    tags: body.tags ?? [],
    due_date: body.due_date ?? null,
    owner: body.owner ?? null,
    entity_id: body.entity_id ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import { embedMemory } from '@/lib/embed'
import { createTaskEvent } from '@/lib/gcal'
import { isMissingSchemaError, stripNewTaskColumns } from '@/lib/taskColumns'

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

  const payload = {
    user_id: USER_ID,
    title: body.title,
    description: body.description ?? null,
    urgency: body.urgency ?? 'someday',
    key: body.key ?? false,
    priority_score: body.priority_score ?? 0,
    time_estimate_min: body.time_estimate_min ?? null,
    tags: body.tags ?? [],
    due_date: body.due_date ?? null,
    start_time: body.start_time ?? null,
    duration_min: body.duration_min ?? null,
    recurring: body.recurring ?? false,
    owner: body.owner ?? null,
    entity_id: body.entity_id ?? null,
  }

  let { data, error } = await db.from('tasks').insert(payload).select().single()
  // Pre-migration fallback: retry without the new (time-block / recurring) columns
  if (error && isMissingSchemaError(error)) {
    ;({ data, error } = await db.from('tasks').insert(stripNewTaskColumns(payload)).select().single())
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create Google Calendar event if task has a due date or a time block
  if (data.due_date || data.start_time) {
    try {
      const eventId = await createTaskEvent({
        id: data.id,
        title: data.title,
        description: data.description,
        due_date: data.due_date,
        start_time: data.start_time,
        duration_min: data.duration_min,
        urgency: data.urgency,
        tags: data.tags as string[],
      })
      if (eventId) {
        await db.from('tasks').update({ gcal_event_id: eventId }).eq('id', data.id)
        data.gcal_event_id = eventId
      }
    } catch (err) {
      console.error('gcal create event failed:', err)
      // Non-fatal — task was created successfully
    }
  }

  // Embed into long-term memory so the brain can recall it later
  await embedMemory({
    text: `Task: ${data.title}${data.description ? ` — ${data.description}` : ''} (${data.urgency}${(data.tags as string[])?.length ? ', ' + (data.tags as string[]).join(' ') : ''})`,
    sourceType: 'task',
    sourceId: data.id,
  })

  return NextResponse.json({ task: data })
}

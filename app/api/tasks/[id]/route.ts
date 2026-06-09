import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import { createTaskEvent, updateTaskEvent, deleteTaskEvent } from '@/lib/gcal'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getServiceClient()
  const body = await req.json()

  // Fetch current task to get existing gcal_event_id and field values
  const { data: existing } = await db.from('tasks')
    .select('gcal_event_id, due_date, title, description, urgency, tags, completed_at')
    .eq('id', id).eq('user_id', USER_ID).single()

  const { data, error } = await db.from('tasks')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', USER_ID)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const eventId: string | null = existing?.gcal_event_id ?? null
  const isBeingCompleted = body.completed_at && !existing?.completed_at

  try {
    if (isBeingCompleted && eventId) {
      // Task completed → remove from calendar
      await deleteTaskEvent(eventId)
      await db.from('tasks').update({ gcal_event_id: null }).eq('id', id)
      data.gcal_event_id = null
    } else if (eventId) {
      // Task updated — sync changed fields to existing calendar event
      await updateTaskEvent(eventId, {
        title: body.title,
        description: body.description,
        due_date: body.due_date,
        urgency: body.urgency ?? existing?.urgency,
        tags: body.tags ?? existing?.tags,
        taskId: id,
      })
    } else if (!isBeingCompleted && (body.due_date ?? existing?.due_date)) {
      // Task gained a due_date for the first time — create a calendar event
      const newDueDate = body.due_date ?? existing?.due_date
      const newEventId = await createTaskEvent({
        id,
        title: body.title ?? existing?.title,
        description: body.description ?? existing?.description,
        due_date: newDueDate,
        urgency: body.urgency ?? existing?.urgency,
        tags: body.tags ?? existing?.tags,
      })
      if (newEventId) {
        await db.from('tasks').update({ gcal_event_id: newEventId }).eq('id', id)
        data.gcal_event_id = newEventId
      }
    }
  } catch (err) {
    console.error('gcal sync failed:', err)
    // Non-fatal — task update already succeeded
  }

  return NextResponse.json({ task: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getServiceClient()

  // Delete the linked calendar event if one exists
  const { data: existing } = await db.from('tasks')
    .select('gcal_event_id').eq('id', id).eq('user_id', USER_ID).single()

  if (existing?.gcal_event_id) {
    try {
      await deleteTaskEvent(existing.gcal_event_id)
    } catch (err) {
      console.error('gcal delete event failed:', err)
    }
  }

  const { error } = await db.from('tasks').delete().eq('id', id).eq('user_id', USER_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

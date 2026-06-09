import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import { createTaskEvent, updateTaskEvent, deleteTaskEvent } from '@/lib/gcal'
import { logActivity } from '@/lib/activityLog'
import { isMissingSchemaError, stripNewTaskColumns } from '@/lib/taskColumns'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getServiceClient()
  const body = await req.json()

  // `sync_gcal` (explicit "Add to Google Calendar") and `ai_override` (Vinny
  // edited the AI's categorization) are control flags, not columns — pull them
  // out so they never reach the DB update.
  const { sync_gcal: forceSync, ai_override: aiOverride, ...fields } = body

  // Record that Vinny overrode the AI's choices, so future categorizations learn.
  if (aiOverride) {
    const { data: latest } = await db.from('task_categorizations')
      .select('id').eq('user_id', USER_ID).eq('task_id', id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (latest) await db.from('task_categorizations').update({ user_overrode: true }).eq('id', latest.id)
  }

  // Fetch current task to get existing gcal_event_id and field values
  const { data: existing } = await db.from('tasks')
    .select('gcal_event_id, due_date, start_time, duration_min, title, description, urgency, tags, completed_at')
    .eq('id', id).eq('user_id', USER_ID).single()

  // Only run the DB update if there are real columns to change
  let data = existing as Record<string, unknown> | null
  if (Object.keys(fields).length) {
    const patch = { ...fields, updated_at: new Date().toISOString() }
    let res = await db.from('tasks')
      .update(patch).eq('id', id).eq('user_id', USER_ID).select().single()
    // Pre-migration fallback: retry without time-block / AI columns
    if (res.error && isMissingSchemaError(res.error)) {
      res = await db.from('tasks')
        .update(stripNewTaskColumns(patch)).eq('id', id).eq('user_id', USER_ID).select().single()
    }
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
    data = res.data
  } else {
    // No-op update (e.g. pure sync_gcal request) — return fresh row
    const res = await db.from('tasks').select('*').eq('id', id).eq('user_id', USER_ID).single()
    data = res.data
  }
  if (!data) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const eventId: string | null = existing?.gcal_event_id ?? null
  const isBeingCompleted = fields.completed_at && !existing?.completed_at

  // Effective (merged) timing — used for calendar sync so we never drop a field
  // the PATCH didn't touch.
  const effDue   = fields.due_date     !== undefined ? fields.due_date     : existing?.due_date
  const effStart = fields.start_time   !== undefined ? fields.start_time   : existing?.start_time
  const effDur   = fields.duration_min !== undefined ? fields.duration_min : existing?.duration_min

  // Real-time activity log entry when a task is completed
  if (isBeingCompleted) {
    await logActivity({
      type: 'task',
      message: `Completed task: ${existing?.title ?? (data as { title?: string }).title}`,
      meta: { taskId: id },
    })
  }

  try {
    if (isBeingCompleted && eventId) {
      // Task completed → remove from calendar
      await deleteTaskEvent(eventId)
      await db.from('tasks').update({ gcal_event_id: null }).eq('id', id)
      ;(data as { gcal_event_id?: string | null }).gcal_event_id = null
    } else if (eventId) {
      // Task updated — sync changed fields to existing calendar event
      await updateTaskEvent(eventId, {
        title: fields.title,
        description: fields.description,
        due_date: effDue,
        start_time: effStart,
        duration_min: effDur,
        urgency: fields.urgency ?? existing?.urgency,
        tags: fields.tags ?? existing?.tags,
        taskId: id,
      })
    } else if (!isBeingCompleted && (forceSync || effDue || effStart)) {
      // First-time event: gained a due date / time block, or explicit sync button
      const newEventId = await createTaskEvent({
        id,
        title: fields.title ?? existing?.title,
        description: fields.description ?? existing?.description,
        due_date: effDue,
        start_time: effStart,
        duration_min: effDur,
        urgency: fields.urgency ?? existing?.urgency,
        tags: fields.tags ?? existing?.tags,
      })
      if (newEventId) {
        await db.from('tasks').update({ gcal_event_id: newEventId }).eq('id', id)
        ;(data as { gcal_event_id?: string | null }).gcal_event_id = newEventId
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

import { google } from 'googleapis'

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? 'primary'
const TZ = process.env.USER_TIMEZONE || 'America/Los_Angeles'

export function isGCalConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  )
}

function getCalendar() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.calendar({ version: 'v3', auth })
}

// YYYY-MM-DD → next day YYYY-MM-DD (Google all-day events use exclusive end)
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function buildDescription(task: {
  id: string
  description?: string | null
  urgency?: string
  tags?: string[]
}) {
  const parts: string[] = []
  if (task.description) parts.push(task.description)
  if (task.urgency && task.urgency !== 'someday') parts.push(`Urgency: ${task.urgency}`)
  if (task.tags?.length) parts.push(`Tags: ${task.tags.join(', ')}`)
  parts.push(`\nTask ID: ${task.id}`)
  return parts.join('\n')
}

// Build the start/end of a calendar event. If a time block (start_time +
// optional duration) is set we create a TIMED event; otherwise an all-day event
// anchored on due_date.
function buildWhen(task: {
  due_date?: string | null
  start_time?: string | null
  duration_min?: number | null
}): { start: Record<string, string>; end: Record<string, string> } | null {
  if (task.start_time) {
    const start = new Date(task.start_time)
    const mins = task.duration_min && task.duration_min > 0 ? task.duration_min : 60
    const end = new Date(start.getTime() + mins * 60_000)
    return {
      start: { dateTime: start.toISOString(), timeZone: TZ },
      end: { dateTime: end.toISOString(), timeZone: TZ },
    }
  }
  if (task.due_date) {
    return { start: { date: task.due_date }, end: { date: nextDay(task.due_date) } }
  }
  return null
}

export async function createTaskEvent(task: {
  id: string
  title: string
  description?: string | null
  due_date?: string | null
  start_time?: string | null
  duration_min?: number | null
  urgency?: string
  tags?: string[]
}): Promise<string | null> {
  if (!isGCalConfigured()) return null
  const when = buildWhen(task)
  if (!when) return null

  const cal = getCalendar()
  const { data } = await cal.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: `📋 ${task.title}`,
      description: buildDescription(task),
      ...when,
    },
  })
  return data.id ?? null
}

export async function updateTaskEvent(
  eventId: string,
  patch: {
    title?: string
    description?: string | null
    due_date?: string | null
    start_time?: string | null
    duration_min?: number | null
    urgency?: string
    tags?: string[]
    taskId?: string
  }
): Promise<void> {
  if (!isGCalConfigured()) return
  const cal = getCalendar()

  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.summary = `📋 ${patch.title}`
  // Re-derive timing whenever a timing field is part of the patch
  if (patch.start_time !== undefined || patch.duration_min !== undefined || patch.due_date !== undefined) {
    const when = buildWhen({
      due_date: patch.due_date,
      start_time: patch.start_time,
      duration_min: patch.duration_min,
    })
    if (when) { body.start = when.start; body.end = when.end }
  }
  if (patch.description !== undefined || patch.urgency !== undefined || patch.tags !== undefined) {
    body.description = buildDescription({
      id: patch.taskId ?? '',
      description: patch.description,
      urgency: patch.urgency,
      tags: patch.tags,
    })
  }

  if (!Object.keys(body).length) return

  try {
    await cal.events.patch({ calendarId: CALENDAR_ID, eventId, requestBody: body })
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 404) return // already gone
    throw err
  }
}

export async function deleteTaskEvent(eventId: string): Promise<void> {
  if (!isGCalConfigured()) return
  const cal = getCalendar()
  try {
    await cal.events.delete({ calendarId: CALENDAR_ID, eventId })
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 404) return // already gone
    throw err
  }
}

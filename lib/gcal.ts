import { google } from 'googleapis'

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? 'primary'

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

export async function createTaskEvent(task: {
  id: string
  title: string
  description?: string | null
  due_date?: string | null
  urgency?: string
  tags?: string[]
}): Promise<string | null> {
  if (!isGCalConfigured() || !task.due_date) return null

  const cal = getCalendar()
  const { data } = await cal.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: `📋 ${task.title}`,
      description: buildDescription(task),
      start: { date: task.due_date },
      end: { date: nextDay(task.due_date) },
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
    urgency?: string
    tags?: string[]
    taskId?: string
  }
): Promise<void> {
  if (!isGCalConfigured()) return
  const cal = getCalendar()

  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.summary = `📋 ${patch.title}`
  if (patch.due_date !== undefined) {
    if (patch.due_date) {
      body.start = { date: patch.due_date }
      body.end = { date: nextDay(patch.due_date) }
    }
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

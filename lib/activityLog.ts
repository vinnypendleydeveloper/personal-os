import { getServiceClient, USER_ID } from './supabase'

// ── Activity log ──────────────────────────────────────────────────────────────
// A chronological, timestamped feed of things that happened during a day.
// Stored in daily_logs.notes.activity[] (no migration needed, matches how the
// rest of the app persists day-scoped state). Written in real time as events
// occur (routine steps checked off, tasks completed, …) and rendered on the
// LOG page as a timeline.

const TZ = process.env.USER_TIMEZONE || 'America/Los_Angeles'

export function activityDateKey(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ }) // YYYY-MM-DD
}

export interface ActivityEntry {
  ts: string // ISO timestamp
  type: string // routine | routine_summary | task | habit | …
  message: string
  meta?: Record<string, unknown>
}

const MAX_ENTRIES = 200

/**
 * Pure mutation: append an entry to a notes object's activity[] (capped).
 * Use this when you're already inside a read-modify-write of a day's notes row
 * so the activity write stays atomic with the rest of the mutation.
 */
export function appendActivity(
  notes: Record<string, unknown>,
  entry: { type: string; message: string; meta?: Record<string, unknown> },
): ActivityEntry {
  const activity = Array.isArray(notes.activity) ? (notes.activity as ActivityEntry[]) : []
  const full: ActivityEntry = {
    ts: new Date().toISOString(),
    type: entry.type,
    message: entry.message,
    ...(entry.meta ? { meta: entry.meta } : {}),
  }
  activity.push(full)
  notes.activity = activity.slice(-MAX_ENTRIES)
  return full
}

/**
 * Standalone logger: read-modify-write the day's notes row to append an entry.
 * Non-fatal — swallows errors so the caller's primary action never fails.
 */
export async function logActivity(entry: {
  type: string
  message: string
  meta?: Record<string, unknown>
  date?: string
}): Promise<void> {
  try {
    const db = getServiceClient()
    const date = entry.date ?? activityDateKey()
    const { data: row } = await db
      .from('daily_logs')
      .select('id, notes')
      .eq('user_id', USER_ID)
      .eq('log_date', date)
      .maybeSingle()
    const notes = (row?.notes ?? {}) as Record<string, unknown>
    appendActivity(notes, entry)
    if (row) {
      await db.from('daily_logs').update({ notes, updated_at: new Date().toISOString() }).eq('id', row.id)
    } else {
      await db.from('daily_logs').insert({ user_id: USER_ID, log_date: date, notes })
    }
  } catch (err) {
    console.error('logActivity error:', err)
  }
}

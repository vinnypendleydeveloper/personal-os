import { getServiceClient, USER_ID } from './supabase'
import { fetchWhoopData, getStoredTokens } from './whoop'
import ICAL from 'ical.js'
import { deriveTag } from '@/app/api/calendar/route'

// ── Shared debrief data ───────────────────────────────────────────────────────
// Single source of truth that both the routine-page debrief and the dashboard
// briefing build on, so they share identical, high-quality context: WHOOP,
// calendar, all CRM tasks (with time blocks + priority), morning-routine
// completion status, biometric comparisons, and recent debrief history.

const TZ = process.env.USER_TIMEZONE || 'America/Los_Angeles'
const ROUTINE_CONFIG_DATE = '2000-01-01'

export function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}
function dateKey(daysAgo: number) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}
export function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
}

export interface WhoopSnapshot {
  recovery_score: number | null
  hrv: number | null
  rhr: number | null
  sleep_performance: number | null
  sleep_hours: number | null
  strain: number | null
}

export interface TodayEvent {
  title: string
  start: string
  end: string
  allDay: boolean
  location?: string
  tag: string
}

export interface DebriefTask {
  id: string
  title: string
  urgency: string
  priority_score: number
  tags: string[]
  due_date: string | null
  start_time: string | null
  duration_min: number | null
  recurring: boolean
  key: boolean
}

export interface DebriefHistoryRow {
  log_date: string
  kind: string
  intake: Record<string, unknown>
  output: string | null
}

export interface DebriefData {
  today: string
  tz: string
  wakeTime: string | null
  whoopConnected: boolean
  whoop: WhoopSnapshot | null
  yesterday: { sleep_hours: number | null; hrv: number | null; recovery_score: number | null } | null
  averages: { sleep_7d: number | null; hrv_7d: number | null; recovery_7d: number | null; sample_days: number }
  comparisons: string[]
  routine: {
    items: { id: string; label: string }[]
    completions: Record<string, string>
    doneLabels: string[]
    remainingLabels: string[]
    doneCount: number
    total: number
    lastCompletedAt: string | null
    allDone: boolean
  }
  calendar: TodayEvent[]
  dueTasks: DebriefTask[]
  openTasks: DebriefTask[]
  history: DebriefHistoryRow[]
}

type DB = ReturnType<typeof getServiceClient>

const DEFAULT_ROUTINE = [
  { id: 'wake', label: 'Wake up at 7:00 AM' },
  { id: 'water', label: 'Drink a glass of water' },
  { id: 'bed', label: 'Make my bed' },
  { id: 'shower', label: 'Shower' },
  { id: 'room', label: 'Clean my room' },
  { id: 'shake', label: 'Make my shake' },
  { id: 'supplements', label: 'Take supplements' },
  { id: 'coffee', label: 'Make my coffee' },
  { id: 'dressed', label: 'Get dressed' },
  { id: 'gym', label: 'Go to the gym' },
  { id: 'sauna', label: 'Sauna' },
  { id: 'shower-post', label: 'Shower (post-gym)' },
  { id: 'home', label: 'Come home' },
]

async function loadTodayEvents(today: string): Promise<TodayEvent[]> {
  const icalUrl = process.env.GOOGLE_CALENDAR_ICAL_URL
  if (!icalUrl) return []
  const events: TodayEvent[] = []
  try {
    const res = await fetch(icalUrl, { cache: 'no-store' })
    const text = await res.text()
    const jcal = ICAL.parse(text)
    const comp = new ICAL.Component(jcal)
    const vevents = comp.getAllSubcomponents('vevent')
    const todayStart = new Date(`${today}T00:00:00`)
    const todayEnd = new Date(`${today}T23:59:59`)

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent)
      const collect = (dt: Date, endDt: Date, isDate: boolean) => {
        if (dt <= todayEnd && endDt >= todayStart) {
          events.push({
            title: event.summary,
            start: dt.toISOString(),
            end: endDt.toISOString(),
            allDay: isDate,
            location: event.location ?? undefined,
            tag: deriveTag(event.summary, event.location ?? undefined),
          })
        }
      }
      if (event.isRecurring()) {
        const iter = event.iterator()
        let next = iter.next()
        while (next) {
          const dt = next.toJSDate()
          if (dt > todayEnd) break
          const dur = event.duration
          collect(dt, new Date(dt.getTime() + dur.toSeconds() * 1000), event.startDate.isDate)
          next = iter.next()
        }
      } else {
        collect(event.startDate.toJSDate(), event.endDate.toJSDate(), event.startDate.isDate)
      }
    }
    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  } catch {
    /* non-fatal — debrief works without calendar */
  }
  return events
}

/**
 * Gather everything the debriefs need. Pass `logWake: true` (routine page, first
 * open) to stamp the wake time. WHOOP is refetched at most once per hour.
 */
export async function gatherDebriefData(opts: { logWake?: boolean } = {}): Promise<DebriefData> {
  const db: DB = getServiceClient()
  const today = todayKey()
  const yesterday = dateKey(1)

  // Today's row + morning_debrief sub-object
  const { data: todayRow } = await db.from('daily_logs')
    .select('id, notes').eq('user_id', USER_ID).eq('log_date', today).maybeSingle()
  const todayNotes: Record<string, unknown> = (todayRow?.notes ?? {}) as Record<string, unknown>
  const debrief: Record<string, unknown> = (todayNotes.morning_debrief as Record<string, unknown>) ?? {}
  let rowId: string | null = todayRow?.id ?? null

  // Optionally log wake time on first open
  if (opts.logWake && !debrief.wake_time) {
    debrief.wake_time = new Date().toISOString()
    todayNotes.morning_debrief = debrief
    if (rowId) {
      await db.from('daily_logs').update({ notes: todayNotes, updated_at: new Date().toISOString() }).eq('id', rowId)
    } else {
      const { data: ins } = await db.from('daily_logs')
        .insert({ user_id: USER_ID, log_date: today, notes: todayNotes }).select('id').single()
      rowId = ins?.id ?? null
    }
  }

  // WHOOP (throttled to once/hour)
  const whoopConnected = !!(await getStoredTokens())
  let whoopData = (debrief.whoop as Record<string, unknown>) ?? null
  const lastFetch = debrief.whoop_fetched_at as string | null
  const needsRefetch = !lastFetch || Date.now() - new Date(lastFetch).getTime() > 3_600_000
  if (whoopConnected && needsRefetch) {
    const fresh = await fetchWhoopData()
    if (fresh) {
      whoopData = fresh as unknown as Record<string, unknown>
      debrief.whoop = whoopData
      debrief.whoop_fetched_at = new Date().toISOString()
      todayNotes.morning_debrief = debrief
      const { data: current } = await db.from('daily_logs')
        .select('id').eq('user_id', USER_ID).eq('log_date', today).maybeSingle()
      const id = current?.id ?? rowId
      if (id) await db.from('daily_logs').update({ notes: todayNotes, updated_at: new Date().toISOString() }).eq('id', id)
    }
  }

  // Yesterday + 7-day averages
  const { data: yRow } = await db.from('daily_logs')
    .select('notes').eq('user_id', USER_ID).eq('log_date', yesterday).maybeSingle()
  const yWhoop = (((yRow?.notes as Record<string, unknown>)?.morning_debrief as Record<string, unknown>)?.whoop as Record<string, unknown>) ?? null

  const { data: recentRows } = await db.from('daily_logs')
    .select('log_date, notes').eq('user_id', USER_ID).gte('log_date', dateKey(7)).lt('log_date', today)
  const recentW = (recentRows ?? [])
    .map(r => ((r.notes as Record<string, unknown>)?.morning_debrief as Record<string, unknown>)?.whoop as Record<string, unknown>)
    .filter(Boolean)
  const nums = (arr: (number | null | undefined)[]) => arr.filter((v): v is number => typeof v === 'number' && v > 0)
  const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
  const sleepArr = nums(recentW.map(w => w?.sleep_hours as number))
  const hrvArr = nums(recentW.map(w => w?.hrv as number))
  const recArr = nums(recentW.map(w => w?.recovery_score as number))
  const avg7dSleep = mean(sleepArr)
  const avg7dHrv = mean(hrvArr)
  const avg7dRecovery = mean(recArr)

  const todaySleep = (whoopData?.sleep_hours as number) ?? null
  const todayHrv = (whoopData?.hrv as number) ?? null
  const todayRecovery = (whoopData?.recovery_score as number) ?? null
  const ySleep = (yWhoop?.sleep_hours as number) ?? null

  const comparisons: string[] = []
  if (todaySleep != null && ySleep != null) {
    const mins = Math.round((todaySleep - ySleep) * 60)
    if (Math.abs(mins) >= 10)
      comparisons.push(mins > 0 ? `Slept ${mins} min more than yesterday` : `Slept ${Math.abs(mins)} min less than yesterday`)
  }
  if (todayRecovery != null && recArr.length >= 3) {
    const rank = recArr.filter(v => v > todayRecovery).length + 1
    if (rank === 1) comparisons.push(`Best recovery in ${recArr.length + 1} days`)
    else if (rank === 2) comparisons.push('2nd best recovery this week')
    else if (avg7dRecovery != null) {
      const d = Math.round(todayRecovery - avg7dRecovery)
      if (Math.abs(d) >= 5) comparisons.push(d > 0 ? `Recovery ${d}% above 7-day avg` : `Recovery ${Math.abs(d)}% below 7-day avg`)
    }
  }
  if (todayHrv != null && avg7dHrv != null) {
    const d = Math.round(todayHrv - avg7dHrv)
    if (Math.abs(d) >= 3) comparisons.push(d > 0 ? `HRV ${d} ms above 7-day avg` : `HRV ${Math.abs(d)} ms below 7-day avg`)
  }
  if (todaySleep != null && avg7dSleep != null && comparisons.length < 2) {
    const mins = Math.round((todaySleep - avg7dSleep) * 60)
    if (Math.abs(mins) >= 15)
      comparisons.push(mins > 0 ? `${mins} min more sleep than 7-day avg` : `${Math.abs(mins)} min less sleep than 7-day avg`)
  }

  // Morning routine items + today's completions
  const { data: configRow } = await db.from('daily_logs')
    .select('notes').eq('user_id', USER_ID).eq('log_date', ROUTINE_CONFIG_DATE).maybeSingle()
  const storedItems = (configRow?.notes as Record<string, unknown>)?.morning_routine_items
  const items: { id: string; label: string }[] = Array.isArray(storedItems) && storedItems.length ? storedItems : DEFAULT_ROUTINE
  const completions = ((todayNotes.morning_routine as Record<string, string>) ?? {}) as Record<string, string>
  const doneItems = items.filter(i => completions[i.id])
  const completionTimes = Object.values(completions).filter(Boolean).sort()
  const routine = {
    items,
    completions,
    doneLabels: doneItems.map(i => i.label),
    remainingLabels: items.filter(i => !completions[i.id]).map(i => i.label),
    doneCount: doneItems.length,
    total: items.length,
    lastCompletedAt: completionTimes.length ? completionTimes[completionTimes.length - 1] : null,
    allDone: items.length > 0 && doneItems.length === items.length,
  }

  // Calendar (today)
  const calendar = await loadTodayEvents(today)

  // Tasks (with a pre-migration fallback to original columns)
  let openRows: Record<string, unknown>[] | null = null
  {
    const rich = await db.from('tasks')
      .select('id, title, urgency, priority_score, tags, due_date, start_time, duration_min, recurring, key')
      .eq('user_id', USER_ID).is('completed_at', null)
      .order('priority_score', { ascending: false })
    openRows = (rich.data as Record<string, unknown>[] | null)
    if (!openRows) {
      const base = await db.from('tasks')
        .select('id, title, urgency, priority_score, tags, due_date, key')
        .eq('user_id', USER_ID).is('completed_at', null)
        .order('priority_score', { ascending: false })
      openRows = (base.data as Record<string, unknown>[] | null)
    }
  }
  const openTasks: DebriefTask[] = (openRows ?? []).map(t => ({
    id: t.id as string, title: t.title as string, urgency: t.urgency as string,
    priority_score: (t.priority_score as number) ?? 0,
    tags: (t.tags as string[]) ?? [], due_date: (t.due_date as string) ?? null,
    start_time: (t.start_time as string) ?? null, duration_min: (t.duration_min as number) ?? null,
    recurring: !!t.recurring, key: !!t.key,
  }))
  const dueTasks = openTasks.filter(t => t.due_date === today).slice(0, 12)

  // Recent debrief history (for continuity)
  let history: DebriefHistoryRow[] = []
  try {
    const { data: hist } = await db.from('debrief_history')
      .select('log_date, kind, intake, output')
      .eq('user_id', USER_ID).order('created_at', { ascending: false }).limit(3)
    history = (hist ?? []) as DebriefHistoryRow[]
  } catch { /* table may not exist yet */ }

  return {
    today,
    tz: TZ,
    wakeTime: (debrief.wake_time as string) ?? null,
    whoopConnected,
    whoop: whoopData ? {
      recovery_score: (whoopData.recovery_score as number) ?? null,
      hrv: (whoopData.hrv as number) ?? null,
      rhr: (whoopData.rhr as number) ?? null,
      sleep_performance: (whoopData.sleep_performance as number) ?? null,
      sleep_hours: (whoopData.sleep_hours as number) ?? null,
      strain: (whoopData.strain as number) ?? null,
    } : null,
    yesterday: yWhoop ? {
      sleep_hours: (yWhoop.sleep_hours as number) ?? null,
      hrv: (yWhoop.hrv as number) ?? null,
      recovery_score: (yWhoop.recovery_score as number) ?? null,
    } : null,
    averages: {
      sleep_7d: avg7dSleep != null ? Math.round(avg7dSleep * 10) / 10 : null,
      hrv_7d: avg7dHrv != null ? Math.round(avg7dHrv) : null,
      recovery_7d: avg7dRecovery != null ? Math.round(avg7dRecovery) : null,
      sample_days: Math.max(sleepArr.length, hrvArr.length, recArr.length),
    },
    comparisons,
    routine,
    calendar,
    dueTasks,
    openTasks,
    history,
  }
}

// ── Prompt fragments shared by both debriefs ────────────────────────────────

export function recoveryBand(rec: number | null): string {
  if (rec == null) return 'unknown'
  if (rec >= 66) return `${rec}% — GREEN, push hard`
  if (rec >= 33) return `${rec}% — YELLOW, moderate effort`
  return `${rec}% — RED, take it easy today`
}

export function calendarLines(events: TodayEvent[]): string {
  if (!events.length) return 'No events scheduled.'
  return events.map(e => {
    if (e.allDay) return `• All day: ${e.title}`
    return `• ${fmtTime(new Date(e.start))}–${fmtTime(new Date(e.end))}: ${e.title}${e.location ? ` @ ${e.location}` : ''} [${e.tag}]`
  }).join('\n')
}

export function taskLines(tasks: DebriefTask[]): string {
  if (!tasks.length) return 'No open tasks.'
  return tasks.map(t => {
    const time = t.start_time ? ` @ ${fmtTime(new Date(t.start_time))}${t.duration_min ? ` (${t.duration_min}m)` : ''}` : ''
    const tags = t.tags.filter(x => !x.startsWith('@')).join(' ')
    return `• ${t.title} [${t.urgency}, p${t.priority_score}${t.key ? ', ★key' : ''}${t.recurring ? ', daily' : ''}]${time}${t.due_date ? ` due ${t.due_date}` : ''}${tags ? ` ${tags}` : ''}`
  }).join('\n')
}

export function historyLines(history: DebriefHistoryRow[]): string {
  if (!history.length) return '(no recent debriefs)'
  return history.map(h => {
    const intake = h.intake && Object.keys(h.intake).length ? JSON.stringify(h.intake) : '—'
    const snippet = h.output
      ? `\n  → ${h.output.replace(/#+\s*/g, '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim().slice(0, 200)}…`
      : ''
    return `${h.log_date} [${h.kind}] intake: ${intake}${snippet}`
  }).join('\n')
}

/** Persist a generated debrief + its intake answers for future continuity. */
export async function saveDebriefHistory(kind: 'routine' | 'dashboard', intake: Record<string, unknown>, output: string) {
  try {
    const db = getServiceClient()
    await db.from('debrief_history').insert({
      user_id: USER_ID, kind, log_date: todayKey(), intake: intake ?? {}, output: output.slice(0, 8000),
    })
  } catch { /* table may not exist yet — non-fatal */ }
}

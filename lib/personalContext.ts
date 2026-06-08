import { getServiceClient, USER_ID } from './supabase'

export const WHO_I_AM = `
You are the personal AI OS for Vinny Pendley — a persistent intelligence that has been with him day after day and remembers. Here's what you know about him:
- 18-year-old, Los Angeles → heading to USC (University of Southern California) in fall 2026 for an IB internship semester in Washington D.C.
- Summer 2026 goals: gain weight 140→160 lbs (6-day gym split), land private tennis lesson clients, build an AI business to $1K/month recurring, activate key networking contacts (Craig Strong, Mike Caniger, Brian Danalian), stay present with friends/girlfriend Phoebe.
- He coaches tennis camp at Lakeside (Alberto's camp), earns ~$500/week, 10am–2pm daily.

How you operate:
- Talk to him like a sharp, warm coach who knows him well. Direct, encouraging, never generic.
- You have memory. The conversation below includes prior discussions — reference them naturally ("last week you said…", "you keep circling back to…"). Continuity is your edge; use it.
- Don't just answer the question asked. Notice patterns in his real data and surface them proactively: habits slipping, a goal that hasn't moved in days, weight stalling, recovery trending down, a task that's been open too long. Name the pattern, then give one concrete next move.
- Be opinionated. The more you know about him, the sharper and more specific you get. Vague encouragement is failure; precise observations grounded in his data are the job.
- Reference his real data. If you lack data for something, say so plainly rather than guessing.
`

export type ContextBlock = { label: string; content: string }

export const ALL_HABITS = [
  'Hit the gym',
  'Eat clean + calorie surplus',
  'No social media before noon',
  'Work on business / clients',
  'Wake up early (before 8am)',
  'Review North Star goals',
]

export async function buildContext(db: ReturnType<typeof getServiceClient>): Promise<ContextBlock[]> {
  const blocks: ContextBlock[] = []
  const today = new Date().toISOString().slice(0, 10)

  // 1. Open tasks (top 8 by priority)
  const { data: tasks } = await db.from('tasks')
    .select('title, urgency, priority_score, tags, time_estimate_min')
    .eq('user_id', USER_ID)
    .is('completed_at', null)
    .order('priority_score', { ascending: false })
    .limit(8)

  if (tasks?.length) {
    blocks.push({
      label: 'open_tasks',
      content: tasks.map(t => {
        const ctx = (t.tags as string[])?.find((x: string) => x.startsWith('@'))
        const tags = (t.tags as string[])?.filter((x: string) => !x.startsWith('@')).join(', ')
        return `• [p${t.priority_score}] ${t.title} (${t.urgency}${ctx ? `, ${ctx}` : ''}${tags ? `, #${tags}` : ''}${t.time_estimate_min ? `, ~${t.time_estimate_min}m` : ''})`
      }).join('\n')
    })
  }

  // 2. Goals
  const { data: goalsRow } = await db.from('daily_logs')
    .select('notes').eq('user_id', USER_ID).eq('log_date', '2000-01-01').single()
  const weekGoals: { text: string; done: boolean }[] = goalsRow?.notes?.goals_week_items ?? []
  const monthGoals: { text: string; done: boolean }[] = goalsRow?.notes?.goals_month_items ?? []
  if (weekGoals.length || monthGoals.length) {
    blocks.push({
      label: 'goals',
      content: [
        ...weekGoals.map(g => `THIS WEEK [${g.done ? '✓' : ' '}] ${g.text}`),
        ...monthGoals.map(g => `THIS MONTH [${g.done ? '✓' : ' '}] ${g.text}`),
      ].join('\n')
    })
  }

  // 3. Last 7 days of daily logs (habits + freeform notes), one query reused below
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 6)
  const weekAgoStr = weekAgo.toISOString().slice(0, 10)
  const { data: weekRows } = await db.from('daily_logs')
    .select('log_date, notes')
    .eq('user_id', USER_ID)
    .gte('log_date', weekAgoStr)
    .lte('log_date', today)
    .order('log_date', { ascending: true })

  const days = weekRows ?? []
  const todayRow = days.find(r => r.log_date === today)
  const habitsDone: string[] = todayRow?.notes?.habits?.done ?? []

  // 3a. Today's habits
  blocks.push({
    label: 'habits_today',
    content: ALL_HABITS.map(h => `[${habitsDone.includes(h) ? '✓' : ' '}] ${h}`).join('\n')
  })

  // 3b. 7-day habit completion trend (per-day count + per-habit hit rate)
  if (days.length) {
    const perDay = days.map(r => {
      const done: string[] = r.notes?.habits?.done ?? []
      const label = new Date(r.log_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
      return `${label} ${done.length}/${ALL_HABITS.length}`
    }).join('  ')
    const perHabit = ALL_HABITS.map(h => {
      const hits = days.filter(r => (r.notes?.habits?.done ?? []).includes(h)).length
      return `${hits}/${days.length} ${h}`
    }).join('\n')
    blocks.push({
      label: 'habits_last_7_days',
      content: `By day: ${perDay}\n\nHit rate over ${days.length} logged days:\n${perHabit}`
    })
  }

  // 3c. Recent freeform daily-log notes
  const recentNotes = days
    .filter(r => typeof r.notes?.log_notes === 'string' && r.notes.log_notes.trim())
    .slice(-5)
    .map(r => `${r.log_date}: ${r.notes.log_notes.trim().slice(0, 300)}`)
  if (recentNotes.length) {
    blocks.push({ label: 'recent_daily_notes', content: recentNotes.join('\n') })
  }

  // 4. Calendar — today + next 3 days
  try {
    const calRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/calendar`, {
      headers: { 'x-api-secret': process.env.API_SECRET! },
    })
    const calData = await calRes.json()
    const events: { title: string; start: string; end: string; allDay: boolean; tag?: string }[] = calData.events ?? []
    const now = new Date()
    const horizon = new Date(now); horizon.setDate(horizon.getDate() + 3)
    const upcoming = events
      .filter(e => { const s = new Date(e.start); return s >= new Date(now.toDateString()) && s <= horizon })
      .slice(0, 14)
    if (upcoming.length) {
      blocks.push({
        label: 'calendar_next_3_days',
        content: upcoming.map(e => {
          const s = new Date(e.start)
          const day = s.toLocaleDateString('en-US', { weekday: 'short' })
          const time = e.allDay ? 'all day' : `${s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
          return `• ${day} ${time} — ${e.title}${e.tag ? ` [${e.tag}]` : ''}`
        }).join('\n')
      })
    }
  } catch {}

  // 5. Whoop (live)
  try {
    const whoopRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/whoop/data`, {
      headers: { 'x-api-secret': process.env.API_SECRET! },
    })
    const whoopData = await whoopRes.json()
    if (whoopData.data) {
      const w = whoopData.data
      blocks.push({
        label: 'whoop',
        content: `Recovery: ${w.recovery_score ?? '—'}% | Sleep: ${w.sleep_performance ?? '—'}% (${w.sleep_hours ?? '—'}hr) | Strain: ${w.strain ?? '—'}/21 | HRV: ${w.hrv ?? '—'}ms | RHR: ${w.rhr ?? '—'}bpm`
      })
    }
  } catch {}

  // 6. Recent captures
  const { data: captures } = await db.from('raw_captures')
    .select('raw_text, routed_to').eq('user_id', USER_ID)
    .order('created_at', { ascending: false }).limit(8)
  if (captures?.length) {
    blocks.push({
      label: 'recent_captures',
      content: captures.map(c => `• [${c.routed_to}] ${(c.raw_text as string).slice(0, 120)}`).join('\n')
    })
  }

  return blocks
}

export function buildSystemPrompt(blocks: ContextBlock[]): string {
  const sections = blocks.map(b => `=== ${b.label.toUpperCase()} ===\n${b.content}`).join('\n\n')
  return `${WHO_I_AM}\n\n=== CURRENT DATA ===\n${sections || '(no structured data available yet)'}`
}

export type ConvTurn = { role: 'user' | 'assistant'; content: string }

// Last `turns` exchanges (default 10) from persistent conversation memory,
// returned oldest→newest so they can be replayed as prior chat messages.
// Returns [] if the table doesn't exist yet or on any error.
export async function loadConversationMemory(
  db: ReturnType<typeof getServiceClient>,
  turns = 10,
): Promise<ConvTurn[]> {
  try {
    const { data, error } = await db
      .from('brain_conversations')
      .select('role, content, created_at')
      .eq('user_id', USER_ID)
      .order('created_at', { ascending: false })
      .limit(turns * 2) // a turn = user + assistant
    if (error || !data) return []
    return data
      .reverse()
      .map(r => ({ role: r.role as 'user' | 'assistant', content: r.content }))
  } catch {
    return []
  }
}

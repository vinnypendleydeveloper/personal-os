import { NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import { fetchWhoopData, getStoredTokens } from '@/lib/whoop'
import { embedMemory } from '@/lib/embed'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import ICAL from 'ical.js'
import { deriveTag } from '@/app/api/calendar/route'

const TZ = process.env.USER_TIMEZONE || 'America/Los_Angeles'

function stripMarkdown(text: string | null): string | null {
  if (!text) return null
  return text
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .trim()
}

function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}
function dateKey(daysAgo: number) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

export interface WhoopSnapshot {
  recovery_score: number | null
  hrv: number | null
  rhr: number | null
  sleep_performance: number | null
  sleep_hours: number | null
  strain: number | null
}

export interface DebriefResponse {
  wake_time: string | null
  whoop_connected: boolean
  whoop: WhoopSnapshot | null
  yesterday: { sleep_hours: number | null; hrv: number | null; recovery_score: number | null } | null
  averages: { sleep_7d: number | null; hrv_7d: number | null; recovery_7d: number | null; sample_days: number }
  comparisons: string[]
  due_tasks: { id: string; title: string; urgency: string; tags: string[] }[]
  debrief_message: string | null
}

export async function GET() {
  const db = getServiceClient()
  const today = todayKey()
  const yesterday = dateKey(1)

  // ── 1. Load today's row ──────────────────────────────────
  const { data: todayRow } = await db.from('daily_logs')
    .select('id, notes').eq('user_id', USER_ID).eq('log_date', today).maybeSingle()

  const todayNotes: Record<string, unknown> = ((todayRow?.notes ?? {}) as Record<string, unknown>)
  const debrief: Record<string, unknown> = ((todayNotes.morning_debrief as Record<string, unknown>) ?? {})
  let rowId: string | null = todayRow?.id ?? null

  // ── 2. Log wake-up time on first open ────────────────────
  const isFirstOpen = !debrief.wake_time
  if (isFirstOpen) {
    debrief.wake_time = new Date().toISOString()
    todayNotes.morning_debrief = debrief
    if (rowId) {
      await db.from('daily_logs')
        .update({ notes: todayNotes, updated_at: new Date().toISOString() })
        .eq('id', rowId)
    } else {
      const { data: ins } = await db.from('daily_logs')
        .insert({ user_id: USER_ID, log_date: today, notes: todayNotes })
        .select('id').single()
      rowId = ins?.id ?? null
    }
  }

  // ── 3. Fetch WHOOP (throttled to once per hour) ──────────
  const whoopTokens = await getStoredTokens()
  const whoopConnected = !!whoopTokens
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
      // Re-read row id in case first-open insert just ran
      const { data: current } = await db.from('daily_logs')
        .select('id').eq('user_id', USER_ID).eq('log_date', today).maybeSingle()
      const id = current?.id ?? rowId
      if (id) {
        await db.from('daily_logs')
          .update({ notes: todayNotes, updated_at: new Date().toISOString() })
          .eq('id', id)
      }
    }
  }

  // ── 4. Yesterday's snapshot ──────────────────────────────
  const { data: yRow } = await db.from('daily_logs')
    .select('notes').eq('user_id', USER_ID).eq('log_date', yesterday).maybeSingle()
  const yDebrief = ((yRow?.notes as Record<string, unknown>)?.morning_debrief as Record<string, unknown>) ?? null
  const yWhoop = (yDebrief?.whoop as Record<string, unknown>) ?? null

  // ── 5. 7-day averages ────────────────────────────────────
  const { data: recentRows } = await db.from('daily_logs')
    .select('log_date, notes')
    .eq('user_id', USER_ID)
    .gte('log_date', dateKey(7))
    .lt('log_date', today)

  const recentW = (recentRows ?? [])
    .map(r => ((r.notes as Record<string, unknown>)?.morning_debrief as Record<string, unknown>)?.whoop as Record<string, unknown>)
    .filter(Boolean)

  const nums = (arr: (number | null | undefined)[]) =>
    arr.filter((v): v is number => typeof v === 'number' && v > 0)
  const mean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

  const sleepArr = nums(recentW.map(w => w?.sleep_hours as number))
  const hrvArr   = nums(recentW.map(w => w?.hrv as number))
  const recArr   = nums(recentW.map(w => w?.recovery_score as number))

  const avg7dSleep    = mean(sleepArr)
  const avg7dHrv      = mean(hrvArr)
  const avg7dRecovery = mean(recArr)

  // ── 6. Comparison messages ───────────────────────────────
  const todaySleep    = (whoopData?.sleep_hours as number) ?? null
  const todayHrv      = (whoopData?.hrv as number) ?? null
  const todayRecovery = (whoopData?.recovery_score as number) ?? null
  const ySleep        = (yWhoop?.sleep_hours as number) ?? null

  const comparisons: string[] = []

  if (todaySleep != null && ySleep != null) {
    const mins = Math.round((todaySleep - ySleep) * 60)
    if (Math.abs(mins) >= 10)
      comparisons.push(mins > 0
        ? `Slept ${mins} min more than yesterday`
        : `Slept ${Math.abs(mins)} min less than yesterday`)
  }

  if (todayRecovery != null && recArr.length >= 3) {
    const rank = recArr.filter(v => v > todayRecovery).length + 1
    if (rank === 1) comparisons.push(`Best recovery in ${recArr.length + 1} days`)
    else if (rank === 2) comparisons.push('2nd best recovery this week')
    else if (avg7dRecovery != null) {
      const d = Math.round(todayRecovery - avg7dRecovery)
      if (Math.abs(d) >= 5)
        comparisons.push(d > 0 ? `Recovery ${d}% above 7-day avg` : `Recovery ${Math.abs(d)}% below 7-day avg`)
    }
  }

  if (todayHrv != null && avg7dHrv != null) {
    const d = Math.round(todayHrv - avg7dHrv)
    if (Math.abs(d) >= 3)
      comparisons.push(d > 0 ? `HRV ${d} ms above 7-day avg` : `HRV ${Math.abs(d)} ms below 7-day avg`)
  }

  if (todaySleep != null && avg7dSleep != null && comparisons.length < 2) {
    const mins = Math.round((todaySleep - avg7dSleep) * 60)
    if (Math.abs(mins) >= 15)
      comparisons.push(mins > 0 ? `${mins} min more sleep than 7-day avg` : `${Math.abs(mins)} min less sleep than 7-day avg`)
  }

  // ── 7. Tasks due today ───────────────────────────────────
  const { data: dueTasks } = await db.from('tasks')
    .select('id, title, urgency, tags')
    .eq('user_id', USER_ID)
    .eq('due_date', today)
    .is('completed_at', null)
    .order('priority_score', { ascending: false })
    .limit(8)

  // ── 7b. Morning routine items ────────────────────────────
  const ROUTINE_CONFIG_DATE = '2000-01-01'
  const { data: configRow } = await db.from('daily_logs')
    .select('notes').eq('user_id', USER_ID).eq('log_date', ROUTINE_CONFIG_DATE).maybeSingle()
  const storedItems = configRow?.notes?.morning_routine_items
  const routineItems: { id: string; label: string }[] = Array.isArray(storedItems) && storedItems.length
    ? storedItems
    : [
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

  // ── 7c. Today's calendar events ──────────────────────────
  interface TodayEvent { title: string; start: string; end: string; allDay: boolean; location?: string; tag: string }
  let todayEvents: TodayEvent[] = []
  const icalUrl = process.env.GOOGLE_CALENDAR_ICAL_URL
  if (icalUrl) {
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
            todayEvents.push({
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
      todayEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    } catch { /* non-fatal — debrief works without calendar */ }
  }

  // ── 8. Generate AI debrief ───────────────────────────────
  const routineSection = `MORNING ROUTINE — DO THESE NOW:\n${routineItems.map((item, i) => `${i + 1}. ${item.label}`).join('\n')}`
  let debriefMessage: string | null = null
  try {
    const wakeStr = debrief.wake_time
      ? new Date(debrief.wake_time as string).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
      : 'unknown'

    const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })

    const calendarLines = todayEvents.length
      ? todayEvents.map(e => {
          if (e.allDay) return `• All day: ${e.title}`
          return `• ${fmt(new Date(e.start))}–${fmt(new Date(e.end))}: ${e.title}${e.location ? ` @ ${e.location}` : ''} [${e.tag}]`
        }).join('\n')
      : 'No events scheduled.'

    const taskLines = dueTasks?.length
      ? dueTasks.map(t => `• ${t.title} [${t.urgency}]`).join('\n')
      : 'No tasks due today.'

    const sleepVsYesterday = todaySleep != null && ySleep != null
      ? `${Math.abs(Math.round((todaySleep - ySleep) * 60))} min ${todaySleep >= ySleep ? 'more' : 'less'} than yesterday (${ySleep.toFixed(1)}h)`
      : null
    const sleepVsAvg = todaySleep != null && avg7dSleep != null
      ? `${Math.abs(Math.round((todaySleep - avg7dSleep) * 60))} min ${todaySleep >= avg7dSleep ? 'more' : 'less'} than 7-day avg (${avg7dSleep.toFixed(1)}h)`
      : null

    const recoveryBand = todayRecovery == null ? 'unknown'
      : todayRecovery >= 66 ? `${todayRecovery}% — GREEN, push hard`
      : todayRecovery >= 33 ? `${todayRecovery}% — YELLOW, moderate effort`
      : `${todayRecovery}% — RED, take it easy today`

    const systemPrompt = `You are Vinny's personal morning coach. Rules you must follow:
1. Plain text only — zero markdown, no #, no **, no *.
2. Assertive and direct. No filler phrases, no "great job", no "you got this", no generic motivation.
3. Only use data explicitly provided. Never invent tasks, events, meetings, or numbers.
4. Your response must start with the exact text "TODAY'S PLAN:" — no preamble, no other sections before it.`

    const userPrompt = `Write a morning debrief for Vinny using the data below. Output exactly 4 sections in this order, starting immediately with "TODAY'S PLAN:" — do not write anything before it.

BIOMETRICS:
Wake time: ${wakeStr}
Recovery: ${recoveryBand}
HRV: ${todayHrv != null ? `${todayHrv}ms` : 'unknown'} (7-day avg: ${avg7dHrv != null ? `${Math.round(avg7dHrv)}ms` : 'unknown'})
Sleep last night: ${todaySleep != null ? `${todaySleep}h` : 'unknown'}${sleepVsYesterday ? ` (${sleepVsYesterday})` : ''}${sleepVsAvg ? `, ${sleepVsAvg}` : ''}
Sleep score: ${whoopData?.sleep_performance != null ? `${whoopData.sleep_performance}%` : 'unknown'}
RHR: ${whoopData?.rhr != null ? `${whoopData.rhr}bpm` : 'unknown'}

CALENDAR TODAY:
${calendarLines}

TASKS DUE TODAY:
${taskLines}

---

TODAY'S PLAN:
Use exact event times from the calendar. Weave in due tasks. Specific — what to do and when. If no events or tasks, say "No events or tasks today. Use the time to get ahead on something." Don't leave this section empty.

BODY STATUS:
2-3 assertive sentences using the actual numbers. Green recovery = push hard. Yellow = moderate pace. Red = back off. HRV above avg = primed. HRV below avg = stressed.

SLEEP CHECK:
State last night's hours, compare to yesterday and 7-day avg with exact minute numbers. If behind on sleep, last sentence must be: "Fix that tonight."

CLOSING:
Exactly one sentence. Tied to what's actually on his plate today. No generic lines.`

    // Try Anthropic first (if key is configured), fall through to OpenAI otherwise
    if (process.env.ANTHROPIC_API_KEY) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 900,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })
      const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : null
      let aiSections = stripMarkdown(raw) ?? ''
      const planIdx = aiSections.indexOf("TODAY'S PLAN")
      if (planIdx > 0) aiSections = aiSections.slice(planIdx)
      debriefMessage = aiSections ? `${routineSection}\n\n${aiSections}` : routineSection
    } else {
      // OpenAI primary path (no Anthropic key configured)
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const r = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 900,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      })
      let aiSections = stripMarkdown(r.choices[0]?.message?.content?.trim() ?? null) ?? ''
      const planIdx = aiSections.indexOf("TODAY'S PLAN")
      if (planIdx > 0) aiSections = aiSections.slice(planIdx)
      debriefMessage = aiSections ? `${routineSection}\n\n${aiSections}` : routineSection
    }
  } catch (err) {
    console.error('[debrief] AI generation failed:', err)
    debriefMessage = routineSection
  }

  // ── 9. Embed into brain memory (once per day) ────────────
  if (isFirstOpen) {
    const wakeStr = debrief.wake_time
      ? new Date(debrief.wake_time as string).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
      : null
    const memParts = [
      `Morning debrief ${today}`,
      wakeStr ? `woke at ${wakeStr}` : null,
      todaySleep != null ? `slept ${todaySleep}h` : null,
      todayHrv != null ? `HRV ${todayHrv}ms` : null,
      todayRecovery != null ? `recovery ${todayRecovery}%` : null,
      comparisons.length ? comparisons.join(', ') : null,
    ].filter(Boolean).join(', ')
    await embedMemory({ text: memParts, sourceType: 'note' })
  }

  // ── 10. Response ─────────────────────────────────────────
  return NextResponse.json({
    wake_time: (debrief.wake_time as string) ?? null,
    whoop_connected: whoopConnected,
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
    due_tasks: (dueTasks ?? []).map(t => ({
      id: t.id,
      title: t.title,
      urgency: t.urgency,
      tags: (t.tags as string[]) ?? [],
    })),
    debrief_message: debriefMessage,
  } satisfies DebriefResponse)
}

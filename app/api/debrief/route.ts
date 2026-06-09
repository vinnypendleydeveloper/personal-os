import { NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import { fetchWhoopData, getStoredTokens } from '@/lib/whoop'
import { embedMemory } from '@/lib/embed'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

const TZ = process.env.USER_TIMEZONE || 'America/Los_Angeles'

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

  // ── 8. Generate AI debrief ───────────────────────────────
  let debriefMessage: string | null = null
  try {
    const wakeStr = debrief.wake_time
      ? new Date(debrief.wake_time as string).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
      : 'unknown'

    const prompt = [
      'You are a personal morning debrief assistant. Write exactly 2-3 sentences as a focused daily briefing — specific, direct, energizing. Reference real numbers.',
      `Wake: ${wakeStr}. Sleep: ${todaySleep != null ? `${todaySleep}h` : 'unknown'}. HRV: ${todayHrv != null ? `${todayHrv}ms` : 'unknown'}. Recovery: ${todayRecovery != null ? `${todayRecovery}%` : 'unknown'}. Sleep performance: ${whoopData?.sleep_performance != null ? `${whoopData.sleep_performance}%` : 'unknown'}.`,
      comparisons.length ? `Observations: ${comparisons.join('; ')}.` : '',
      dueTasks?.length ? `Tasks due today: ${dueTasks.slice(0, 4).map(t => t.title).join(', ')}.` : 'No tasks due today.',
      'Avoid clichés. Be terse and grounded.',
    ].filter(Boolean).join(' ')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })
    debriefMessage = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : null
  } catch {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const wakeStr = debrief.wake_time
        ? new Date(debrief.wake_time as string).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
        : 'unknown'
      const r = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        messages: [{ role: 'user', content: `Morning debrief (2-3 sentences, specific): Wake ${wakeStr}. Sleep ${todaySleep}h. HRV ${todayHrv}ms. Recovery ${todayRecovery}%. ${comparisons.join('; ')}. Tasks: ${dueTasks?.map(t => t.title).join(', ')}. Be direct.` }],
      })
      debriefMessage = r.choices[0]?.message?.content?.trim() ?? null
    } catch { /* non-fatal */ }
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

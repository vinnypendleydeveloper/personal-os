import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import { complete } from '@/lib/ai'
import {
  gatherDebriefData, recoveryBand, calendarLines, taskLines, historyLines,
  saveDebriefHistory, fmtTime, todayKey, type DebriefData,
} from '@/lib/debriefData'

function stripMarkdown(text: string | null): string | null {
  if (!text) return null
  return text
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .trim()
}

// Section headers the routine-page renderer keys on (immediate-morning focus)
const FIRST_HEADER = 'WHERE YOU STAND'

export interface RoutineDebriefResponse {
  wake_time: string | null
  whoop_connected: boolean
  whoop: DebriefData['whoop']
  yesterday: DebriefData['yesterday']
  averages: DebriefData['averages']
  comparisons: string[]
  due_tasks: { id: string; title: string; urgency: string; tags: string[] }[]
  routine: { done: number; total: number; doneLabels: string[]; remainingLabels: string[]; allDone: boolean }
  intake: Record<string, unknown> | null
  debrief_message: string | null
}

interface RoutineIntake {
  energy?: string // low | medium | high
  focus?: string  // the one thing for this morning
  note?: string   // anything on his mind / blocking
}

async function generateRoutineDebrief(data: DebriefData, intake: RoutineIntake): Promise<string | null> {
  const wakeStr = data.wakeTime ? fmtTime(new Date(data.wakeTime)) : 'unknown'
  const now = new Date()
  const nowStr = fmtTime(now)

  const routineStatus = data.routine.total
    ? `${data.routine.doneCount}/${data.routine.total} done${data.routine.doneLabels.length ? ` (done: ${data.routine.doneLabels.join(', ')})` : ''}. Remaining: ${data.routine.remainingLabels.length ? data.routine.remainingLabels.join(', ') : 'none'}.`
    : 'No routine configured.'

  const intakeStr = [
    intake.energy ? `Energy right now: ${intake.energy}` : null,
    intake.focus ? `His #1 for this morning: ${intake.focus}` : null,
    intake.note ? `On his mind: ${intake.note}` : null,
  ].filter(Boolean).join('\n') || '(no intake given)'

  const system = `You are Vinny's personal morning coach. Hard rules:
1. Plain text only — zero markdown, no #, no **, no *.
2. Assertive, specific, zero filler. No "great job", no generic motivation.
3. Only use data explicitly provided. Never invent tasks, events, or numbers.
4. This is the IMMEDIATE-MORNING debrief — focus only on the next 1-2 hours, not the whole day.
5. Your response must start with the exact text "${FIRST_HEADER}:" and contain exactly these four sections in order.`

  const user = `Write Vinny's immediate morning debrief. It is ${nowStr} now. Output exactly these four sections, starting immediately with "${FIRST_HEADER}:".

CONTEXT
Wake time: ${wakeStr}
Recovery: ${recoveryBand(data.whoop?.recovery_score ?? null)}
HRV: ${data.whoop?.hrv != null ? `${data.whoop.hrv}ms` : 'unknown'} (7-day avg ${data.averages.hrv_7d ?? 'unknown'})
Sleep last night: ${data.whoop?.sleep_hours != null ? `${data.whoop.sleep_hours}h` : 'unknown'}
Morning routine: ${routineStatus}
Intake:
${intakeStr}

CALENDAR TODAY:
${calendarLines(data.calendar)}

TASKS DUE TODAY:
${taskLines(data.dueTasks)}

RECENT DEBRIEFS (for continuity — reference only if relevant):
${historyLines(data.history)}

---

${FIRST_HEADER}:
Acknowledge concretely where he is: how many routine steps done, what's left, and his stated energy. 1-2 sentences.

NEXT 1–2 HOURS:
A sharp, time-stamped plan for ONLY the next 1-2 hours starting from ${nowStr}. Finish the remaining routine steps, then his #1 focus, working around any calendar events in that window. Specific — what and roughly when. If nothing is pressing, say so and name the best use of the window.

BODY STATUS:
1-2 sentences using the actual recovery/HRV numbers. Green = push, yellow = moderate, red = back off.

ONE MOVE:
Exactly one sentence — the single most important thing to do right now.`

  try {
    const raw = await complete({ system, messages: user, maxTokens: 700 })
    let out = stripMarkdown(raw) ?? ''
    const idx = out.indexOf(FIRST_HEADER)
    if (idx > 0) out = out.slice(idx)
    return out || null
  } catch (err) {
    console.error('[debrief] AI generation failed:', err)
    return null
  }
}

function toResponse(data: DebriefData, intake: Record<string, unknown> | null, message: string | null): RoutineDebriefResponse {
  return {
    wake_time: data.wakeTime,
    whoop_connected: data.whoopConnected,
    whoop: data.whoop,
    yesterday: data.yesterday,
    averages: data.averages,
    comparisons: data.comparisons,
    due_tasks: data.dueTasks.map(t => ({ id: t.id, title: t.title, urgency: t.urgency, tags: t.tags })),
    routine: {
      done: data.routine.doneCount,
      total: data.routine.total,
      doneLabels: data.routine.doneLabels,
      remainingLabels: data.routine.remainingLabels,
      allDone: data.routine.allDone,
    },
    intake,
    debrief_message: message,
  }
}

async function readCached(): Promise<{ message: string | null; intake: Record<string, unknown> | null }> {
  const db = getServiceClient()
  const { data: row } = await db.from('daily_logs')
    .select('notes').eq('user_id', USER_ID).eq('log_date', todayKey()).maybeSingle()
  const debrief = ((row?.notes as Record<string, unknown>)?.morning_debrief as Record<string, unknown>) ?? {}
  return {
    message: (debrief.message as string) ?? null,
    intake: (debrief.intake as Record<string, unknown>) ?? null,
  }
}

async function writeCache(message: string, intake: Record<string, unknown>) {
  const db = getServiceClient()
  const { data: row } = await db.from('daily_logs')
    .select('id, notes').eq('user_id', USER_ID).eq('log_date', todayKey()).maybeSingle()
  const notes = (row?.notes ?? {}) as Record<string, unknown>
  const debrief = (notes.morning_debrief as Record<string, unknown>) ?? {}
  debrief.message = message
  debrief.intake = intake
  debrief.message_at = new Date().toISOString()
  notes.morning_debrief = debrief
  if (row) await db.from('daily_logs').update({ notes, updated_at: new Date().toISOString() }).eq('id', row.id)
  else await db.from('daily_logs').insert({ user_id: USER_ID, log_date: todayKey(), notes })
}

// GET — log wake time on first open, return cached debrief or generate a baseline
export async function GET() {
  const data = await gatherDebriefData({ logWake: true })
  const cached = await readCached()
  let message = cached.message
  if (!message) {
    message = await generateRoutineDebrief(data, (cached.intake as RoutineIntake) ?? {})
    if (message) await writeCache(message, cached.intake ?? {})
  }
  return NextResponse.json(toResponse(data, cached.intake, message))
}

// POST — Vinny submitted (or updated) intake → regenerate the scoped plan
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const intake: RoutineIntake = {
    energy: body.energy, focus: body.focus, note: body.note,
  }
  const data = await gatherDebriefData()
  const message = await generateRoutineDebrief(data, intake)
  if (message) {
    await writeCache(message, intake as Record<string, unknown>)
    await saveDebriefHistory('routine', intake as Record<string, unknown>, message)
  }
  return NextResponse.json(toResponse(data, intake as Record<string, unknown>, message))
}

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import { WHO_I_AM } from '@/lib/personalContext'
import { complete } from '@/lib/ai'
import {
  gatherDebriefData, recoveryBand, calendarLines, taskLines, historyLines,
  saveDebriefHistory, fmtTime, todayKey, type DebriefData,
} from '@/lib/debriefData'

interface DashboardIntake {
  wake_time?: string // "7:10 AM" or freeform
  energy?: string    // low | medium | high
  must_do?: string   // #1 must-get-done
  protect?: string   // free blocks to protect
}

function buildFullPlanPrompt(data: DebriefData, intake: DashboardIntake) {
  const now = new Date()
  const wake = intake.wake_time || (data.wakeTime ? fmtTime(new Date(data.wakeTime)) : 'unknown')
  const routineLine = data.routine.total
    ? `${data.routine.doneCount}/${data.routine.total} morning-routine steps done${
        data.routine.lastCompletedAt ? `, last at ${fmtTime(new Date(data.routine.lastCompletedAt))}` : ''
      }. Remaining: ${data.routine.remainingLabels.join(', ') || 'none'}.`
    : 'No routine configured.'

  const system = `${WHO_I_AM}

You are writing Vinny's in-depth daily briefing — the full version, like a sharp chief of staff who actually read his whole day. Rules:
- Output GitHub-flavored markdown.
- Be specific and real: weave actual calendar events, actual task names, and his stated priorities into concrete time blocks. Never vague.
- Anchor the schedule on real calendar events and any task time blocks. Slot high-priority/key tasks into the open windows between them. Account for travel/gaps between events, when his morning routine finished, and his energy.
- Respect recovery: green = push hard, yellow = moderate, red = protect recovery and keep training light.
- Honor any blocks he asked to protect.
- Reference recent debriefs for continuity only when genuinely relevant.
- Tight and high-signal — roughly 200 words. No filler, no generic motivation.`

  const trendLine = data.comparisons.length ? `Trends: ${data.comparisons.join('; ')}` : ''
  const dueTodayLine = data.dueTasks.length
    ? `DUE TODAY: ${data.dueTasks.map(t => t.title).join(', ')}`
    : ''

  const user = `Build today's full briefing. Current time: ${fmtTime(now)}.

BIOMETRICS:
Wake time: ${wake}
Recovery: ${recoveryBand(data.whoop?.recovery_score ?? null)}
Sleep last night: ${data.whoop?.sleep_hours != null ? `${data.whoop.sleep_hours}h` : 'unknown'}${data.whoop?.sleep_performance != null ? ` (${data.whoop.sleep_performance}% WHOOP sleep performance)` : ''}
HRV: ${data.whoop?.hrv != null ? `${data.whoop.hrv}ms` : 'unknown'} (7-day avg ${data.averages.hrv_7d ?? 'unknown'})
RHR: ${data.whoop?.rhr != null ? `${data.whoop.rhr}bpm` : 'unknown'}
Strain so far today: ${data.whoop?.strain != null ? data.whoop.strain.toFixed(1) : 'unknown'}
7-day averages: sleep ${data.averages.sleep_7d ?? 'unknown'}h, recovery ${data.averages.recovery_7d ?? 'unknown'}%${data.averages.sample_days > 0 ? ` (${data.averages.sample_days}-day sample)` : ''}
${trendLine}
Morning routine: ${routineLine}

INTAKE (what Vinny told you this morning):
Energy: ${intake.energy || 'not given'}
#1 must-get-done: ${intake.must_do || 'not given'}
Blocks to protect: ${intake.protect || 'none'}

CALENDAR TODAY:
${calendarLines(data.calendar)}

ALL OPEN TASKS (priority pN, ★ = key, time blocks shown):
${dueTodayLine ? `${dueTodayLine}\n` : ''}${taskLines(data.openTasks)}

RECENT DEBRIEFS (last 3, for continuity):
${historyLines(data.history)}

---
Write the briefing now in this markdown structure:

**[One-line greeting reflecting the time of day + his current state — reference recovery or a routine win]**

## Today's Plan
A time-blocked schedule as a list, starting from now. Each line: \`time range — what — (why, short phrase)\`. Anchor on real events and task time blocks; slot his #1 and key tasks into open windows; protect the blocks he named.

## One Thing
The single most important task today and why it moves a summer goal.`

  return { system, user }
}

async function generateFullPlan(data: DebriefData, intake: DashboardIntake): Promise<string> {
  const { system, user } = buildFullPlanPrompt(data, intake)
  return complete({ system, messages: user, maxTokens: 900 })
}

async function readToday() {
  const db = getServiceClient()
  const { data: row } = await db.from('daily_logs')
    .select('id, notes').eq('user_id', USER_ID).eq('log_date', todayKey()).maybeSingle()
  return { db, row }
}

async function cachePlan(plan: string, intake: DashboardIntake, generated_at: string) {
  const { db, row } = await readToday()
  const notes = (row?.notes ?? {}) as Record<string, unknown>
  notes.daily_plan = plan
  notes.daily_plan_at = generated_at
  notes.daily_plan_intake = intake
  if (row) await db.from('daily_logs').update({ notes, updated_at: generated_at }).eq('id', row.id)
  else await db.from('daily_logs').insert({ user_id: USER_ID, log_date: todayKey(), notes })
}

// GET — light: return cached plan + intake + cheap prefill defaults (no AI call)
export async function GET(req: NextRequest) {
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  const { row } = await readToday()
  const notes = (row?.notes ?? {}) as Record<string, unknown>
  const debrief = (notes.morning_debrief as Record<string, unknown>) ?? {}
  const whoop = (debrief.whoop as Record<string, unknown>) ?? null

  const defaults = {
    wake_time: debrief.wake_time ? new Date(debrief.wake_time as string).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null,
    recovery: (whoop?.recovery_score as number) ?? null,
  }

  if (!refresh && notes.daily_plan) {
    return NextResponse.json({
      plan: notes.daily_plan, generated_at: notes.daily_plan_at, cached: true,
      intake: notes.daily_plan_intake ?? null, defaults,
    })
  }

  // refresh=1 → regenerate using the last saved intake (or empty)
  if (refresh) {
    const data = await gatherDebriefData()
    const intake = (notes.daily_plan_intake as DashboardIntake) ?? {}
    const plan = await generateFullPlan(data, intake)
    const generated_at = new Date().toISOString()
    await cachePlan(plan, intake, generated_at)
    await saveDebriefHistory('dashboard', intake as Record<string, unknown>, plan)
    return NextResponse.json({ plan, generated_at, cached: false, intake, defaults })
  }

  return NextResponse.json({ plan: '', cached: false, intake: null, defaults })
}

// POST — Vinny submitted the intake form → generate the full briefing
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const intake: DashboardIntake = {
    wake_time: body.wake_time, energy: body.energy, must_do: body.must_do, protect: body.protect,
  }
  const data = await gatherDebriefData()
  const plan = await generateFullPlan(data, intake)
  const generated_at = new Date().toISOString()
  await cachePlan(plan, intake, generated_at)
  await saveDebriefHistory('dashboard', intake as Record<string, unknown>, plan)
  return NextResponse.json({ plan, generated_at, cached: false, intake })
}

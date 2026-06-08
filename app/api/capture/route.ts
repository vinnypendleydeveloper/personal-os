import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import { classifyCapture } from '@/lib/router/classifyCapture'
import { embedMemory } from '@/lib/embed'
import { matchHabit } from '@/lib/router/matchHabit'

// Today's date in the user's timezone (matches the Habits card's local date)
function todayKey(): string {
  const tz = process.env.USER_TIMEZONE || 'America/Los_Angeles'
  return new Date().toLocaleDateString('en-CA', { timeZone: tz }) // YYYY-MM-DD
}

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const { text, source = 'web' } = await req.json()

  if (!text?.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  // Classify
  const classification = await classifyCapture(text)

  // Write raw capture
  const { data: capture, error: captureError } = await db.from('raw_captures').insert({
    user_id: USER_ID,
    source,
    raw_text: text,
    classification,
    llm_source: 'anthropic',
    routed_to: classification.kind,
  }).select().single()

  if (captureError) {
    console.error('raw_captures insert error:', captureError)
    return NextResponse.json({ error: captureError.message }, { status: 500 })
  }

  // Route to downstream table
  let routedId: string | null = null

  if (classification.kind === 'task') {
    // Store the GTD "where" context as an @-prefixed tag alongside topical tags
    const tagsWithContext = [`@${classification.context}`, ...classification.tags]

    const { data: task, error: taskError } = await db.from('tasks').insert({
      user_id: USER_ID,
      title: classification.summary,
      description: text,
      urgency: classification.urgency,
      key: classification.key,
      tags: tagsWithContext,
      priority_score: classification.priority_score,
      time_estimate_min: classification.time_estimate_min,
    }).select().single()

    if (taskError) console.error('tasks insert error:', taskError)
    else routedId = task.id
  }

  // Auto-mark a habit if a capture fuzzy-matches one of the tracked habits.
  // Fires for tasks ("hit the gym today") AND past-tense logs ("did chest at the gym"),
  // which classify as note/journal. The matcher's NOT_DONE guard filters out
  // aspirations/plans ("should hit the gym", "gotta lift", "skipped the gym").
  let habitMarked: string | null = null
  if (['task', 'note', 'journal'].includes(classification.kind)) {
    const matched = matchHabit(`${classification.summary} ${text}`)
    if (matched) {
      const date = todayKey()
      const { data: dayRow } = await db.from('daily_logs')
        .select('id, notes').eq('user_id', USER_ID).eq('log_date', date).single()
      const notes = dayRow?.notes ?? {}
      const done: string[] = notes.habits?.done ?? []
      if (!done.includes(matched)) {
        const nextDone = [...done, matched]
        notes.habits = { done: nextDone, total: nextDone.length }
        if (dayRow) {
          await db.from('daily_logs').update({ notes, updated_at: new Date().toISOString() }).eq('id', dayRow.id)
        } else {
          await db.from('daily_logs').insert({ user_id: USER_ID, log_date: date, notes })
        }
      }
      habitMarked = matched
    }
  }

  // Update routed_id on capture
  if (routedId) {
    await db.from('raw_captures').update({ routed_id: routedId }).eq('id', capture.id)
  }

  // Build long-term memory: embed the capture (summary if it's a task) so the
  // brain can semantically recall it later, even months from now.
  await embedMemory({
    text: classification.kind === 'task' ? `Task: ${classification.summary} — ${text}` : text,
    sourceType: classification.kind === 'task' ? 'task' : 'capture',
    sourceId: routedId ?? capture.id,
  })

  // Audit log
  await db.from('audit_log').insert({
    user_id: USER_ID,
    action: 'capture',
    resource_type: 'raw_captures',
    resource_id: capture.id,
    metadata: { kind: classification.kind, source },
  })

  return NextResponse.json({ ok: true, classification, captureId: capture.id, habitMarked })
}

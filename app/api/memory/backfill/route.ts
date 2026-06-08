import { NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import { embedMemory } from '@/lib/embed'

// One-shot backfill: embed existing tasks, captures, and goals into memory_chunks.
// Idempotent-ish — skips anything already embedded (by source_id).
export async function POST() {
  const db = getServiceClient()

  // Which source_ids already have memory?
  const { data: existing } = await db.from('memory_chunks')
    .select('source_id').eq('user_id', USER_ID)
  const done = new Set((existing ?? []).map(r => r.source_id).filter(Boolean))

  let embedded = 0

  // Tasks
  const { data: tasks } = await db.from('tasks')
    .select('id, title, description, urgency, tags').eq('user_id', USER_ID)
  for (const t of tasks ?? []) {
    if (done.has(t.id)) continue
    await embedMemory({
      text: `Task: ${t.title}${t.description ? ` — ${t.description}` : ''} (${t.urgency}${(t.tags as string[])?.length ? ', ' + (t.tags as string[]).join(' ') : ''})`,
      sourceType: 'task',
      sourceId: t.id,
    })
    embedded++
  }

  // Captures
  const { data: captures } = await db.from('raw_captures')
    .select('id, raw_text').eq('user_id', USER_ID)
  for (const c of captures ?? []) {
    if (done.has(c.id)) continue
    await embedMemory({ text: c.raw_text, sourceType: 'capture', sourceId: c.id })
    embedded++
  }

  // Goals (from sentinel daily_log)
  const { data: goalsRow } = await db.from('daily_logs')
    .select('notes').eq('user_id', USER_ID).eq('log_date', '2000-01-01').single()
  const allGoals = [
    ...(goalsRow?.notes?.goals_week_items ?? []),
    ...(goalsRow?.notes?.goals_month_items ?? []),
  ]
  for (const g of allGoals) {
    if (done.has(g.id)) continue
    await embedMemory({ text: `Goal: ${g.text}`, sourceType: 'goal', sourceId: g.id })
    embedded++
  }

  return NextResponse.json({ ok: true, embedded })
}

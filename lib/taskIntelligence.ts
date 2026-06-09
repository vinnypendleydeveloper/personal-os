import { getServiceClient, USER_ID } from './supabase'
import { completeJSON } from './ai'
import { isMissingSchemaError, stripNewTaskColumns } from './taskColumns'

// ── Task intelligence ─────────────────────────────────────────────────────────
// Silent AI categorization of new tasks + a "prioritize my day" reorder. Both
// pass recent history from task_categorizations as context so the AI learns
// Vinny's patterns over time (Feature 4 — the learning layer).

type DB = ReturnType<typeof getServiceClient>

export type AiPriority = 'urgent' | 'high' | 'normal' | 'low'

// Map the AI's 4-level priority onto the numeric priority_score the CRM already
// uses (scoreToPriority: ≥75 high, ≥25 medium, ≥1 low, else none).
const PRIORITY_SCORE: Record<AiPriority, number> = {
  urgent: 100,
  high: 80,
  normal: 50,
  low: 15,
}

export interface EnrichResult {
  tags: string[]
  priority: AiPriority
  recurring: boolean
  recurring_confidence: number // 0..1 — if low, the UI asks Vinny
  enriched_title: string | null
  enriched_description: string | null
  reasoning: string
}

async function recentCategorizations(db: DB, limit = 24): Promise<string> {
  const { data } = await db
    .from('task_categorizations')
    .select('raw_title, inferred_tags, inferred_priority, recurring, user_overrode')
    .eq('user_id', USER_ID)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!data?.length) return '(no history yet)'
  return data
    .map(
      r =>
        `• "${r.raw_title}" → ${r.inferred_priority}${r.recurring ? ', recurring' : ''}${
          (r.inferred_tags as string[])?.length ? `, ${(r.inferred_tags as string[]).join(' ')}` : ''
        }${r.user_overrode ? ' (Vinny edited this)' : ''}`,
    )
    .join('\n')
}

const ENRICH_SYSTEM = `You are the task intelligence engine inside Vinny's personal OS. Vinny is an 18-year-old heading to USC for an IB (investment banking) internship: he's job/networking-hunting, coaches tennis (building private-lesson clients), and is building an AI business. He tracks tasks in a CRM-style kanban.

Given a freshly added task, infer structured metadata. Use the history of past categorizations to match HIS conventions (e.g. if networking tasks usually land at normal priority unless a deadline is mentioned, follow that).

Return ONLY a JSON object, no prose, with this exact shape:
{
  "tags": ["networking", "internships"],   // 1-3 lowercase topical tags, no '#'. Common ones: networking, internships, client, followup, tennis, business, admin, personal, finance, school
  "priority": "urgent|high|normal|low",     // urgent only for time-critical/deadline items
  "recurring": true|false,                  // is this a daily/repeating task vs one-time?
  "recurring_confidence": 0.0-1.0,          // how sure you are about recurring
  "enriched_title": "clearer title or null", // ONLY if the original is vague/terse; otherwise null. Keep it short and action-oriented.
  "enriched_description": "one helpful line or null", // optional concrete detail; else null
  "reasoning": "one short sentence on why"
}`

/**
 * Enrich a single task in place. Returns the updated task row (with ai_meta),
 * or null if the task is gone / the AI call failed.
 */
export async function enrichTask(taskId: string): Promise<Record<string, unknown> | null> {
  const db = getServiceClient()
  const { data: task } = await db
    .from('tasks')
    .select('id, title, description, urgency, tags, priority_score, due_date')
    .eq('id', taskId)
    .eq('user_id', USER_ID)
    .single()
  if (!task) return null

  const history = await recentCategorizations(db)
  const result = await completeJSON<EnrichResult>({
    system: ENRICH_SYSTEM,
    maxTokens: 400,
    messages: `PAST CATEGORIZATIONS (newest first):\n${history}\n\nNEW TASK:\nTitle: ${task.title}${
      task.description ? `\nDescription: ${task.description}` : ''
    }${task.due_date ? `\nDue date: ${task.due_date}` : ''}\n\nReturn the JSON now.`,
  })
  if (!result) return null

  // Preserve any @context tags Vinny set; merge in AI topical tags (deduped).
  const existingTags = (task.tags as string[]) ?? []
  const contextTags = existingTags.filter(t => t.startsWith('@'))
  const aiTags = (result.tags ?? []).map(t => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean)
  const mergedTags = Array.from(new Set([...contextTags, ...existingTags.filter(t => !t.startsWith('@')), ...aiTags]))

  const priority = (['urgent', 'high', 'normal', 'low'] as AiPriority[]).includes(result.priority)
    ? result.priority
    : 'normal'
  const newScore = PRIORITY_SCORE[priority]

  const ai_meta = {
    category: aiTags,
    priority,
    recurring: !!result.recurring,
    recurring_confidence: result.recurring_confidence ?? 0,
    reasoning: result.reasoning ?? '',
    original_title: task.title,
    original_priority_score: task.priority_score,
    needs_confirmation: (result.recurring_confidence ?? 1) < 0.6,
  }

  const update: Record<string, unknown> = {
    tags: mergedTags,
    priority_score: newScore,
    recurring: !!result.recurring,
    ai_enriched: true,
    ai_meta,
    updated_at: new Date().toISOString(),
  }
  // Apply a clearer title only when the AI judged the original vague
  if (result.enriched_title && result.enriched_title.trim() && result.enriched_title.trim() !== task.title) {
    update.title = result.enriched_title.trim()
  }
  if (result.enriched_description && result.enriched_description.trim() && !task.description) {
    update.description = result.enriched_description.trim()
  }

  let { data: updated, error: upErr } = await db
    .from('tasks').update(update).eq('id', taskId).eq('user_id', USER_ID).select().single()
  // Pre-migration: persist what we can (tags/priority/title) without the AI columns
  if (upErr && isMissingSchemaError(upErr)) {
    ;({ data: updated } = await db
      .from('tasks').update(stripNewTaskColumns(update)).eq('id', taskId).eq('user_id', USER_ID).select().single())
  }

  // Record the decision for future learning (no-op if the table doesn't exist yet)
  await db.from('task_categorizations').insert({
    user_id: USER_ID,
    task_id: taskId,
    raw_title: task.title,
    inferred_tags: aiTags,
    inferred_priority: priority,
    recurring: !!result.recurring,
    enriched_title: (update.title as string) ?? null,
    confidence: result.recurring_confidence ?? null,
    user_overrode: false,
  })

  return updated ?? null
}

// ── Prioritize my day ─────────────────────────────────────────────────────────

const PRIORITIZE_SYSTEM = `You are Vinny's chief of staff. Given his open tasks, produce the optimal order to tackle them TODAY. Weigh: explicit priority, whether a task is time-blocked (fixed start time — those anchor the day), deadlines/due dates, recurring daily tasks vs one-time pushes, and momentum. Be decisive.

Return ONLY JSON: { "order": [ { "id": "<task id>", "reason": "<short why, e.g. 'deadline-sensitive, flagged urgent'>" }, ... ] }
Every task id you were given must appear exactly once. Reasons should be terse (max ~8 words), human-readable, and NEVER contain a raw task id/UUID — refer to other tasks by name if needed. Only include a reason for tasks whose position is non-obvious — use "" for the rest.`

export interface PrioritizeItem {
  id: string
  reason: string
}

export async function prioritizeTasks(): Promise<PrioritizeItem[] | null> {
  const db = getServiceClient()
  let tasks: Record<string, unknown>[] | null = null
  {
    const rich = await db.from('tasks')
      .select('id, title, urgency, key, priority_score, tags, due_date, start_time, duration_min, recurring')
      .eq('user_id', USER_ID).is('completed_at', null)
    tasks = rich.data as Record<string, unknown>[] | null
    // Pre-migration fallback: original columns only
    if (!tasks) {
      const base = await db.from('tasks')
        .select('id, title, urgency, key, priority_score, tags, due_date')
        .eq('user_id', USER_ID).is('completed_at', null)
      tasks = base.data as Record<string, unknown>[] | null
    }
  }
  if (!tasks?.length) return []

  const fmt = (s: string | null) =>
    s ? new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null
  const lines = tasks
    .map(t => {
      const time = fmt(t.start_time as string | null)
      const tags = (t.tags as string[])?.filter(x => !x.startsWith('@')).join(' ')
      return `ID:${t.id} | ${t.title} | p${t.priority_score}${t.key ? ' ★' : ''}${
        t.recurring ? ' [daily]' : ''
      }${time ? ` | @${time}` : ''}${t.due_date ? ` | due ${t.due_date}` : ''}${tags ? ` | ${tags}` : ''}`
    })
    .join('\n')

  const result = await completeJSON<{ order: PrioritizeItem[] }>({
    system: PRIORITIZE_SYSTEM,
    maxTokens: 2200, // UUIDs + reasons for ~20 tasks; avoid truncated JSON
    messages: `OPEN TASKS:\n${lines}\n\nReturn the ordered JSON now.`,
  })
  if (!result?.order) return null

  // Keep only valid ids, and append any the model dropped so nothing is lost.
  const valid = new Set(tasks.map(t => String(t.id)))
  const seen = new Set<string>()
  const ordered: PrioritizeItem[] = []
  for (const item of result.order) {
    if (valid.has(item.id) && !seen.has(item.id)) {
      seen.add(item.id)
      ordered.push({ id: item.id, reason: item.reason ?? '' })
    }
  }
  for (const t of tasks) if (!seen.has(String(t.id))) ordered.push({ id: String(t.id), reason: '' })
  return ordered
}

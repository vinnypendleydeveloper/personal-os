// Defensive helpers so the app keeps working BEFORE migration 004 is applied.
// The new task columns (time blocks + AI enrichment) and learning tables only
// exist once Vinny runs migrations/004_intelligence.sql. Until then, inserts /
// updates / selects that reference them would 500 — these helpers detect the
// "column/table does not exist" error and fall back gracefully.

export const NEW_TASK_COLUMNS = ['start_time', 'duration_min', 'recurring', 'ai_enriched', 'ai_meta'] as const

export interface PgError { code?: string; message?: string }

export function isMissingSchemaError(err: PgError | null | undefined): boolean {
  if (!err) return false
  // 42703 = undefined_column, 42P01 = undefined_table (Postgres);
  // PGRST204 = column not found in PostgREST schema cache.
  if (err.code === '42703' || err.code === '42P01' || err.code === 'PGRST204') return true
  return /column .* does not exist|could not find the .* column|relation .* does not exist|schema cache/i.test(err.message ?? '')
}

export function stripNewTaskColumns<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const copy: Record<string, unknown> = { ...obj }
  for (const k of NEW_TASK_COLUMNS) delete copy[k]
  return copy as Partial<T>
}

// Columns that always exist (original schema) — used as the fallback select.
export const BASE_TASK_SELECT = 'id, title, description, urgency, key, priority_score, time_estimate_min, tags, due_date, completed_at'

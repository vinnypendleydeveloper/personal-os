import { getServiceClient, USER_ID } from './supabase'

const TZ = process.env.USER_TIMEZONE || 'America/Los_Angeles'

export interface LoggedSet { weight: number | null; reps: number | null }
export interface LoggedExercise {
  name: string
  group: string
  unit: 'weight' | 'reps' | 'time'
  target: string
  sets: LoggedSet[]
}
export interface GymSession {
  day: number
  label: string
  exercises: LoggedExercise[]
  abs_included: boolean
  whoop_strain: number | null
  sauna: boolean
  notes: string
  saved_at: string
}
export type SessionWithDate = GymSession & { date: string }

export function todayKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

type DB = ReturnType<typeof getServiceClient>

export async function fetchSessions(db: DB): Promise<SessionWithDate[]> {
  const since = new Date(); since.setDate(since.getDate() - 400)
  const { data } = await db.from('daily_logs')
    .select('log_date, notes')
    .eq('user_id', USER_ID)
    .gte('log_date', since.toISOString().slice(0, 10))
    .order('log_date', { ascending: false })
  return (data ?? [])
    .filter(r => r.notes?.gym_session)
    .map(r => ({ date: r.log_date, ...(r.notes.gym_session as GymSession) }))
}

// Best (top) numbers for an exercise this session
export function exerciseBest(ex: LoggedExercise): { weight: number; reps: number } {
  let weight = 0, reps = 0
  for (const s of ex.sets ?? []) {
    if (typeof s.weight === 'number') weight = Math.max(weight, s.weight)
    if (typeof s.reps === 'number') reps = Math.max(reps, s.reps)
  }
  return { weight, reps }
}

export type ProgressStatus = 'up' | 'same' | 'down' | 'new'
export interface ProgressEntry { status: ProgressStatus; label: string }

export function diffExercise(curr: LoggedExercise, prev: LoggedExercise | undefined): ProgressEntry {
  if (!prev) return { status: 'new', label: 'new' }
  const c = exerciseBest(curr), p = exerciseBest(prev)
  const unit = curr.unit
  if (unit === 'weight') {
    if (c.weight > p.weight) return { status: 'up', label: `+${Math.round(c.weight - p.weight)}lbs` }
    if (c.weight < p.weight) return { status: 'down', label: `−${Math.round(p.weight - c.weight)}lbs` }
    // same weight → compare reps
    if (c.reps > p.reps) return { status: 'up', label: `+${c.reps - p.reps} reps` }
    if (c.reps < p.reps) return { status: 'down', label: `−${p.reps - c.reps} reps` }
    return { status: 'same', label: 'matched' }
  }
  // reps / time units → compare reps field (reps or seconds)
  const unitWord = unit === 'time' ? 'sec' : 'reps'
  if (c.reps > p.reps) return { status: 'up', label: `+${c.reps - p.reps} ${unitWord}` }
  if (c.reps < p.reps) return { status: 'down', label: `−${p.reps - c.reps} ${unitWord}` }
  return { status: 'same', label: 'matched' }
}

// Compare a session to the most recent prior session with the same day number
export function computeProgress(current: SessionWithDate, all: SessionWithDate[]) {
  const prior = all
    .filter(s => s.day === current.day && s.date < current.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  const progress: Record<string, ProgressEntry> = {}
  let up = 0, same = 0, down = 0
  for (const ex of current.exercises) {
    const prevEx = prior?.exercises.find(e => e.name === ex.name)
    const d = diffExercise(ex, prevEx)
    progress[ex.name] = d
    if (d.status === 'up') up++
    else if (d.status === 'same') same++
    else if (d.status === 'down') down++
  }
  return { progress, summary: { up, same, down, comparedTo: prior?.date ?? null } }
}

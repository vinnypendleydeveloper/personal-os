import { getServiceClient, USER_ID } from './supabase'

const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const WHOOP_API = 'https://api.prod.whoop.com/developer'

export interface WhoopTokens {
  access_token: string
  refresh_token: string
  expires_at: number // unix ms
}

export interface WhoopData {
  recovery_score: number | null
  hrv: number | null
  rhr: number | null
  sleep_performance: number | null
  sleep_hours: number | null
  strain: number | null
  spo2: number | null
  updated_at: string
}

// ── Token storage in daily_logs sentinel row ─────────────────
const TOKEN_SENTINEL = '1999-01-01'

export async function getStoredTokens(): Promise<WhoopTokens | null> {
  const db = getServiceClient()
  const { data } = await db.from('daily_logs')
    .select('notes')
    .eq('user_id', USER_ID)
    .eq('log_date', TOKEN_SENTINEL)
    .single()
  return data?.notes?.whoop_tokens ?? null
}

export async function storeTokens(tokens: WhoopTokens) {
  const db = getServiceClient()
  const { data: existing } = await db.from('daily_logs')
    .select('id, notes').eq('user_id', USER_ID).eq('log_date', TOKEN_SENTINEL).single()
  const notes = existing?.notes ?? {}
  notes.whoop_tokens = tokens
  existing
    ? await db.from('daily_logs').update({ notes, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : await db.from('daily_logs').insert({ user_id: USER_ID, log_date: TOKEN_SENTINEL, notes })
}

export async function clearTokens() {
  const db = getServiceClient()
  const { data: existing } = await db.from('daily_logs')
    .select('id, notes').eq('user_id', USER_ID).eq('log_date', TOKEN_SENTINEL).single()
  if (existing) {
    const notes = existing.notes ?? {}
    delete notes.whoop_tokens
    await db.from('daily_logs').update({ notes }).eq('id', existing.id)
  }
}

// ── Token refresh ─────────────────────────────────────────────
export async function refreshTokens(refresh_token: string): Promise<WhoopTokens> {
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Whoop token refresh failed: ${JSON.stringify(data)}`)
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
}

// ── Get a valid access token (auto-refresh if needed) ─────────
export async function getValidToken(): Promise<string | null> {
  let tokens = await getStoredTokens()
  if (!tokens) return null

  // Refresh if expiring within 5 minutes
  if (Date.now() > tokens.expires_at - 5 * 60 * 1000) {
    try {
      tokens = await refreshTokens(tokens.refresh_token)
      await storeTokens(tokens)
    } catch {
      return null
    }
  }
  return tokens.access_token
}

// ── Fetch Whoop data ──────────────────────────────────────────
export async function fetchWhoopData(): Promise<WhoopData | null> {
  const token = await getValidToken()
  if (!token) return null

  async function get(path: string) {
    const r = await fetch(`${WHOOP_API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return null
    return r.json()
  }

  // Fetch in parallel
  const [recovery, cycle, sleep] = await Promise.all([
    get('/v2/recovery?limit=1'),
    get('/v2/cycle?limit=1'),
    get('/v2/activity/sleep?limit=1'),
  ])

  const rec = recovery?.records?.[0]
  const cyc = cycle?.records?.[0]
  const slp = sleep?.records?.[0]

  // Sleep hours from stage_summary
  const sleepMs = slp?.score?.stage_summary
    ? (slp.score.stage_summary.total_light_sleep_time_milli ?? 0) +
      (slp.score.stage_summary.total_slow_wave_sleep_time_milli ?? 0) +
      (slp.score.stage_summary.total_rem_sleep_time_milli ?? 0)
    : null

  return {
    recovery_score: rec?.score?.recovery_score ?? null,
    hrv: rec?.score?.hrv_rmssd_milli ? Math.round(rec.score.hrv_rmssd_milli) : null,
    rhr: rec?.score?.resting_heart_rate ?? null,
    sleep_performance: slp?.score?.sleep_performance_percentage ?? null,
    sleep_hours: sleepMs ? Math.round(sleepMs / 3_600_000 * 10) / 10 : null,
    strain: cyc?.score?.strain ? Math.round(cyc.score.strain * 10) / 10 : null,
    spo2: rec?.score?.spo2_percentage ? Math.round(rec.score.spo2_percentage * 10) / 10 : null,
    updated_at: new Date().toISOString(),
  }
}

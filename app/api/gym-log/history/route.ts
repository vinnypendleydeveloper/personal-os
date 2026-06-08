import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { fetchSessions, computeProgress } from '@/lib/gymLog'

export async function GET() {
  const db = getServiceClient()
  const sessions = await fetchSessions(db) // newest first

  // Progress for the most recent session vs its prior same-day session
  const latestProgress = sessions.length ? computeProgress(sessions[0], sessions) : null

  return NextResponse.json({ sessions, latestProgress })
}

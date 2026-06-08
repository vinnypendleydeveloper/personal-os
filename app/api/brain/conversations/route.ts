import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// GET /api/brain/conversations?limit=200
// Returns messages oldest→newest so the client can group by date.
export async function GET(req: NextRequest) {
  const db = getServiceClient()
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '200'), 500)

  // Pull the most recent `limit` messages, then return chronological order.
  const { data, error } = await db
    .from('brain_conversations')
    .select('id, role, content, created_at')
    .eq('user_id', USER_ID)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ messages: [] })

  const messages = (data ?? []).reverse()
  return NextResponse.json({ messages })
}

// POST /api/brain/conversations  { question, answer }
// Saves one completed turn (user message + assistant response) as two rows.
export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const { question, answer } = await req.json()

  if (!question?.trim() || !answer?.trim()) {
    return NextResponse.json({ error: 'Both question and answer are required' }, { status: 400 })
  }

  // Slight ordering offset so the user row always sorts before the assistant row.
  const now = Date.now()
  const { error } = await db.from('brain_conversations').insert([
    { user_id: USER_ID, role: 'user', content: String(question).slice(0, 8000), created_at: new Date(now).toISOString() },
    { user_id: USER_ID, role: 'assistant', content: String(answer).slice(0, 8000), created_at: new Date(now + 1).toISOString() },
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

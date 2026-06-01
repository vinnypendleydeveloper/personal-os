import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'

// Reviews stored on sentinel dates keyed by week number
function weekKey() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
  return `review-W${String(week).padStart(2, '0')}-${now.getFullYear()}`
}

export async function GET(req: NextRequest) {
  const db = getServiceClient()
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('week') ?? weekKey()

  const { data } = await db.from('raw_captures')
    .select('raw_text, created_at')
    .eq('user_id', USER_ID)
    .eq('source', 'review')
    .ilike('raw_text', `%${key}%`)
    .single()

  if (!data) return NextResponse.json({ review: null, week: key })

  try {
    const review = JSON.parse(data.raw_text.replace(`${key}::`, ''))
    return NextResponse.json({ review, week: key })
  } catch {
    return NextResponse.json({ review: null, week: key })
  }
}

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const { review, week } = await req.json()
  const key = week ?? weekKey()

  const payload = `${key}::${JSON.stringify(review)}`

  // Upsert — delete old then insert
  await db.from('raw_captures')
    .delete()
    .eq('user_id', USER_ID)
    .eq('source', 'review')
    .ilike('raw_text', `%${key}%`)

  await db.from('raw_captures').insert({
    user_id: USER_ID,
    source: 'review',
    raw_text: payload,
    classification: { kind: 'review' },
  })

  return NextResponse.json({ ok: true, week: key })
}

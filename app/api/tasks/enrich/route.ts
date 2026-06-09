import { NextRequest, NextResponse } from 'next/server'
import { enrichTask } from '@/lib/taskIntelligence'

// POST /api/tasks/enrich  { id }
// Silent, background AI categorization of a freshly created task. The client
// fires this right after adding a task, then merges the result back into the
// card (sparkle indicator). Returns the enriched task row.
export async function POST(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    const task = await enrichTask(id)
    if (!task) return NextResponse.json({ error: 'enrich failed' }, { status: 200 })
    return NextResponse.json({ task })
  } catch (err) {
    console.error('[enrich] failed:', err)
    return NextResponse.json({ error: 'enrich failed' }, { status: 200 })
  }
}

import { NextResponse } from 'next/server'
import { prioritizeTasks } from '@/lib/taskIntelligence'

// POST /api/tasks/prioritize
// "Prioritize My Day" — AI reorders all open tasks and returns ordered ids with
// brief per-move reasons.
export async function POST() {
  try {
    const order = await prioritizeTasks()
    if (!order) return NextResponse.json({ order: [], error: 'could not prioritize' })
    return NextResponse.json({ order })
  } catch (err) {
    console.error('[prioritize] failed:', err)
    return NextResponse.json({ order: [], error: 'could not prioritize' })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const { query } = await req.json()

  // Get all open tasks
  const { data: tasks } = await db.from('tasks')
    .select('id, title, description, urgency, key, tags, priority_score')
    .eq('user_id', USER_ID)
    .is('completed_at', null)

  if (!tasks?.length) return NextResponse.json({ ids: [] })

  const taskList = tasks.map(t =>
    `ID:${t.id} | [${t.urgency}]${t.key ? ' ★' : ''} ${t.title}`
  ).join('\n')

  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: `You are a task prioritization assistant. Given a natural language query and a list of tasks, return a JSON array of task IDs that best match the query — most relevant first. Return only the JSON array, no other text. Example: ["id1","id2"]`,
    messages: [{
      role: 'user',
      content: `Query: "${query}"\n\nTasks:\n${taskList}`
    }]
  })

  try {
    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    const ids: string[] = JSON.parse(raw)
    return NextResponse.json({ ids })
  } catch {
    return NextResponse.json({ ids: [] })
  }
}

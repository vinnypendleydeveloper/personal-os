import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import { buildContext, buildSystemPrompt, loadConversationMemory } from '@/lib/personalContext'
import { streamChat, type AiMsg as Msg } from '@/lib/ai'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const body = await req.json()
  // Accept either a single { question } or a multi-turn { history: Msg[] }
  const history: Msg[] = Array.isArray(body.history) ? body.history : []
  const question: string = body.question ?? history[history.length - 1]?.content ?? ''
  const plan: string = typeof body.plan === 'string' ? body.plan : ''
  if (!question?.trim() && history.length === 0) {
    return NextResponse.json({ error: 'No question' }, { status: 400 })
  }

  const contextBlocks = await buildContext(db)
  let systemPrompt = buildSystemPrompt(contextBlocks)

  // The day's current plan, so the assistant can reason about and edit it
  if (plan.trim()) {
    systemPrompt += `\n\n=== TODAY'S CURRENT PLAN (the one Vinny is looking at) ===\n${plan}\n\nWhen Vinny asks to change his day ("move my 2pm earlier", "add a gym block at 6pm", "what should I skip?"), respond by restating the affected part of the plan with the change applied — concrete times and task names — not vague advice. Keep edits consistent with his real calendar events and task time blocks above. Markdown, tight, no filler.`
  }

  // Semantic memory recall
  try {
    const embRes = await openai.embeddings.create({ model: 'text-embedding-3-small', input: question })
    const { data: chunks } = await db.rpc('match_memory_chunks', {
      query_embedding: embRes.data[0].embedding,
      match_user_id: USER_ID,
      match_count: 8,
    })
    if (chunks?.length) {
      const memText = (chunks as { text: string; source_type: string }[])
        .map(c => `• [${c.source_type}] ${c.text.slice(0, 150)}`).join('\n')
      systemPrompt += `\n\n=== SEMANTIC MEMORY (relevant past items) ===\n${memText}`
    }
  } catch {}

  // Build the message list. If the client sent an explicit multi-turn history,
  // honor it. Otherwise replay the last 10 turns from persistent memory so the
  // AI remembers prior sessions, then append the new question.
  let messages: Msg[]
  if (history.length > 0) {
    messages = history
  } else {
    const memory = await loadConversationMemory(db, 10)
    messages = [...memory, { role: 'user', content: question }]
  }

  const stream = await streamChat({ system: systemPrompt, messages, maxTokens: 800 })
  return new NextResponse(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

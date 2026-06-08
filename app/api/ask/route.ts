import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import { buildContext, buildSystemPrompt, loadConversationMemory } from '@/lib/personalContext'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Msg = { role: 'user' | 'assistant'; content: string }

async function streamFromAnthropic(system: string, messages: Msg[]): Promise<ReadableStream> {
  const encoder = new TextEncoder()
  const stream = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 700,
    stream: true,
    system,
    messages,
  })
  return new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(event.delta.text))
        }
      }
      controller.close()
    },
  })
}

async function streamFromOpenAI(system: string, messages: Msg[]): Promise<ReadableStream> {
  const encoder = new TextEncoder()
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 700,
    stream: true,
    messages: [{ role: 'system', content: system }, ...messages],
  })
  return new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? ''
        if (text) controller.enqueue(encoder.encode(text))
      }
      controller.close()
    },
  })
}

async function tryStream(system: string, messages: Msg[]): Promise<ReadableStream> {
  try {
    return await streamFromAnthropic(system, messages)
  } catch {
    return await streamFromOpenAI(system, messages)
  }
}

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const body = await req.json()
  // Accept either a single { question } or a multi-turn { history: Msg[] }
  const history: Msg[] = Array.isArray(body.history) ? body.history : []
  const question: string = body.question ?? history[history.length - 1]?.content ?? ''
  if (!question?.trim() && history.length === 0) {
    return NextResponse.json({ error: 'No question' }, { status: 400 })
  }

  const contextBlocks = await buildContext(db)
  let systemPrompt = buildSystemPrompt(contextBlocks)

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

  const stream = await tryStream(systemPrompt, messages)
  return new NextResponse(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

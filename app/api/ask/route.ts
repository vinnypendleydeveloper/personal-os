import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const { question } = await req.json()

  // Embed question
  const embRes = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: question,
  })
  const embedding = embRes.data[0].embedding

  // Get top 20 memory chunks
  let chunks: { text: string; source_type: string; id: string }[] = []
  const { data } = await db.rpc('match_memory_chunks', {
    query_embedding: embedding,
    match_user_id: USER_ID,
    match_count: 20,
  })
  if (data) chunks = data

  // Fallback to recent captures if no vector results
  if (chunks.length === 0) {
    const { data: captures } = await db.from('raw_captures')
      .select('id, raw_text, created_at')
      .eq('user_id', USER_ID)
      .order('created_at', { ascending: false })
      .limit(20)
    chunks = (captures ?? []).map(c => ({ id: c.id, text: c.raw_text, source_type: 'capture' }))
  }

  const context = chunks
    .map(c => `[${c.id.slice(0, 8)}] (${c.source_type}): ${c.text.slice(0, 200)}`)
    .join('\n')

  const stream = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    stream: true,
    system: `You are the user's personal assistant. Answer the question using ONLY the context provided. Cite sources by referring to capture IDs in [brackets]. If you don't have enough context, say so.`,
    messages: [{ role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` }],
  })

  // Stream the response
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(event.delta.text))
        }
      }
      controller.close()
    },
  })

  return new NextResponse(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

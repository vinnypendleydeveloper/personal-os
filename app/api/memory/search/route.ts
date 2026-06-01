import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const { query } = await req.json()

  // Embed the query
  const embRes = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  })
  const embedding = embRes.data[0].embedding

  // Vector similarity search via Supabase RPC
  const { data, error } = await db.rpc('match_memory_chunks', {
    query_embedding: embedding,
    match_user_id: USER_ID,
    match_count: 20,
  })

  if (error) {
    // Fallback: simple text search if RPC not set up yet
    const { data: fallback } = await db.from('raw_captures')
      .select('id, raw_text, created_at, source')
      .eq('user_id', USER_ID)
      .ilike('raw_text', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      results: (fallback ?? []).map(r => ({
        id: r.id,
        text: r.raw_text,
        source_type: 'capture',
        created_at: r.created_at,
      }))
    })
  }

  return NextResponse.json({ results: data ?? [] })
}

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getServiceClient, USER_ID } from '@/lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = getServiceClient()

  // Fetch the feature to get title + notes for context
  const { data: feature, error: fetchError } = await db
    .from('new_features')
    .select('title, notes')
    .eq('id', id)
    .eq('user_id', USER_ID)
    .single()

  if (fetchError || !feature) {
    return NextResponse.json({ error: 'feature not found' }, { status: 404 })
  }

  const prompt = `You are a developer assistant summarizing a completed feature. Write 2-3 concise sentences describing what this feature does and how it was completed. Be specific, technical, and informative. Do not use bullet points. Do not add a title or heading. Just write the summary paragraph.

Feature title: "${feature.title}"
${feature.notes ? `Notes: "${feature.notes}"` : ''}

Write the summary now:`

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const summary = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''

  // Save completed_at and summary to Supabase
  const { data: updated, error: updateError } = await db
    .from('new_features')
    .update({ completed_at: new Date().toISOString(), completion_summary: summary })
    .eq('id', id)
    .eq('user_id', USER_ID)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ feature: updated })
}

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { title, notes, totalFeatures } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const prompt = `You are a product prioritization assistant. Given a feature request, suggest a priority level and where it should rank in the backlog.

Feature title: "${title}"
${notes ? `Notes: "${notes}"` : ''}
Current backlog size: ${totalFeatures ?? 0} items

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{"priority":"High","suggestedRank":0,"reasoning":"One concise sentence explaining why."}

Priority must be exactly "High", "Medium", or "Low".
suggestedRank is 0-indexed position in the list (0 = top). Must be between 0 and ${totalFeatures ?? 0}.`

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  try {
    const parsed = JSON.parse(raw)
    if (!['High', 'Medium', 'Low'].includes(parsed.priority)) {
      return NextResponse.json({ error: 'invalid priority' }, { status: 500 })
    }
    return NextResponse.json({
      priority: parsed.priority,
      suggestedRank: Math.max(0, Math.min(parsed.suggestedRank ?? 0, totalFeatures ?? 0)),
      reasoning: parsed.reasoning ?? '',
    })
  } catch {
    return NextResponse.json({ error: 'parse failed', raw }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { features } = await req.json()
  if (!Array.isArray(features) || features.length === 0) {
    return NextResponse.json({ error: 'features required' }, { status: 400 })
  }

  const list = features
    .map((f: { title: string; notes?: string | null; priority?: string | null; category?: string | null; effort?: string | null }, i: number) =>
      `${i + 1}. [${f.priority ?? 'no priority'}] ${f.title}${f.notes ? ` — ${f.notes}` : ''}${f.category ? ` (${f.category}` : ''}${f.effort ? `, ${f.effort} effort)` : f.category ? ')' : ''}`
    )
    .join('\n')

  const prompt = `You are a product development advisor. Analyze this feature backlog and recommend what to build next.

Backlog:
${list}

Give a short, direct recommendation (3–5 sentences max). Name the top 2–3 features to tackle in order, explain why briefly, and call out any quick wins or blockers. Be specific and opinionated — no hedging.`

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  return NextResponse.json({ recommendation: text })
}

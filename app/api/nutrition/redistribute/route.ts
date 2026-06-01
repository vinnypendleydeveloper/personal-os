import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { name, kcal } = await req.json()

  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 128,
    system: `You redistribute macros for a food given a new calorie target. Return ONLY JSON: {"p": number, "c": number, "f": number}. Use realistic macro ratios for the food. No markdown, no explanation.`,
    messages: [{ role: 'user', content: `Food: ${name}, Calories: ${kcal}` }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text.trim()
  return NextResponse.json(JSON.parse(raw))
}

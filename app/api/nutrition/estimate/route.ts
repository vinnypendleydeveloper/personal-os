import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { text } = await req.json()

  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 128,
    system: `You are a nutrition estimator. Given a food description, return ONLY a JSON object with these exact keys:
{"kcal": number, "p": number, "c": number, "f": number}
kcal = calories, p = protein grams, c = carb grams, f = fat grams.
Be realistic. No markdown, no explanation, just the JSON.`,
    messages: [{ role: 'user', content: text }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text.trim()
  return NextResponse.json(JSON.parse(raw))
}

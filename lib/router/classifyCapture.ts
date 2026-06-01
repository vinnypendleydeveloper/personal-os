import Anthropic from '@anthropic-ai/sdk'

export interface Classification {
  kind: 'task' | 'note' | 'journal' | 'goal' | 'other'
  urgency: 'today' | 'this_week' | 'this_month' | 'someday'
  key: boolean
  tags: string[]
  summary: string
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `You are a personal assistant classifier. Given a raw text capture, return JSON only:
{
  "kind": "task" | "note" | "journal" | "goal" | "other",
  "urgency": "today" | "this_week" | "this_month" | "someday",
  "key": boolean,
  "tags": string[],
  "summary": string (one sentence, max 100 chars)
}

Rules:
- kind=task if it's something to do
- kind=goal if it's an aspiration or objective
- kind=journal if it's a reflection or daily note
- kind=note otherwise
- key=true only if it seems urgent or important
- urgency based on any time signals in the text
- tags: 1-3 relevant lowercase words
Output raw JSON only, no markdown.`

export async function classifyCapture(text: string): Promise<Classification> {
  try {
    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM,
      messages: [{ role: 'user', content: text }],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    return JSON.parse(raw)
  } catch {
    // Regex fallback
    const lower = text.toLowerCase()
    const urgency = lower.includes('today') || lower.includes('asap') ? 'today'
      : lower.includes('this week') ? 'this_week'
      : lower.includes('this month') ? 'this_month'
      : 'someday'
    return {
      kind: 'note',
      urgency,
      key: false,
      tags: [],
      summary: text.slice(0, 100),
    }
  }
}

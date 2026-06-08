import Anthropic from '@anthropic-ai/sdk'

// GTD-style "where" contexts tuned to Vinny's life
export const CONTEXTS = [
  'deep-work', // computer focus: AI business, applications, building
  'gym',       // workouts / training
  'court',     // tennis: coaching, lessons, playing
  'campus',    // USC / school
  'calls',     // phone, outreach, DMs, networking
  'errands',   // out and about
  'home',      // household
  'anywhere',  // no specific place
] as const

export type Context = (typeof CONTEXTS)[number]

export interface Classification {
  kind: 'task' | 'note' | 'journal' | 'goal' | 'other'
  urgency: 'today' | 'this_week' | 'this_month' | 'someday'
  context: Context
  key: boolean
  priority_score: number   // 1–100
  time_estimate_min: number | null
  tags: string[]           // topical, lowercase, no @
  summary: string
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `You are a personal productivity classifier for Vinny — a USC student, tennis coach, and AI-business builder.
Given a raw text capture, return JSON only:
{
  "kind": "task" | "note" | "journal" | "goal" | "other",
  "urgency": "today" | "this_week" | "this_month" | "someday",
  "context": "deep-work" | "gym" | "court" | "campus" | "calls" | "errands" | "home" | "anywhere",
  "key": boolean,
  "priority_score": number,
  "time_estimate_min": number | null,
  "tags": string[],
  "summary": string
}

Field rules:
- kind=task if it's something to do; goal if an aspiration; journal if a reflection; note otherwise.
- urgency = WHEN it should happen, inferred from time signals ("today", "by friday", "this week"). Default "someday".
- context = WHERE / in what mode it gets done:
    deep-work = at a computer building/writing (AI business, code, applications, essays)
    gym = workouts, lifting, training
    court = tennis — coaching, private lessons, playing
    campus = on USC campus / classes / school admin
    calls = phone calls, texts, DMs, outreach, networking
    errands = out running errands, shopping, in-person tasks
    home = household chores / at home
    anywhere = no specific place
- key = true only if genuinely important AND time-sensitive.
- priority_score = 1–100. Combine importance and urgency:
    90–100 urgent + important (today + key)
    70–89 important this week
    40–69 normal
    1–39 low / someday
- time_estimate_min = rough minutes to complete, or null if unknowable.
- tags = 1–3 lowercase TOPIC words (e.g. "fitness", "business", "networking", "school"). Do NOT put the context here. No @ symbols.
- summary = one imperative sentence, max 100 chars.
Output raw JSON only, no markdown.`

// Normalize raw model JSON into a safe Classification
function normalize(parsed: Partial<Classification>, text: string): Classification {
  const context = (CONTEXTS as readonly string[]).includes(parsed.context ?? '')
    ? (parsed.context as Context)
    : 'anywhere'
  const score = typeof parsed.priority_score === 'number'
    ? Math.max(1, Math.min(100, Math.round(parsed.priority_score)))
    : (parsed.key ? 80 : 45)
  return {
    kind: parsed.kind ?? 'note',
    urgency: parsed.urgency ?? 'someday',
    context,
    key: parsed.key ?? false,
    priority_score: score,
    time_estimate_min: typeof parsed.time_estimate_min === 'number' ? parsed.time_estimate_min : null,
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(t => t.replace(/^@/, '').toLowerCase()).slice(0, 3) : [],
    summary: parsed.summary?.slice(0, 100) ?? text.slice(0, 100),
  }
}

// Provider 1: Anthropic (Haiku)
async function viaAnthropic(text: string): Promise<Classification> {
  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 320,
    system: SYSTEM,
    messages: [{ role: 'user', content: text }],
  })
  const raw = (msg.content[0] as { type: string; text: string }).text.trim()
  return normalize(JSON.parse(raw), text)
}

// Provider 2: OpenAI (gpt-4o-mini) — fallback when Anthropic is unavailable
async function viaOpenAI(text: string): Promise<Classification> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CLASSIFIER_MODEL ?? 'gpt-4o-mini',
      max_tokens: 320,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text },
      ],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}`)
  const json = await res.json()
  const raw = json.choices?.[0]?.message?.content?.trim() ?? '{}'
  return normalize(JSON.parse(raw), text)
}

// Provider 3: pure-regex fallback when both LLMs fail
function viaRegex(text: string): Classification {
  const lower = text.toLowerCase()
  const urgency = lower.includes('today') || lower.includes('asap') ? 'today'
    : lower.includes('this week') ? 'this_week'
    : lower.includes('this month') ? 'this_month'
    : 'someday'
  const context: Context =
    /gym|lift|workout|train/.test(lower) ? 'gym'
    : /tennis|court|coach|lesson/.test(lower) ? 'court'
    : /call|text|dm|email|reach out|outreach/.test(lower) ? 'calls'
    : /code|build|website|app|business|essay|apply/.test(lower) ? 'deep-work'
    : /class|campus|usc|professor|exam/.test(lower) ? 'campus'
    : 'anywhere'
  // Heuristic: imperative verb at the start → it's a task
  const looksLikeTask = /^(call|text|email|dm|build|make|finish|send|book|buy|hit|go|reach|write|apply|set up|schedule|confirm|prep|review|fix|plan|draft|order|pay|clean)/.test(lower)
  return {
    kind: looksLikeTask ? 'task' : 'note',
    urgency,
    context,
    key: urgency === 'today',
    priority_score: urgency === 'today' ? 70 : urgency === 'this_week' ? 55 : 40,
    time_estimate_min: null,
    tags: [],
    summary: text.slice(0, 100),
  }
}

export async function classifyCapture(text: string): Promise<Classification> {
  try {
    return await viaAnthropic(text)
  } catch {
    try {
      return await viaOpenAI(text)
    } catch {
      return viaRegex(text)
    }
  }
}

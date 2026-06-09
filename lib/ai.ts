import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

// ── Shared AI helper ──────────────────────────────────────────────────────────
// Every new "intelligence" call in the app routes through here so quality is
// identical everywhere. Anthropic-first (if a key is configured) → OpenAI gpt-4o
// fallback — mirrors the pattern already used in /api/plan and /api/ask.
// Today only OPENAI_API_KEY is set, so everything runs on OpenAI.

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

// Sonnet for full reasoning (debriefs, prioritization); falls back to gpt-4o.
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o'

export type AiMsg = { role: 'user' | 'assistant'; content: string }

function normalize(messages: AiMsg[] | string): AiMsg[] {
  return typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages
}

/** Strip ```json … ``` / ``` … ``` fences and surrounding prose so JSON.parse works. */
function stripFences(raw: string): string {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) s = fence[1].trim()
  return s
}

/**
 * Single-shot completion. Returns the model's text (trimmed).
 * Pass `json: true` to request a JSON object (OpenAI gets response_format; the
 * prompt should still instruct JSON for the Anthropic path).
 */
export async function complete(opts: {
  system: string
  messages: AiMsg[] | string
  maxTokens?: number
  json?: boolean
}): Promise<string> {
  const messages = normalize(opts.messages)
  const maxTokens = opts.maxTokens ?? 800

  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system: opts.system,
        messages,
      })
      const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
      if (text.trim()) return text.trim()
    } catch (err) {
      console.error('[ai] anthropic failed, falling back to OpenAI:', err)
    }
  }

  const r = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: maxTokens,
    ...(opts.json ? { response_format: { type: 'json_object' as const } } : {}),
    messages: [{ role: 'system', content: opts.system }, ...messages],
  })
  return r.choices[0]?.message?.content?.trim() ?? ''
}

/** complete() + tolerant JSON parse. Returns null on parse failure. */
export async function completeJSON<T = unknown>(opts: {
  system: string
  messages: AiMsg[] | string
  maxTokens?: number
}): Promise<T | null> {
  const raw = await complete({ ...opts, json: true })
  if (!raw) return null
  try {
    return JSON.parse(stripFences(raw)) as T
  } catch {
    return null
  }
}

/**
 * Streaming chat for the assistant UI. Returns a ReadableStream of UTF-8 text
 * chunks (same contract the existing /api/ask consumer expects).
 */
export async function streamChat(opts: {
  system: string
  messages: AiMsg[]
  maxTokens?: number
}): Promise<ReadableStream> {
  const encoder = new TextEncoder()
  const maxTokens = opts.maxTokens ?? 900

  if (anthropic) {
    try {
      const stream = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        stream: true,
        system: opts.system,
        messages: opts.messages,
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
    } catch (err) {
      console.error('[ai] anthropic stream failed, falling back to OpenAI:', err)
    }
  }

  const stream = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: maxTokens,
    stream: true,
    messages: [{ role: 'system', content: opts.system }, ...opts.messages],
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

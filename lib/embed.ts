import OpenAI from 'openai'
import { getServiceClient, USER_ID } from './supabase'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/** Embed a single piece of text into the long-term memory store. */
export async function embedMemory(opts: {
  text: string
  sourceType: 'capture' | 'task' | 'goal' | 'journal' | 'habit' | 'note'
  sourceId?: string
}): Promise<void> {
  const { text, sourceType, sourceId } = opts
  if (!text?.trim()) return
  try {
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 2000),
    })
    const embedding = res.data[0].embedding
    const db = getServiceClient()
    await db.from('memory_chunks').insert({
      user_id: USER_ID,
      source_type: sourceType,
      source_id: sourceId ?? null,
      text: text.slice(0, 2000),
      embedding,
    })
  } catch (err) {
    // Non-fatal — capture/task still succeeds even if embedding fails
    console.error('embedMemory error:', err)
  }
}

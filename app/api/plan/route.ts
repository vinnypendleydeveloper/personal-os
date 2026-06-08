import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import { buildContext, buildSystemPrompt } from '@/lib/personalContext'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PLAN_INSTRUCTION = `Generate Vinny's daily briefing for TODAY. Use his calendar, Whoop recovery, top tasks, goals, and habits.

Format in markdown, warm and punchy, in this exact structure:

**[One-line greeting that reflects the time of day and his current state — reference recovery or a win]**

## Today's Plan
A time-blocked schedule as a list. Anchor around real calendar events. Slot his top-priority tasks into open windows. Respect his energy: if recovery is low, keep training light and protect focus time; if high, push harder. Each line: time range — what — (why, one short phrase).

## One Thing
The single most important task today and why it moves a summer goal.

Keep it under 180 words. Be specific to his actual data — never generic.`

async function generate(system: string): Promise<string> {
  // Anthropic first, OpenAI fallback
  try {
    const msg = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system,
      messages: [{ role: 'user', content: PLAN_INSTRUCTION }],
    })
    return (msg.content[0] as { type: string; text: string }).text.trim()
  } catch {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 600,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: PLAN_INSTRUCTION },
      ],
    })
    return res.choices[0]?.message?.content?.trim() ?? ''
  }
}

export async function GET(req: NextRequest) {
  const db = getServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'

  // Cached plan for today?
  const { data: row } = await db.from('daily_logs')
    .select('id, notes').eq('user_id', USER_ID).eq('log_date', today).single()

  if (!refresh && row?.notes?.daily_plan) {
    return NextResponse.json({ plan: row.notes.daily_plan, generated_at: row.notes.daily_plan_at, cached: true })
  }

  // Generate fresh
  const contextBlocks = await buildContext(db)
  const system = buildSystemPrompt(contextBlocks)
  const plan = await generate(system)
  const generated_at = new Date().toISOString()

  // Persist into today's daily_log
  const notes = row?.notes ?? {}
  notes.daily_plan = plan
  notes.daily_plan_at = generated_at
  if (row) {
    await db.from('daily_logs').update({ notes, updated_at: generated_at }).eq('id', row.id)
  } else {
    await db.from('daily_logs').insert({ user_id: USER_ID, log_date: today, notes })
  }

  return NextResponse.json({ plan, generated_at, cached: false })
}

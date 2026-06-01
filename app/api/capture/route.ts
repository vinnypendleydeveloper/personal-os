import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'
import { classifyCapture } from '@/lib/router/classifyCapture'

export async function POST(req: NextRequest) {
  const db = getServiceClient()
  const { text, source = 'web' } = await req.json()

  if (!text?.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  // Classify
  const classification = await classifyCapture(text)

  // Write raw capture
  const { data: capture, error: captureError } = await db.from('raw_captures').insert({
    user_id: USER_ID,
    source,
    raw_text: text,
    classification,
    llm_source: 'anthropic',
    routed_to: classification.kind,
  }).select().single()

  if (captureError) {
    console.error('raw_captures insert error:', captureError)
    return NextResponse.json({ error: captureError.message }, { status: 500 })
  }

  // Route to downstream table
  let routedId: string | null = null

  if (classification.kind === 'task') {
    const { data: task, error: taskError } = await db.from('tasks').insert({
      user_id: USER_ID,
      title: classification.summary,
      description: text,
      urgency: classification.urgency,
      key: classification.key,
      tags: classification.tags,
      priority_score: classification.key ? 10 : 5,
    }).select().single()

    if (taskError) console.error('tasks insert error:', taskError)
    else routedId = task.id
  }

  // Update routed_id on capture
  if (routedId) {
    await db.from('raw_captures').update({ routed_id: routedId }).eq('id', capture.id)
  }

  // Audit log
  await db.from('audit_log').insert({
    user_id: USER_ID,
    action: 'capture',
    resource_type: 'raw_captures',
    resource_id: capture.id,
    metadata: { kind: classification.kind, source },
  })

  return NextResponse.json({ ok: true, classification, captureId: capture.id })
}

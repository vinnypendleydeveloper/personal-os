import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getServiceClient()
  const body = await req.json()

  const { data, error } = await db.from('tasks')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', USER_ID)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getServiceClient()

  const { error } = await db.from('tasks').delete().eq('id', id).eq('user_id', USER_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

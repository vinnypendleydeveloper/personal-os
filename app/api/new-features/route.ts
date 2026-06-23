import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'

export async function GET() {
  const db = getServiceClient()
  const { data, error } = await db
    .from('new_features')
    .select('*')
    .eq('user_id', USER_ID)
    .order('when_to_add', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ features: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, notes, when_to_add } = body
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const db = getServiceClient()
  const { data, error } = await db
    .from('new_features')
    .insert({
      user_id: USER_ID,
      title: title.trim(),
      notes: notes?.trim() || null,
      when_to_add: when_to_add || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ feature: data })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = getServiceClient()
  const { error } = await db
    .from('new_features')
    .delete()
    .eq('id', id)
    .eq('user_id', USER_ID)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, USER_ID } from '@/lib/supabase'

export async function GET() {
  const db = getServiceClient()
  const { data, error } = await db
    .from('new_features')
    .select('*')
    .eq('user_id', USER_ID)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ features: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, notes, when_to_add, sort_order, category, effort, priority } = body
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const db = getServiceClient()
  const { data, error } = await db
    .from('new_features')
    .insert({
      user_id: USER_ID,
      title: title.trim(),
      notes: notes?.trim() || null,
      when_to_add: when_to_add || null,
      sort_order: typeof sort_order === 'number' ? sort_order : 0,
      is_expanded: true,
      category: category || null,
      effort: effort || null,
      priority: priority || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ feature: data })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const db = getServiceClient()

  // Bulk reorder: { reorder: string[] }
  if (body.reorder && Array.isArray(body.reorder)) {
    const ids: string[] = body.reorder
    await Promise.all(
      ids.map((id, i) =>
        db.from('new_features')
          .update({ sort_order: i })
          .eq('id', id)
          .eq('user_id', USER_ID)
      )
    )
    return NextResponse.json({ ok: true })
  }

  // Single feature patch: { id, is_expanded?, category?, effort?, ... }
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const allowed = ['is_expanded', 'category', 'effort', 'title', 'notes', 'when_to_add', 'sort_order', 'priority']
  const update = Object.fromEntries(
    Object.entries(fields).filter(([k]) => allowed.includes(k))
  )

  const { data, error } = await db
    .from('new_features')
    .update(update)
    .eq('id', id)
    .eq('user_id', USER_ID)
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

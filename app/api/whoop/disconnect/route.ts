import { NextResponse } from 'next/server'
import { clearTokens } from '@/lib/whoop'

export async function POST() {
  await clearTokens()
  return NextResponse.json({ ok: true })
}

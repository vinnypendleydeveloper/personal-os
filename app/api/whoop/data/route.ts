import { NextResponse } from 'next/server'
import { fetchWhoopData, getStoredTokens } from '@/lib/whoop'

export async function GET() {
  const tokens = await getStoredTokens()
  if (!tokens) return NextResponse.json({ connected: false })

  const data = await fetchWhoopData()
  if (!data) return NextResponse.json({ connected: true, data: null, error: 'fetch_failed' })

  return NextResponse.json({ connected: true, data })
}

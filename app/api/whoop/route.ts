// GET /api/whoop — initiate OAuth flow
import { NextRequest, NextResponse } from 'next/server'
import { getStoredTokens } from '@/lib/whoop'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // If requesting auth URL
  if (searchParams.get('action') === 'auth') {
    const state = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    const params = new URLSearchParams({
      client_id: process.env.WHOOP_CLIENT_ID!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/whoop/callback`,
      response_type: 'code',
      scope: 'offline read:recovery read:cycles read:sleep read:workout read:body_measurement',
      state,
    })
    const authUrl = `https://api.prod.whoop.com/oauth/oauth2/auth?${params}`
    return NextResponse.redirect(authUrl)
  }

  // Otherwise return connection status
  const tokens = await getStoredTokens()
  return NextResponse.json({ connected: !!tokens })
}

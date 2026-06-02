import { NextRequest, NextResponse } from 'next/server'
import { storeTokens } from '@/lib/whoop'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?whoop=error`)
  }

  // Exchange code for tokens
  const res = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/whoop/callback`,
    }),
  })

  const data = await res.json()
  if (!res.ok || !data.access_token) {
    console.error('Whoop token exchange failed:', data)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?whoop=error`)
  }

  await storeTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
  })

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?whoop=connected`)
}

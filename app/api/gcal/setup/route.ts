import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

// One-time OAuth setup to get a refresh token.
// 1. GET /api/gcal/setup           → returns the Google auth URL
// 2. Visit the URL, approve, get redirected to /api/gcal/setup?code=...
// 3. Copy the printed refresh_token into .env.local as GOOGLE_REFRESH_TOKEN

const SCOPES = ['https://www.googleapis.com/auth/calendar.events']

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ?? 'http://localhost:3000/api/gcal/setup',
  )
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const password = req.headers.get('x-setup-password') ?? sp.get('pw') ?? sp.get('state')
  if (password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({
      error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local',
    }, { status: 400 })
  }

  const searchParams = new URL(req.url).searchParams
  const code = searchParams.get('code')
  const auth = getOAuth2Client()

  // Step 2: exchange auth code for tokens (Google redirected back with ?code=...)
  if (code) {
    const { tokens } = await auth.getToken(code)
    return NextResponse.json({
      message: 'Success! Copy this refresh_token into .env.local as GOOGLE_REFRESH_TOKEN',
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
    })
  }

  // Step 1: return auth URL — embed password in state so the redirect back still passes auth
  const url = auth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: password,
  })

  return NextResponse.json({
    message: 'Visit the auth_url in your browser to authorize Google Calendar access',
    auth_url: url,
  })
}

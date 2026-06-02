import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE_NAME = 'pos-session'
const secret = new TextEncoder().encode(process.env.AUTH_SECRET!)

const PUBLIC_PATHS = ['/login', '/api/auth']
const WEBHOOK_PATHS = ['/api/telegram', '/api/whoop/callback']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public + webhook routes
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (WEBHOOK_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  // Allow programmatic access via x-api-secret header
  const apiSecret = request.headers.get('x-api-secret')
  if (apiSecret && apiSecret === process.env.API_SECRET) return NextResponse.next()

  // Check session cookie
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (token) {
    try {
      await jwtVerify(token, secret)
      return NextResponse.next()
    } catch {}
  }

  // Redirect to login
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

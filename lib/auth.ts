import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'pos-session'
const secret = new TextEncoder().encode(process.env.AUTH_SECRET!)

export async function signSession() {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret)
}

export async function verifySession(token: string) {
  try {
    await jwtVerify(token, secret)
    return true
  } catch {
    return false
  }
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  return verifySession(token)
}

export { COOKIE_NAME }

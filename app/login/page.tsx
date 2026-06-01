'use client'

import { useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      const from = searchParams.get('from') || '/'
      router.push(from)
    } else {
      setError('Wrong password.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--ink-0)' }}>
      <div className="panel p-8 w-full max-w-sm">
        <h1 className="text-xl font-mono font-bold mb-1" style={{ color: 'var(--accent)' }}>
          PERSONAL OS
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--ink-4)' }}>Enter your password to continue.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--ink-2)',
              border: '1px solid oklch(1 0 0 / 0.1)',
              color: 'var(--foreground)',
            }}
          />
          {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="py-2 px-4 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--ink-0)' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

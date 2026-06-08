'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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
      router.push(searchParams.get('from') || '/')
    } else {
      setError('ACCESS DENIED')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'var(--bg)',
        backgroundImage: `
          radial-gradient(ellipse 60% 40% at 50% 40%, oklch(0.70 0.20 245 / 0.08) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 50% 60%, oklch(0.74 0.17 148 / 0.04) 0%, transparent 50%)
        `,
      }}
    >
      <div className="w-full max-w-xs animate-fade-up">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span
              className="text-sm font-semibold tracking-[0.3em]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}
            >
              PERSONAL OS
            </span>
            <span className="dot-online text-[10px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ok)' }}>●</span>
          </div>
          <p className="text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)', letterSpacing: '0.1em' }}>
            AUTHENTICATION REQUIRED
          </p>
        </div>

        {/* Form */}
        <div
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '24px',
            boxShadow: '0 0 40px oklch(0.70 0.20 245 / 0.08)',
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[10px] tracking-wider"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}
              >
                PASSWORD
              </label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] select-none"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}
                >
                  &gt;
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoFocus
                  className="w-full pl-8 pr-3 py-2 rounded-md text-[13px]"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--fg)',
                    letterSpacing: '0.15em',
                  }}
                />
              </div>
            </div>

            {error && (
              <p
                className="text-[10px] tracking-wider animate-fade-up"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--hot)' }}
              >
                ✕ {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="py-2 rounded-md text-[11px] font-semibold tracking-wider disabled:opacity-40 transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
              style={{
                fontFamily: 'var(--font-mono)',
                background: 'var(--accent)',
                color: 'var(--bg)',
                letterSpacing: '0.15em',
                boxShadow: !loading && password ? '0 0 16px var(--accent-dim)' : 'none',
              }}
            >
              {loading ? 'AUTHENTICATING…' : 'AUTHENTICATE'}
            </button>
          </form>
        </div>

        <p
          className="text-center text-[10px] mt-4"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}
        >
          VINNY PENDLEY · PERSONAL OS v1.0
        </p>
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

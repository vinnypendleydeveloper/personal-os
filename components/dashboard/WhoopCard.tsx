'use client'

import { useEffect, useState } from 'react'
import { Panel } from './Panel'

interface WhoopData {
  recovery_score: number | null
  hrv: number | null
  rhr: number | null
  sleep_performance: number | null
  sleep_hours: number | null
  strain: number | null
  spo2: number | null
  updated_at: string
}

function recoveryColor(score: number) {
  if (score >= 67) return 'var(--ok)'
  if (score >= 34) return 'var(--warn)'
  return 'var(--hot)'
}

function recoveryLabel(score: number) {
  if (score >= 67) return 'GREEN'
  if (score >= 34) return 'YELLOW'
  return 'RED'
}

function strainColor(strain: number) {
  if (strain >= 18) return 'var(--hot)'
  if (strain >= 14) return 'var(--warn)'
  if (strain >= 10) return 'var(--accent)'
  return 'var(--ok)'
}

export function WhoopCard() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [data, setData] = useState<WhoopData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    // Check for OAuth callback result
    const params = new URLSearchParams(window.location.search)
    const whoopParam = params.get('whoop')
    if (whoopParam) {
      window.history.replaceState({}, '', window.location.pathname)
      if (whoopParam === 'error') setError(true)
    }
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch('/api/whoop/data')
      const json = await res.json()
      setConnected(json.connected)
      setData(json.data ?? null)
    } catch {
      setError(true)
    }
    setLoading(false)
  }

  function connect() {
    window.location.href = '/api/whoop?action=auth'
  }

  async function disconnect() {
    await fetch('/api/whoop/disconnect', { method: 'POST' })
    setConnected(false)
    setData(null)
  }

  return (
    <Panel
      index={9}
      title="Whoop"
      status={connected ? 'online' : 'none'}
      action={
        connected
          ? <button onClick={disconnect} className="card-label hover:opacity-70 transition-opacity" style={{ color: 'var(--fg-4)' }}>disconnect</button>
          : null
      }
    >
      {loading ? (
        <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>Loading…</p>
      ) : !connected ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-3)' }}>
            Connect your Whoop to see recovery, HRV, sleep, and strain on your dashboard.
          </p>
          {error && (
            <p className="text-[10px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--hot)' }}>
              ✕ Connection failed. Try again.
            </p>
          )}
          <button
            onClick={connect}
            className="py-2 rounded-lg text-[11px] font-semibold tracking-wider transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
            style={{
              fontFamily: 'var(--font-mono)',
              background: 'linear-gradient(135deg, oklch(0.20 0.05 0), oklch(0.16 0.03 0))',
              color: 'var(--fg)',
              border: '1px solid oklch(0.66 0.22 22 / 0.4)',
              boxShadow: '0 0 16px oklch(0.66 0.22 22 / 0.1)',
            }}
          >
            CONNECT WHOOP
          </button>
        </div>
      ) : !data ? (
        <p className="text-xs" style={{ color: 'var(--fg-4)' }}>No data yet — wear your Whoop overnight.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Recovery score — big number */}
          {data.recovery_score !== null && (
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-medium tracking-wider mb-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>
                  RECOVERY
                </p>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-4xl font-bold tabular-nums leading-none"
                    style={{ fontFamily: 'var(--font-mono)', color: recoveryColor(data.recovery_score) }}
                  >
                    {data.recovery_score}
                  </span>
                  <span className="text-sm" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>%</span>
                </div>
                <p className="text-[10px] mt-0.5 font-semibold tracking-widest" style={{ fontFamily: 'var(--font-mono)', color: recoveryColor(data.recovery_score) }}>
                  ● {recoveryLabel(data.recovery_score)}
                </p>
              </div>

              {/* Recovery arc */}
              <div className="relative w-14 h-14">
                <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="var(--bg-3)" strokeWidth="4" />
                  <circle
                    cx="28" cy="28" r="22" fill="none"
                    stroke={recoveryColor(data.recovery_score)}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 22}`}
                    strokeDashoffset={`${2 * Math.PI * 22 * (1 - data.recovery_score / 100)}`}
                    style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 4px ${recoveryColor(data.recovery_score)})` }}
                  />
                </svg>
              </div>
            </div>
          )}

          <div className="h-px" style={{ background: 'var(--border)' }} />

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {data.hrv !== null && <Stat label="HRV" value={`${data.hrv}`} unit="ms" color="var(--accent)" />}
            {data.rhr !== null && <Stat label="RHR" value={`${data.rhr}`} unit="bpm" color="var(--fg-2)" />}
            {data.sleep_performance !== null && <Stat label="SLEEP" value={`${Math.round(data.sleep_performance)}`} unit="%" color="var(--accent)" />}
            {data.sleep_hours !== null && <Stat label="HOURS" value={`${data.sleep_hours}`} unit="hr" color="var(--fg-2)" />}
            {data.strain !== null && <Stat label="STRAIN" value={`${data.strain}`} unit="/21" color={strainColor(data.strain)} />}
            {data.spo2 !== null && <Stat label="SPO₂" value={`${data.spo2}`} unit="%" color="var(--ok)" />}
          </div>

          <p className="text-[9px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>
            Updated {new Date(data.updated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
      )}
    </Panel>
  )
}

function Stat({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[10px] w-12 shrink-0" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>{label}</span>
      <span className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color }}>{value}</span>
      <span className="text-[10px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>{unit}</span>
    </div>
  )
}

'use client'

import { useEffect, useState, useRef } from 'react'
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

// ── Exact Whoop app colors ────────────────────────────────────
const WHOOP_GREEN  = '#00E676'
const WHOOP_YELLOW = '#FFD600'
const WHOOP_RED    = '#FF1744'
const WHOOP_BLUE   = '#40C4FF'   // strain / stress cool tone
const WHOOP_ORANGE = '#FF6D00'   // high strain

function recoveryColor(s: number) {
  if (s >= 67) return WHOOP_GREEN
  if (s >= 34) return WHOOP_YELLOW
  return WHOOP_RED
}
function recoveryLabel(s: number) {
  if (s >= 67) return 'GREEN'
  if (s >= 34) return 'YELLOW'
  return 'RED'
}
function sleepColor(s: number) {
  if (s >= 85) return WHOOP_GREEN
  if (s >= 70) return WHOOP_BLUE
  if (s >= 50) return WHOOP_YELLOW
  return WHOOP_RED
}
function sleepLabel(s: number) {
  if (s >= 85) return 'OPTIMAL'
  if (s >= 70) return 'GOOD'
  if (s >= 50) return 'FAIR'
  return 'POOR'
}
function strainColor(s: number) {
  if (s >= 18) return WHOOP_RED
  if (s >= 14) return WHOOP_ORANGE
  if (s >= 10) return WHOOP_YELLOW
  return WHOOP_GREEN
}
function strainLabel(s: number) {
  if (s >= 18) return 'ALL OUT'
  if (s >= 14) return 'STRENUOUS'
  if (s >= 10) return 'MODERATE'
  return 'LIGHT'
}
/** ms until next :00/:15/:30/:45 */
function msUntilNextQuarter() {
  const now = new Date()
  const mins = now.getMinutes()
  const secs = now.getSeconds()
  const ms = now.getMilliseconds()
  const nextQ = (Math.floor(mins / 15) + 1) * 15
  return (nextQ - mins) * 60 * 1000 - secs * 1000 - ms
}

// ── Ring component ────────────────────────────────────────────
interface RingProps {
  label: string
  score: number | null     // 0–100 arc fill
  sublabel: string
  color: string
  displayValue?: string
  displayUnit?: string
}

function Ring({ label, score, sublabel, color, displayValue, displayUnit }: RingProps) {
  const SIZE = 82          // container px
  const CX   = SIZE / 2
  const r    = 30
  const circ = 2 * Math.PI * r
  const pct  = score ?? 0
  const isNull = score === null

  return (
    <div className="flex flex-col items-center gap-2">
      {/* label */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.16em',
        color: 'rgba(255,255,255,0.38)',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>

      {/* ring + centered number */}
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        {/* SVG arc */}
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)', overflow: 'visible' }}
        >
          <circle cx={CX} cy={CX} r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="5" />
          {!isNull && (
            <circle
              cx={CX} cy={CX} r={r} fill="none"
              stroke={color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - pct / 100)}
              style={{
                transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)',
                filter: `drop-shadow(0 0 7px ${color}bb)`,
              }}
            />
          )}
        </svg>

        {/* Absolutely centered text — true geometric center of the circle */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {isNull ? (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.2)', lineHeight: 1 }}>—</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, lineHeight: 1 }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: displayValue ? 24 : 28,
                fontWeight: 800,
                color,
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}>
                {displayValue ?? Math.round(pct)}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.4)',
                paddingBottom: 2,
              }}>
                {displayUnit ?? '%'}
              </span>
            </div>
          )}
        </div>
      </div>

      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: isNull ? 'rgba(255,255,255,0.2)' : color,
        textShadow: isNull ? 'none' : `0 0 8px ${color}88`,
      }}>
        {isNull ? '○ —' : `● ${sublabel}`}
      </span>
    </div>
  )
}

// ── Stat row ──────────────────────────────────────────────────
function Stat({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.3)', width: 44, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{unit}</span>
    </div>
  )
}

// ── Main card ─────────────────────────────────────────────────
export function WhoopCard() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [data, setData] = useState<WhoopData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const whoopParam = params.get('whoop')
    if (whoopParam) {
      window.history.replaceState({}, '', window.location.pathname)
      if (whoopParam === 'error') setError(true)
    }
    fetchData()

    const delay = msUntilNextQuarter()
    setNextRefresh(new Date(Date.now() + delay))

    const timeout = setTimeout(() => {
      fetchData()
      setNextRefresh(new Date(Date.now() + 15 * 60 * 1000))
      intervalRef.current = setInterval(() => {
        fetchData()
        setNextRefresh(new Date(Date.now() + 15 * 60 * 1000))
      }, 15 * 60 * 1000)
    }, delay)

    return () => {
      clearTimeout(timeout)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  async function fetchData() {
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

  function connect() { window.location.href = '/api/whoop?action=auth' }

  async function doDisconnect() {
    await fetch('/api/whoop/disconnect', { method: 'POST' })
    setConnected(false)
    setData(null)
    setConfirmDisconnect(false)
  }

  const disconnectAction = connected ? (
    confirmDisconnect ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: WHOOP_RED }}>disconnect?</span>
        <button
          onClick={doDisconnect}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: WHOOP_RED, border: `1px solid ${WHOOP_RED}`, borderRadius: 3, padding: '1px 6px', lineHeight: 1, background: 'transparent', cursor: 'pointer' }}
        >YES</button>
        <button
          onClick={() => setConfirmDisconnect(false)}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 3, padding: '1px 6px', lineHeight: 1, background: 'transparent', cursor: 'pointer' }}
        >NO</button>
      </div>
    ) : (
      <button onClick={() => setConfirmDisconnect(true)} className="card-label hover:opacity-70 transition-opacity" style={{ color: 'rgba(255,255,255,0.3)' }}>
        disconnect
      </button>
    )
  ) : null

  return (
    <Panel index={9} title="Whoop" status={connected ? 'online' : 'none'} action={disconnectAction}>
      {loading ? (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>Loading…</p>
      ) : !connected ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.45)' }}>
            Connect your Whoop to see recovery, HRV, sleep, and strain on your dashboard.
          </p>
          {error && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: WHOOP_RED }}>✕ Connection failed. Try again.</p>
          )}
          <button
            onClick={connect}
            style={{
              fontFamily: 'var(--font-mono)',
              padding: '10px 0',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              background: `linear-gradient(135deg, rgba(255,23,68,0.18), rgba(255,23,68,0.08))`,
              color: '#fff',
              border: `1px solid ${WHOOP_RED}66`,
              boxShadow: `0 0 20px ${WHOOP_RED}18`,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            CONNECT WHOOP
          </button>
        </div>
      ) : !data ? (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No data yet — wear your Whoop overnight.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 3 rings in a row */}
          <div style={{ display: 'flex', justifyContent: 'space-around', overflow: 'visible' }}>
            <Ring
              label="Recovery"
              score={data.recovery_score}
              sublabel={data.recovery_score !== null ? recoveryLabel(data.recovery_score) : ''}
              color={data.recovery_score !== null ? recoveryColor(data.recovery_score) : 'rgba(255,255,255,0.2)'}
            />
            <Ring
              label="Sleep"
              score={data.sleep_performance !== null ? Math.round(data.sleep_performance) : null}
              sublabel={data.sleep_performance !== null ? sleepLabel(data.sleep_performance) : ''}
              color={data.sleep_performance !== null ? sleepColor(data.sleep_performance) : 'rgba(255,255,255,0.2)'}
            />
            <Ring
              label="Strain"
              score={data.strain !== null ? Math.round((data.strain / 21) * 100) : null}
              sublabel={data.strain !== null ? `${data.strain}/21 · ${strainLabel(data.strain)}` : ''}
              color={data.strain !== null ? WHOOP_BLUE : 'rgba(255,255,255,0.2)'}
              displayValue={data.strain !== null ? `${data.strain}` : undefined}
              displayUnit=""
            />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
            {data.hrv    !== null && <Stat label="HRV"   value={`${data.hrv}`}   unit="ms"  color={WHOOP_BLUE} />}
            {data.rhr    !== null && <Stat label="RHR"   value={`${data.rhr}`}   unit="bpm" color="rgba(255,255,255,0.7)" />}
            {data.sleep_hours !== null && <Stat label="SLEPT" value={`${data.sleep_hours}`} unit="hr" color="rgba(255,255,255,0.7)" />}
            {data.spo2   !== null && <Stat label="SPO₂"  value={`${data.spo2}`}  unit="%"   color={WHOOP_GREEN} />}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.22)' }}>
              Updated {new Date(data.updated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
            {nextRefresh && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.22)' }}>
                next {nextRefresh.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}

// Shared chip system used across Session, CRM, History, Log, Weekly Review.

export const WHERE: Record<string, { label: string; color: string }> = {
  'deep-work': { label: 'DEEP WORK', color: 'oklch(0.70 0.16 250)' },
  'gym':       { label: 'GYM',       color: 'oklch(0.72 0.18 30)' },
  'court':     { label: 'COURT',     color: 'oklch(0.74 0.17 148)' },
  'campus':    { label: 'CAMPUS',    color: 'oklch(0.70 0.16 300)' },
  'calls':     { label: 'CALLS',     color: 'oklch(0.74 0.15 200)' },
  'errands':   { label: 'ERRANDS',   color: 'oklch(0.74 0.16 70)' },
  'home':      { label: 'HOME',      color: 'oklch(0.66 0.05 255)' },
  'anywhere':  { label: 'ANYWHERE',  color: 'var(--fg-4)' },
}

export function priorityBadge(score: number): { label: string; color: string; filled: boolean } {
  if (score >= 67) return { label: 'HIGH', color: 'var(--hot)', filled: true }
  if (score >= 34) return { label: 'MED',  color: 'var(--warn)', filled: false }
  if (score >= 1)  return { label: 'LOW',  color: 'var(--accent)', filled: false }
  return { label: 'NO PRIORITY', color: 'var(--fg-4)', filled: false }
}

export function splitTags(tags: string[]) {
  const ctx = tags?.find(t => t.startsWith('@'))?.slice(1) ?? null
  const topical = tags?.filter(t => !t.startsWith('@')) ?? []
  return { ctx, topical }
}

export function Chip({ label, color, filled = false }: { label: string; color: string; filled?: boolean }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
      padding: '1px 5px', borderRadius: 4, lineHeight: 1.4, whiteSpace: 'nowrap',
      color: filled ? 'oklch(0.12 0.01 255)' : color,
      background: filled ? color : `color-mix(in oklch, ${color} 14%, transparent)`,
      border: `1px solid color-mix(in oklch, ${color} 35%, transparent)`,
    }}>{label}</span>
  )
}

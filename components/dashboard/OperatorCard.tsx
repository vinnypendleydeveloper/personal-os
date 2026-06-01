import { Panel } from './Panel'

export function OperatorCard() {
  return (
    <Panel title="Operator">
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Vinny Pendley</p>
          <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Los Angeles, CA</p>
        </div>
        <div className="h-px" style={{ background: 'oklch(1 0 0 / 0.06)' }} />
        <div className="flex flex-col gap-1">
          <Row label="Focus" value="IB Internship Search" />
          <Row label="School" value="USC → Fall 2026" />
          <Row label="Status" value="Active" ok />
        </div>
      </div>
    </Panel>
  )
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span style={{ color: 'var(--ink-4)' }}>{label}</span>
      <span
        className="font-mono"
        style={{ color: ok ? 'var(--ok)' : 'var(--foreground)' }}
      >
        {value}
      </span>
    </div>
  )
}

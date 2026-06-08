import { ReactNode, CSSProperties } from 'react'

interface PanelProps {
  children: ReactNode
  className?: string
  title?: string
  index?: number
  status?: 'online' | 'live' | 'none'
  action?: ReactNode
  style?: CSSProperties
  delay?: number   // stagger delay in ms
}

export function Panel({ children, className = '', title, index, status, action, style, delay }: PanelProps) {
  return (
    <div
      className={`panel p-4 flex flex-col gap-3 animate-fade-up ${className}`}
      style={{ ...style, animationDelay: delay ? `${delay}ms` : undefined }}
    >
      {(title || action || index !== undefined) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {index !== undefined && (
              <span className="card-label" style={{ color: 'var(--fg-2)' }}>
                {String(index).padStart(2, '0')} //
              </span>
            )}
            {title && (
              <span className="card-label" style={{ color: 'var(--fg-3)' }}>
                {title}
              </span>
            )}
            {status && status !== 'none' && (
              <span
                className={`card-label ml-0.5 ${status === 'live' ? 'dot-live' : 'dot-online'}`}
                style={{ color: status === 'live' ? 'var(--hot)' : 'var(--ok)' }}
              >
                ●
              </span>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

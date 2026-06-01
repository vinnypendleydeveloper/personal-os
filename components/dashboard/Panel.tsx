import { ReactNode } from 'react'

interface PanelProps {
  children: ReactNode
  className?: string
  title?: string
  index?: number       // e.g. 01, 02
  status?: 'online' | 'live' | 'none'
  action?: ReactNode
}

export function Panel({ children, className = '', title, index, status, action }: PanelProps) {
  return (
    <div className={`panel p-4 flex flex-col gap-3 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {index !== undefined && (
              <span className="font-mono text-[10px]" style={{ color: 'var(--ink-3)' }}>
                {String(index).padStart(2, '0')} //
              </span>
            )}
            {title && (
              <span className="text-[10px] font-mono font-semibold tracking-widest uppercase" style={{ color: 'var(--ink-4)' }}>
                {title}
              </span>
            )}
            {status && status !== 'none' && (
              <span className="text-[10px] font-mono" style={{ color: status === 'live' ? 'var(--danger)' : 'var(--ok)' }}>
                ● {status.toUpperCase()}
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

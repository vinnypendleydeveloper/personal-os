import { ReactNode } from 'react'

interface PanelProps {
  children: ReactNode
  className?: string
  title?: string
  action?: ReactNode
}

export function Panel({ children, className = '', title, action }: PanelProps) {
  return (
    <div className={`panel p-4 flex flex-col gap-3 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between">
          {title && (
            <span className="text-[10px] font-mono font-semibold tracking-widest uppercase" style={{ color: 'var(--ink-4)' }}>
              {title}
            </span>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

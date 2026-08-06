import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

interface SplitLayoutProps {
  primary: ReactNode
  secondary: ReactNode
  /** Fraction the primary pane takes on desktop, e.g. '60%'. Defaults to even split. */
  primaryWidth?: string
  className?: string
}

/**
 * Split Layout — two-pane layout (e.g. PDF Reader with side panel).
 * Design System §4.4: activates in landscape/tablet+; stacks vertically
 * on narrow portrait viewports.
 */
export function SplitLayout({ primary, secondary, primaryWidth = '60%', className }: SplitLayoutProps) {
  return (
    <div className={cn('flex h-full flex-col sm:flex-row', className)}>
      <div className="min-w-0 flex-1 overflow-y-auto border-b border-border sm:border-b-0 sm:border-r" style={{ flexBasis: primaryWidth }}>
        {primary}
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto">{secondary}</div>
    </div>
  )
}

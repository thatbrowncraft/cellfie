import type { ReactNode } from 'react'
import { cn } from '../utils/cn'
import { useBreakpointClass } from '../hooks/useMediaQuery'

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
 *
 * PWA layout-isolation fix — direction now comes from `useBreakpointClass`
 * (JS, standalone-aware) instead of a raw `sm:flex-row` breakpoint; see
 * `useBreakpointClass` in shared/hooks/useMediaQuery.ts for why.
 */
export function SplitLayout({ primary, secondary, primaryWidth = '60%', className }: SplitLayoutProps) {
  const directionClass = useBreakpointClass({
    mobile: 'flex-col',
    tablet: 'flex-row',
    desktop: 'flex-row',
    wide: 'flex-row'
  })
  const primaryBorderClass = useBreakpointClass({
    mobile: 'border-b border-border',
    tablet: 'border-r border-border',
    desktop: 'border-r border-border',
    wide: 'border-r border-border'
  })

  return (
    <div className={cn('flex h-full', directionClass, className)}>
      <div className={cn('min-w-0 flex-1 overflow-y-auto', primaryBorderClass)} style={{ flexBasis: primaryWidth }}>
        {primary}
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto">{secondary}</div>
    </div>
  )
}

import type { ReactNode } from 'react'
import { useBreakpointClass } from '../hooks/useMediaQuery'

interface ComparisonLayoutProps {
  title: string
  left: ReactNode
  right: ReactNode
}

/**
 * Comparison Layout — Design System §4.2, capped at 960px (narrower than a
 * content grid, wider than reading text). Used by Comparison Studio and
 * Learn's Comparison Table section.
 *
 * PWA layout-isolation fix — column count now comes from `useBreakpointClass`
 * (JS, standalone-aware) instead of a raw `md:grid-cols-2` breakpoint. See
 * `useBreakpointClass` in shared/hooks/useMediaQuery.ts for why.
 */
export function ComparisonLayout({ title, left, right }: ComparisonLayoutProps) {
  const gridColsClass = useBreakpointClass({
    mobile: 'grid-cols-1',
    tablet: 'grid-cols-1',
    desktop: 'grid-cols-2',
    wide: 'grid-cols-2'
  })

  return (
    <div className="mx-auto max-w-comparison px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-display text-h1 font-semibold text-ink-primary">{title}</h1>
      <div className={`grid gap-6 ${gridColsClass}`}>
        <div className="rounded-md border border-border bg-surface p-5">{left}</div>
        <div className="rounded-md border border-border bg-surface p-5">{right}</div>
      </div>
    </div>
  )
}

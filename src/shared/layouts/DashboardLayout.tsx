import type { ReactNode } from 'react'
import { useBreakpointClass } from '../hooks/useMediaQuery'

interface DashboardLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
}

/**
 * Dashboard Layout — a title/subtitle header over a responsive grid area.
 * Used by the Dashboard module (continuity-focused, per SDD §8) and any
 * future overview-style page.
 *
 * PWA layout-isolation fix — the grid's column count is now picked via
 * `useBreakpointClass()` (JS, standalone-aware) instead of raw `sm:`/`md:`
 * Tailwind classes, which stayed multi-column on an installed Android PWA
 * whenever Chrome's per-origin "Request desktop site" forced a wide layout
 * viewport. See `useBreakpointClass` in `shared/hooks/useMediaQuery.ts` for
 * the full root-cause explanation.
 */
export function DashboardLayout({ title, subtitle, children }: DashboardLayoutProps) {
  const gridColsClass = useBreakpointClass({
    mobile: 'grid-cols-1',
    tablet: 'grid-cols-2',
    desktop: 'grid-cols-3',
    wide: 'grid-cols-3'
  })

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <header className="mb-8">
        <h1 className="font-display text-display font-semibold text-ink-primary">{title}</h1>
        {subtitle && <p className="mt-2 font-body text-body-lg text-ink-secondary">{subtitle}</p>}
      </header>
      <div className={`grid gap-6 ${gridColsClass}`}>{children}</div>
    </div>
  )
}

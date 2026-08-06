import type { ReactNode } from 'react'

interface DashboardLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
}

/**
 * Dashboard Layout — a title/subtitle header over a responsive grid area.
 * Used by the Dashboard module (continuity-focused, per SDD §8) and any
 * future overview-style page.
 */
export function DashboardLayout({ title, subtitle, children }: DashboardLayoutProps) {
  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <header className="mb-8">
        <h1 className="font-display text-display font-semibold text-ink-primary">{title}</h1>
        {subtitle && <p className="mt-2 font-body text-body-lg text-ink-secondary">{subtitle}</p>}
      </header>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">{children}</div>
    </div>
  )
}

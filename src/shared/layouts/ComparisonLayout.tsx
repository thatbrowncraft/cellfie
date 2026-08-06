import type { ReactNode } from 'react'

interface ComparisonLayoutProps {
  title: string
  left: ReactNode
  right: ReactNode
}

/**
 * Comparison Layout — Design System §4.2, capped at 960px (narrower than a
 * content grid, wider than reading text). Used by Comparison Studio and
 * Learn's Comparison Table section.
 */
export function ComparisonLayout({ title, left, right }: ComparisonLayoutProps) {
  return (
    <div className="mx-auto max-w-comparison px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-display text-h1 font-semibold text-ink-primary">{title}</h1>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-5">{left}</div>
        <div className="rounded-md border border-border bg-surface p-5">{right}</div>
      </div>
    </div>
  )
}

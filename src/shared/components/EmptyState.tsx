import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

/**
 * Empty State — used across Library, Search, Notes, Collections whenever
 * there's nothing to show yet. Calm and inviting rather than a bare "no
 * results" message, consistent with §10.7's guidance for search specifically
 * but applied as a general pattern here.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 py-16 text-center', className)}>
      {icon && <div className="mb-1 text-ink-tertiary">{icon}</div>}
      <h3 className="font-display text-h3 font-medium text-ink-primary">{title}</h3>
      {description && <p className="max-w-sm font-body text-body text-ink-secondary">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

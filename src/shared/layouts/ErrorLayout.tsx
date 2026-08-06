import type { ReactNode } from 'react'
import { WarningCircle } from '@phosphor-icons/react'

interface ErrorLayoutProps {
  title: string
  description?: string
  action?: ReactNode
}

/** Full-page error state — calm, not alarming; brick-red used sparingly on the icon only. */
export function ErrorLayout({ title, description, action }: ErrorLayoutProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-content flex-col items-center justify-center gap-3 px-4 text-center">
      <WarningCircle size={40} className="text-error" aria-hidden />
      <h1 className="font-display text-h2 font-medium text-ink-primary">{title}</h1>
      {description && <p className="max-w-sm font-body text-body text-ink-secondary">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

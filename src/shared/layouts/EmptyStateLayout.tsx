import type { ReactNode } from 'react'

interface EmptyStateLayoutProps {
  children: ReactNode
}

/** Full-page wrapper that centers a single EmptyState within the content area. */
export function EmptyStateLayout({ children }: EmptyStateLayoutProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-content items-center justify-center px-4">{children}</div>
  )
}

import type { ReactNode } from 'react'

interface LoadingLayoutProps {
  children: ReactNode
}

/** Full-page wrapper for skeleton loading states — grid of skeleton cards, etc. */
export function LoadingLayout({ children }: LoadingLayoutProps) {
  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 md:px-8" aria-busy="true" aria-live="polite">
      {children}
    </div>
  )
}

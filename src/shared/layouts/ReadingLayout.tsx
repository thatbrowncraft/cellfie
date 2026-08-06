import type { ReactNode } from 'react'

interface ReadingLayoutProps {
  title: string
  eyebrow?: string
  children: ReactNode
}

/**
 * Reading Layout — Design System §4.2. Caps content at 680px for a
 * comfortable 65–75 character measure. Used by Learn topics, Notes, and
 * Library reading views.
 */
export function ReadingLayout({ title, eyebrow, children }: ReadingLayoutProps) {
  return (
    <div className="mx-auto max-w-reading px-4 py-10 sm:px-0">
      <header className="mb-8">
        {eyebrow && (
          <p className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{eyebrow}</p>
        )}
        <h1 className="font-display text-display font-semibold text-ink-primary">{title}</h1>
      </header>
      <div className="font-body text-body-lg leading-relaxed text-ink-primary">{children}</div>
    </div>
  )
}

import type { ReactNode } from 'react'
import { useBreakpoint } from '../hooks/useMediaQuery'
import { cn } from '../utils/cn'

interface ReadingLayoutProps {
  title: string
  eyebrow?: string
  children: ReactNode
}

/**
 * Reading Layout — Design System §4.2. Caps content at 680px for a
 * comfortable 65–75 character measure. Used by Learn topics, Notes, and
 * Library reading views.
 *
 * PWA layout-isolation fix — horizontal padding is now picked via
 * `useBreakpoint()` (JS, standalone-aware) instead of a raw `sm:px-0`
 * Tailwind class. `sm:` is a real `@media (min-width: 640px)` query that
 * the browser evaluates against the actual layout-viewport width, which
 * on an installed Android PWA can still be Chrome's forced ~980px
 * "Request desktop site" width even though the app is correctly locked
 * to the mobile presentation everywhere else (see `useBreakpointClass`
 * in `shared/hooks/useMediaQuery.ts` for the full root-cause writeup —
 * this is the same class of bug, just for padding instead of a grid
 * column count). That made this specific `sm:` query misfire and drop
 * the page's only horizontal padding to zero, unlike sibling layouts
 * (Dashboard/Comparison/Laboratory/Loading) whose raw breakpoints only
 * ever step padding *up* on wider screens rather than removing it
 * entirely — which is why this was the one page that visibly ran
 * content edge-to-edge instead of just being non-optimally padded.
 */
export function ReadingLayout({ title, eyebrow, children }: ReadingLayoutProps) {
  const breakpoint = useBreakpoint()
  const isMobile = breakpoint === 'mobile'

  return (
    <div className={cn('mx-auto max-w-reading py-10', isMobile ? 'px-4' : 'px-0')}>
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

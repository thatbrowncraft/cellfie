import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface PageTransitionProps {
  children: ReactNode
}

/**
 * Page Transition — Design System §12.
 * Simple crossfade + 8px vertical drift ("turning a page"), driven by the
 * `.page-enter` keyframe animation in index.css. Re-keying on pathname
 * remounts the wrapper so the animation replays on every navigation.
 * Reduced motion is handled globally (index.css collapses all animation
 * durations under prefers-reduced-motion) — no separate branch needed here.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-enter">
      {children}
    </div>
  )
}

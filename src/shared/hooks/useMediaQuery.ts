import { useEffect, useState } from 'react'

/** Subscribes to a CSS media query and returns whether it currently matches. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide'

/**
 * Whether the app is currently presented as an installed/standalone
 * PWA rather than a normal browser tab — checked via the standard
 * `display-mode: standalone` media query (what the manifest's
 * `"display": "standalone"` puts an installed Android/desktop PWA
 * into), with a fallback to the legacy `navigator.standalone` flag
 * some iOS Safari versions expose instead of that media query.
 *
 * ROOT-CAUSE CONTEXT for `useBreakpoint()` below: an installed
 * Android PWA (WebAPK) shares per-origin site settings with Chrome,
 * including "Request desktop site." If that ever gets set for this
 * origin, the installed app's layout viewport can end up desktop-width
 * even on a phone screen — the width-based `min-width` queries below
 * have no way to tell "genuinely wide" apart from "phone screen stuck
 * reporting a desktop-width viewport." Checking `display-mode` first
 * sidesteps the ambiguity entirely: an installed app is always
 * detectably standalone regardless of whatever width it happens to be
 * reporting right now. Not persisted anywhere and never inferred from
 * a stored preference — this only ever reflects how the current
 * window is actually presented at the moment it's read.
 */
export function useIsStandalonePwa(): boolean {
  const isStandaloneDisplayMode = useMediaQuery('(display-mode: standalone)')
  const [isIosStandalone] = useState(
    () => typeof navigator !== 'undefined' && (navigator as unknown as { standalone?: boolean }).standalone === true
  )
  return isStandaloneDisplayMode || isIosStandalone
}

/** Cellfie breakpoints — Design System §4.3. */
export function useBreakpoint(): Breakpoint {
  const isStandalone = useIsStandalonePwa()
  const isTablet = useMediaQuery('(min-width: 640px)')
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isWide = useMediaQuery('(min-width: 1440px)')

  // Installed/standalone PWA: always the mobile presentation, regardless
  // of whatever layout-viewport width Android/Chrome happens to be
  // reporting right now (see `useIsStandalonePwa` above for why that
  // width can't be trusted on its own for an installed app). A normal
  // browser tab is never standalone, so its full mobile/tablet/desktop/
  // wide responsive behavior below is completely unaffected.
  if (isStandalone) return 'mobile'

  if (isWide) return 'wide'
  if (isDesktop) return 'desktop'
  if (isTablet) return 'tablet'
  return 'mobile'
}

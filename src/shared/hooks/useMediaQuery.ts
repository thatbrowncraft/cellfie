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

/**
 * Picks a literal className for the current breakpoint instead of relying
 * on a raw Tailwind `sm:`/`md:`/`lg:` (CSS `min-width`) breakpoint.
 *
 * ROOT-CAUSE CONTEXT: `useBreakpoint()` already correctly forces 'mobile'
 * for an installed standalone PWA regardless of what layout-viewport width
 * Chrome happens to be reporting (see the note on `useIsStandalonePwa`
 * above for why that width can't be trusted there). But a `sm:grid-cols-2`
 * class is a real CSS media query the browser evaluates on its own against
 * that same untrustworthy width — it never consults `useBreakpoint()` at
 * all, so it can independently reintroduce the desktop layout even in a
 * component that otherwise reads `useBreakpoint()` correctly elsewhere.
 * Selecting a plain, unprefixed class (`'grid-cols-2'`, not `'sm:grid-cols-2'`)
 * through this hook sidesteps that: the class Tailwind emits carries no
 * media query of its own, so it always reflects the JS-computed breakpoint.
 *
 * Falls back to `map.mobile` for any breakpoint not given an explicit
 * entry (mobile-first, same convention as Tailwind's own `sm:`/`md:` chain).
 */
export function useBreakpointClass<T extends string>(map: Partial<Record<Breakpoint, T>> & { mobile: T }): T {
  const breakpoint = useBreakpoint()
  return map[breakpoint] ?? map.mobile
}

/**
 * Common column-count presets for `useBreakpointClass`, named by their
 * mobile→tablet→desktop column progression. Covers the repeated
 * `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`-style patterns found across
 * Dashboard, Laboratory, Comparison Studio, Concepts, Library, Notes, and
 * Organism Explorer — see the root-cause note on `useBreakpointClass` above
 * for why each of those needed converting off raw `sm:`/`md:`/`lg:` classes.
 */
export const GRID_COLS_PRESETS = {
  oneTwoThree: { mobile: 'grid-cols-1', tablet: 'grid-cols-2', desktop: 'grid-cols-3', wide: 'grid-cols-3' },
  oneTwoFour: { mobile: 'grid-cols-1', tablet: 'grid-cols-2', desktop: 'grid-cols-4', wide: 'grid-cols-4' },
  twoFour: { mobile: 'grid-cols-2', tablet: 'grid-cols-4', desktop: 'grid-cols-4', wide: 'grid-cols-4' },
  twoThree: { mobile: 'grid-cols-2', tablet: 'grid-cols-3', desktop: 'grid-cols-3', wide: 'grid-cols-3' },
  oneTwo: { mobile: 'grid-cols-1', tablet: 'grid-cols-2', desktop: 'grid-cols-2', wide: 'grid-cols-2' }
} as const satisfies Record<string, Partial<Record<Breakpoint, string>> & { mobile: string }>

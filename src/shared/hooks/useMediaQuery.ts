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
 * Must match the STORAGE_KEY in index.html's inline bootstrap script —
 * that script runs before this module ever loads, so this is read-only
 * here, purely to fall back to sessionStorage directly if for some
 * reason `window.__CELLFIE_PWA_SESSION__` isn't set (e.g. this hook
 * running in a test environment with no bootstrap script at all).
 */
const PWA_SESSION_STORAGE_KEY = 'cellfie:pwa-session'

/**
 * Whether the current browsing session started from an actual Cellfie
 * app-icon launch, per the "?pwa=1" start_url marker (vite.config.ts)
 * and index.html's inline bootstrap script. Read once per app load —
 * intentionally NOT reactive to later URL changes, since React Router
 * navigation strips the query string but the launch identity must
 * persist for the rest of the session regardless (see the bootstrap
 * script's sessionStorage handling for why).
 */
function readPwaLaunchSession(): boolean {
  if (typeof window === 'undefined') return false
  if ((window as unknown as { __CELLFIE_PWA_SESSION__?: boolean }).__CELLFIE_PWA_SESSION__) return true
  try {
    return window.sessionStorage.getItem(PWA_SESSION_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Whether the app is currently presented as an installed/standalone
 * PWA rather than a normal browser tab. Three independent signals, any
 * one of which is enough:
 *
 * 1. `display-mode: standalone` — the standard signal, true for a
 *    genuine installed Android/desktop PWA per the manifest's
 *    `"display": "standalone"`.
 * 2. `navigator.standalone` — the legacy flag some iOS Safari versions
 *    expose instead of the media query above.
 * 3. The Cellfie app-launch session (see `readPwaLaunchSession` above) —
 *    set from the manifest's "?pwa=1" start_url marker. This exists
 *    because an installed Android shortcut shares Chrome's per-origin
 *    site settings, including "Request desktop site," and that can
 *    make (1) unreliable in practice: the installed launch itself may
 *    just never report `display-mode: standalone` the way it's
 *    supposed to. The marker sidesteps that entirely — Android's
 *    home-screen launch always opens exactly the marked start_url, so
 *    its presence identifies "this is the installed app" independent
 *    of whatever display-mode or viewport width Chrome decides to
 *    report for it.
 *
 * ROOT-CAUSE CONTEXT for `useBreakpoint()` below: an installed
 * Android PWA (WebAPK) shares per-origin site settings with Chrome,
 * including "Request desktop site." If that ever gets set for this
 * origin, the installed app's layout viewport can end up desktop-width
 * even on a phone screen — the width-based `min-width` queries below
 * have no way to tell "genuinely wide" apart from "phone screen stuck
 * reporting a desktop-width viewport." Checking `display-mode` (and now
 * the launch-session marker) first sidesteps the ambiguity entirely.
 * Nothing here is a persisted user preference — the display-mode and
 * iOS checks only ever reflect how the current window is actually
 * presented right now, and the launch-session flag only ever reflects
 * how *this browsing session* actually started, not some sticky
 * global "mobile mode" that could leak into ordinary Chrome browsing.
 */
export function useIsStandalonePwa(): boolean {
  const isStandaloneDisplayMode = useMediaQuery('(display-mode: standalone)')
  const [isIosStandalone] = useState(
    () => typeof navigator !== 'undefined' && (navigator as unknown as { standalone?: boolean }).standalone === true
  )
  const [isAppLaunchSession] = useState(readPwaLaunchSession)
  return isStandaloneDisplayMode || isIosStandalone || isAppLaunchSession
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
